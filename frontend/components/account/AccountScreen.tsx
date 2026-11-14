"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { accountRequest, type SavedField, type User } from "@/lib/accounts";
import Dashboard from "./Dashboard";
import { useSession } from "@/hooks/useSession";
import AgentChat from "@/components/agent/agent-chat";

function Account() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const query = params.toString();
  const en = params.get("lang") === "en";
  const back = params.get("kembali");
  const safeBack = back?.startsWith("/hasil?") || back?.startsWith("/?") ? back : `/?lang=${en ? "en" : "id"}`;
  const { user, setUser, loading: sessionLoading, error: sessionError, reload } = useSession();
  const [fields, setFields] = useState<SavedField[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { document.documentElement.lang = en ? "en" : "id"; }, [en]);

  useEffect(() => {
    if (loading || sessionLoading || error || sessionError) return;
    const destination = user ? "/akun" : "/login";
    if (pathname !== destination) router.replace(`${destination}${query ? `?${query}` : ""}`);
  }, [loading, sessionLoading, error, sessionError, user, pathname, query, router]);

  useEffect(() => {
    if (!user) { setFields([]); setLoading(false); return; }
    let active = true;
    setLoading(true); setError("");
    (async () => {
      try {
        const data = await accountRequest<{ fields: SavedField[] }>("fields");
        if (active) setFields(data.fields);
      } catch (e) {
        if (active && e instanceof ApiError && e.status === 401) { setUser(null); setFields([]); }
        if (active && !(e instanceof ApiError && e.status === 401)) setError(e instanceof Error ? e.message : "Gagal memuat akun.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [attempt, user, setUser]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const current = await accountRequest<User>(`auth/${register ? "register" : "login"}`, "POST", { username: data.get("username"), password: data.get("password") });
      setUser(current); setAttempt((n) => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal masuk. Coba lagi."); }
    finally { setBusy(false); }
  }

  async function remove(field: SavedField) {
    if (!window.confirm(en ? `Delete ${field.name}?` : `Hapus ${field.name}?`)) return;
    setBusy(true); setError("");
    try { await accountRequest(`fields/${field.id}`, "DELETE"); setFields((list) => list.filter((f) => f.id !== field.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Gagal menghapus. Coba lagi."); }
    finally { setBusy(false); }
  }

  if (user) return <><Dashboard fields={fields} lang={en ? "en" : "id"} loading={loading || sessionLoading} busy={busy} error={error || sessionError}
    savedId={params.get("tersimpan")} back={back ? safeBack : null}
    onRetry={() => { reload(); setAttempt((n) => n + 1); }} onDelete={remove} /><AgentChat lang={en ? "en" : "id"} /></>;

  return <div className="min-h-full bg-canvas text-ink">
    <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-8 lg:py-16">
      {!user && <p className="m-0 text-sm font-bold text-sawah-lip">{en ? "Your fields, in one place" : "Lahan Anda, dalam satu tempat"}</p>}
      <h1 className="m-0 text-3xl font-bold">{user ? (en ? "My fields" : "Lahan saya") : (register ? (en ? "Create account" : "Buat akun") : (en ? "Sign in" : "Masuk akun"))}</h1>
      {(error || sessionError) && <div role="alert" className="surface flex flex-col items-start gap-3 p-4"><p className="m-0">{error || sessionError}</p><button className="btn-secondary" onClick={() => { reload(); setAttempt((n) => n + 1); }} disabled={busy}>{en ? "Retry" : "Coba lagi"}</button></div>}
      {loading || sessionLoading ? <p role="status">{en ? "Loading your account and fields…" : "Memuat akun dan lahan Anda…"}</p> : <section className="surface flex flex-col gap-4 p-6">
        <p className="m-0 text-muted">{en ? "Use a username and password to save your fields." : "Gunakan username dan password untuk menyimpan lahan Anda."}</p>
        <form onSubmit={authenticate} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 font-bold">Username<input name="username" required pattern="[a-zA-Z0-9_]{3,32}" minLength={3} maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby="username-hint" disabled={busy} className="min-h-12 min-w-0 rounded-sm border-2 border-control px-3" /></label>
          <p id="username-hint" className="m-0 text-sm text-muted">{en ? "3–32 letters, numbers, or underscores." : "3–32 huruf, angka, atau garis bawah."}</p>
          <label className="flex flex-col gap-1 font-bold">Password<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={register ? "new-password" : "current-password"} aria-describedby="password-hint" disabled={busy} className="min-h-12 min-w-0 rounded-sm border-2 border-control px-3" /></label>
          <p id="password-hint" className="m-0 text-sm text-muted">{en ? "8–128 characters. Keep your password safe; password recovery is not available yet." : "8–128 karakter. Simpan password Anda; pemulihan password belum tersedia."}</p>
          <button className="btn-primary" disabled={busy}>{busy ? (en ? "Processing…" : "Memproses…") : (register ? (en ? "Create account" : "Buat akun") : (en ? "Sign in" : "Masuk"))}</button>
        </form>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setRegister(!register); setError(""); }}>{register ? (en ? "Already have an account? Sign in" : "Sudah punya akun? Masuk") : (en ? "New here? Create account" : "Belum punya akun? Daftar")}</button>
      </section>}
    </main>
  </div>;
}

export default function AccountScreen() {
  return <Suspense fallback={<main className="p-6">Memuat akun…</main>}><Account /></Suspense>;
}
