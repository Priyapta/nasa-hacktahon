"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { accountRequest, type SavedField, type User } from "@/lib/accounts";
import Dashboard from "./Dashboard";
import LoginHero from "./LoginHero";
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

  return <div className="grid min-h-full bg-canvas text-ink lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
    <LoginHero en={en} />
    <main className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-14 lg:py-16">
      <div className="flex w-full max-w-[400px] flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[34px] font-bold leading-tight tracking-tight text-ink-strong">{register ? (en ? "Create account" : "Buat akun") : (en ? "Sign in" : "Masuk akun")}</h1>
          <p className="m-0 leading-relaxed text-muted">{en ? "Use a username and password to save your fields." : "Gunakan username dan password untuk menyimpan lahan Anda."}</p>
        </div>
        {(error || sessionError) && <div role="alert" className="surface flex flex-col items-start gap-3 p-4"><p className="m-0">{error || sessionError}</p><button className="btn-secondary" onClick={() => { reload(); setAttempt((n) => n + 1); }} disabled={busy}>{en ? "Retry" : "Coba lagi"}</button></div>}
        {loading || sessionLoading ? <p role="status">{en ? "Loading your account and fields…" : "Memuat akun dan lahan Anda…"}</p> : <>
          <form onSubmit={authenticate} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="username" className="font-bold">Username</label>
              <input id="username" name="username" required pattern="[a-zA-Z0-9_]{3,32}" minLength={3} maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby="username-hint" disabled={busy} className="min-h-[52px] min-w-0 rounded-md border-2 border-control bg-white px-3.5 focus:border-sawah" />
              <p id="username-hint" className="m-0 text-[13px] text-muted">{en ? "3 to 32 letters, numbers, or underscores." : "3 sampai 32 huruf, angka, atau garis bawah."}</p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="font-bold">Password</label>
              <input id="password" name="password" type="password" required minLength={8} maxLength={128} autoComplete={register ? "new-password" : "current-password"} aria-describedby="password-hint" disabled={busy} className="min-h-[52px] min-w-0 rounded-md border-2 border-control bg-white px-3.5 focus:border-sawah" />
              <p id="password-hint" className="m-0 text-[13px] leading-normal text-muted">{en ? "8 to 128 characters. Keep your password safe. Password recovery is not available yet." : "8 sampai 128 karakter. Simpan password Anda. Pemulihan password belum tersedia."}</p>
            </div>
            <button className="btn-primary min-h-14 text-[17px]" disabled={busy}>{busy ? (en ? "Processing…" : "Memproses…") : (register ? (en ? "Create account" : "Buat akun") : (en ? "Sign in" : "Masuk"))}</button>
          </form>
          <div className="flex items-center gap-3 text-[13px] text-muted" aria-hidden="true"><span className="h-0.5 flex-1 bg-hairline" />{en ? "or" : "atau"}<span className="h-0.5 flex-1 bg-hairline" /></div>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setRegister(!register); setError(""); }}>{register ? (en ? "Already have an account? Sign in" : "Sudah punya akun? Masuk") : (en ? "New here? Create account" : "Belum punya akun? Daftar")}</button>
        </>}
      </div>
    </main>
  </div>;
}

export default function AccountScreen() {
  return <Suspense fallback={<main className="p-6">Memuat akun…</main>}><Account /></Suspense>;
}
