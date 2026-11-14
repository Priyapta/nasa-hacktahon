"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { accountRequest, type SavedField } from "@/lib/accounts";
import type { AnalysisInput, Lang } from "@/lib/types";

export default function SaveField({ input, lang, fieldId }: { input: AnalysisInput; lang: Lang; fieldId?: string }) {
  const en = lang === "en";
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loaded, setLoaded] = useState(!fieldId);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setMessage(""); setNeedsLogin(false); setLoaded(!fieldId); setName("");
    if (!fieldId) return;
    accountRequest<SavedField>(`fields/${encodeURIComponent(fieldId)}`)
      .then((field) => { if (active) { setName(field.name); setLoaded(true); } })
      .catch((error) => {
        if (!active) return;
        setNeedsLogin(error instanceof ApiError && error.status === 401);
        setMessage(error instanceof Error ? error.message : (en ? "Could not load this field." : "Gagal memuat lahan ini."));
      });
    return () => { active = false; };
  }, [fieldId, attempt, en]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setNeedsLogin(false);
    try {
      const saved = await accountRequest<SavedField>(fieldId ? `fields/${encodeURIComponent(fieldId)}` : "fields", fieldId ? "PUT" : "POST", { name: name.trim(), plan: { ...input, lang } });
      router.push(`/akun?lang=${lang}&tersimpan=${encodeURIComponent(saved.id)}`);
    } catch (error) {
      setNeedsLogin(error instanceof ApiError && error.status === 401);
      setMessage(error instanceof Error ? error.message : (en ? "Could not save. Try again." : "Gagal menyimpan. Coba lagi."));
    } finally { setBusy(false); }
  }

  return <section className="surface flex flex-col gap-3 p-5" aria-label={en ? "Field settings" : "Pengaturan lahan"}>
    <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-bold">
        {en ? "Field name" : "Nama lahan"}
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} disabled={busy || !loaded} className="min-h-12 min-w-0 rounded-sm border-2 border-control px-3" />
      </label>
      <button className="btn-primary" disabled={busy || !loaded || !name.trim()}>{busy ? (en ? "Saving…" : "Menyimpan…") : fieldId ? (en ? "Save changes" : "Simpan perubahan") : (en ? "Save field" : "Simpan lahan")}</button>
    </form>
    {message && <p role="status" className="m-0 text-sm">{message}</p>}
    {!loaded && !message && <p role="status" className="m-0 text-sm">{en ? "Loading saved field…" : "Memuat lahan tersimpan…"}</p>}
    {!loaded && message && !needsLogin && <button className="btn-secondary self-start" onClick={() => setAttempt((n) => n + 1)}>{en ? "Retry" : "Coba lagi"}</button>}
    {needsLogin && <Link className="btn-secondary self-start" href={`/login?lang=${lang}&kembali=${encodeURIComponent(window.location.pathname + window.location.search)}`}>{en ? "Sign in / register" : "Masuk / daftar"}</Link>}
  </section>;
}
