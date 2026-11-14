from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.schemas import ChatInput

router = APIRouter()


@router.post("/agent/chat", tags=["agent"])
async def chat(request: Request):
    chunks = bytearray()
    async for chunk in request.stream():
        if len(chunks) + len(chunk) > 64 * 1024:
            return JSONResponse(status_code=413, content={"detail": "Pesan terlalu besar."})
        chunks.extend(chunk)
    try:
        body = ChatInput.model_validate_json(chunks)
    except ValidationError:
        return JSONResponse(status_code=400, content={"detail": "Pesan maksimal 2.000 karakter; riwayat maksimal 10 pesan user/assistant; bahasa id/en."})
    return await request.app.state.agent.chat(body)
