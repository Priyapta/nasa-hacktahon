"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "./useSession";

export type ChatMessage = { role: "user" | "assistant"; content: string; blocked?: boolean };
export type ChatLanguage = "id" | "en";

export function useAgentChat(lang: ChatLanguage) {
  const { user } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const last = useRef<{ message: string; history: ChatMessage[]; field_id?: string } | null>(null);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    last.current = null;
    setMessages([]);
    setPending(false);
    setError("");
  }, []);

  useEffect(() => { reset(); return () => controller.current?.abort(); }, [lang, user?.id, reset]);

  async function send(message: string, retry = false) {
    if (controller.current || !message.trim() || message.length > 2000) return;
    const boundary = messages.map((item) => item.blocked === true).lastIndexOf(true);
    const fieldId = new URLSearchParams(window.location.search).get("lahan");
    const payload = retry ? last.current : {
      message: message.trim(), history: messages.slice(boundary + 1).slice(-10).map(({ role, content }) => ({ role, content })),
      ...(fieldId ? { field_id: fieldId } : {}),
    };
    if (!payload) return;
    last.current = payload;
    if (!retry) setMessages((items) => [...items, { role: "user", content: payload.message }]);
    setPending(true);
    setError("");
    const active = new AbortController();
    controller.current = active;
    const timeout = setTimeout(() => active.abort(), 60_000);
    try {
      const response = await fetch("/api/v1/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: active.signal,
        body: JSON.stringify({ ...payload, analysis_input: null, lang }),
      });
      const data = await response.json();
      if (!response.ok && typeof data.detail === "string") {
        if (controller.current === active) setError(data.detail);
        return;
      }
      if (!response.ok) throw new Error("");
      if (typeof data.answer !== "string" || !data.answer.trim()) throw new Error("");
      if (controller.current === active) {
        setMessages((items) => [...items, { role: "assistant", content: data.answer, ...(data.blocked === true ? { blocked: true } : {}) }]);
        last.current = null;
      }
    } catch {
      if (controller.current === active) setError(lang === "id" ? "Jawaban belum tersedia. Periksa koneksi lalu coba lagi." : "No reply yet. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
      if (controller.current === active) { controller.current = null; setPending(false); }
    }
  }

  return { messages, pending, error, send, reset, retry: () => last.current && send(last.current.message, true) };
}
