import asyncio
import json
import os
from time import monotonic

import httpx
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from app.schemas import ChatInput
from app.services.agent_prompts import POLICY_PROMPT, REFUSAL, answer_prompt
from app.services.agent_fields import TOOLS, SavedFieldTools


class AgentService:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None):
        self.transport = transport
        self.window_start = monotonic()
        self.requests = 0

    async def chat(self, body: ChatInput, fields: SavedFieldTools | None = None) -> JSONResponse:
        indonesian = body.lang == "id"
        if body.analysis_input is not None:
            return JSONResponse(status_code=503, content={"detail": "Analisis lahan belum terhubung ke chat." if indonesian else "Field analysis is not connected to chat yet."})
        key = os.getenv("AI_API_KEY", "").strip()
        if not key:
            return JSONResponse(status_code=503, content={"detail": "Layanan AI belum diaktifkan. Silakan coba lagi nanti." if indonesian else "The AI service has not been activated yet. Please try again later."})
        # shortcut: quota is per process, use shared storage before running multiple workers.
        if monotonic() - self.window_start >= 60:
            self.window_start, self.requests = monotonic(), 0
        if self.requests >= 5:
            return JSONResponse(status_code=429, headers={"Retry-After": "60"}, content={"detail": "Batas chat tercapai. Coba lagi dalam satu menit." if indonesian else "Chat limit reached. Try again in one minute."})
        self.requests += 1
        checking = True
        history = [message.model_dump() for message in body.history]
        model = os.getenv("AI_MODEL", "gpt-6-luna")
        try:
            async with asyncio.timeout(55), httpx.AsyncClient(
                transport=self.transport,
                headers={"Authorization": f"Bearer {key}"},
                timeout=25,
            ) as client:
                async with asyncio.timeout(5):
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        json={
                            "model": model, "reasoning_effort": "none",
                            "stream": False, "max_completion_tokens": 128,
                            "response_format": {"type": "json_object"},
                            "messages": [
                                {"role": "system", "content": POLICY_PROMPT},
                                {"role": "user", "content": json.dumps({"message": body.message, "history": history})},
                            ],
                        },
                    )
                    response.raise_for_status()
                    choice = response.json()["choices"][0]
                    if choice.get("finish_reason") == "length":
                        raise ValueError("truncated decision")
                    decision = json.loads(choice["message"]["content"])
                    if (
                        not isinstance(decision, dict)
                        or set(decision) != {"allowed", "reason"}
                        or type(decision["allowed"]) is not bool
                        or decision["reason"] not in ("in_scope", "off_topic", "unsafe", "prompt_injection")
                        or decision["allowed"] != (decision["reason"] == "in_scope")
                    ):
                        raise ValueError("invalid decision")
                if not decision["allowed"]:
                    return JSONResponse({"answer": REFUSAL, "sources": [], "scenario": None, "blocked": True})
                checking = False
                messages = [
                    {"role": "system", "content": answer_prompt(body.lang)},
                    *history,
                    {"role": "user", "content": body.message},
                ]
                if body.field_id is not None:
                    messages.insert(1, {"role": "system", "content": f"Active saved field ID: {body.field_id}. Verify ownership using inspect_saved_field before discussing it."})
                for round_index in range(4):
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        json={
                            "model": model, "reasoning_effort": "none",
                            "stream": False, "max_completion_tokens": 800,
                            "messages": messages,
                            **({"tools": TOOLS, "tool_choice": "none" if round_index == 3 else "auto", "parallel_tool_calls": False} if fields else {}),
                        },
                    )
                    response.raise_for_status()
                    choice = response.json()["choices"][0]
                    message = choice["message"]
                    calls = message.get("tool_calls")
                    if calls:
                        if not fields or round_index == 3 or len(calls) != 1:
                            raise ValueError("tool call limit")
                        call = calls[0]
                        if not isinstance(call["id"], str) or call.get("type") != "function":
                            raise ValueError("invalid tool call")
                        output = await run_in_threadpool(fields.run, call["function"]["name"], call["function"]["arguments"])
                        messages.append({"role": "assistant", "content": message.get("content"), "tool_calls": calls})
                        messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(output, ensure_ascii=False)})
                        continue
                    answer = message["content"]
                    if choice.get("finish_reason") == "length" or not isinstance(answer, str) or not answer.strip():
                        raise ValueError("empty or truncated answer")
                    return JSONResponse({"answer": answer, "sources": [], "scenario": None})
        except (httpx.HTTPError, TimeoutError, ValueError, KeyError, IndexError, TypeError) as exc:
            if checking:
                detail = "Pemeriksaan pesan belum tersedia. Silakan coba lagi." if indonesian else "Message checking is unavailable. Please try again."
            else:
                detail = "AI belum dapat menjawab. Coba kirim ulang sebentar lagi." if indonesian else "The AI service could not reply. Please try again shortly."
            return JSONResponse(status_code=504 if isinstance(exc, (TimeoutError, httpx.TimeoutException)) else 502, content={"detail": detail})
