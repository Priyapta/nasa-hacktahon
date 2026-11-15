"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { accountRequest } from "@/lib/accounts";
import { dictionary } from "@/lib/i18n";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { user, setUser } = useSession();
  const lang = params.get("lang") === "en" ? "en" : "id";
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isFlow = pathname === "/hasil" || pathname === "/lahan";
  const step = pathname === "/hasil" ? 3 : params.get("langkah") === "2" ? 2 : 1;

  useEffect(() => { setMenuOpen(false); setError(""); }, [pathname]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  async function logout() {
    setBusy(true); setError("");
    try {
      await accountRequest("auth/logout", "POST");
      setUser(null); setMenuOpen(false);
      router.replace(`/login?lang=${lang}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal keluar. Coba lagi."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <AppHeader t={dictionary(lang)} lang={lang} step={step} showSteps={isFlow && !params.has("lahan")}
        menuOpen={menuOpen} onMenuToggle={user ? () => setMenuOpen(!menuOpen) : undefined}
        onLangChange={(next) => { const query = new URLSearchParams(params); query.set("lang", next); router.replace(`${pathname}?${query}`); }} />
      {error && <p role="alert" className="m-0 bg-sawah-tint px-4 py-3 text-sm text-sawah-lip">{error}</p>}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {user && <AppSidebar username={user.username} lang={lang} menuOpen={menuOpen} onClose={() => setMenuOpen(false)} onLogout={logout} busy={busy} inFields={pathname === "/akun" || params.has("lahan")} />}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
