"use client";

import Link from "next/link";
import { LayoutGrid, LogOut, Plus } from "lucide-react";
import type { Lang } from "@/lib/types";

interface Props {
  username: string;
  lang: Lang;
  menuOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  busy: boolean;
  inFields: boolean;
}

export default function AppSidebar({ username, lang, menuOpen, onClose, onLogout, busy, inFields }: Props) {
  const en = lang === "en";
  return (
    <aside id="app-navigation" aria-label={en ? "Account menu" : "Menu akun"}
      onKeyDown={(event) => { if (event.key === "Escape") { onClose(); document.querySelector<HTMLButtonElement>('[aria-controls="app-navigation"]')?.focus(); } }}
      className={`${menuOpen ? "flex" : "hidden"} shrink-0 flex-col overflow-y-auto bg-sawah-lip p-5 text-white lg:flex lg:w-60`}>
      <nav aria-label={en ? "Main navigation" : "Navigasi utama"} className="flex flex-col gap-2">
        <Link href={`/akun?lang=${lang}`} aria-current={inFields ? "page" : undefined} onClick={onClose}
          className={`flex min-h-12 items-center gap-3 rounded-md px-3 py-3 font-bold text-white no-underline hover:bg-white/20 ${inFields ? "bg-white/15" : ""}`}>
          <LayoutGrid size={20} aria-hidden="true" />{en ? "My fields" : "Lahan saya"}
        </Link>
        <Link href={`/?lang=${lang}`} aria-current={!inFields ? "page" : undefined} onClick={onClose}
          className={`flex min-h-12 items-center gap-3 rounded-md px-3 py-3 font-bold text-white no-underline hover:bg-white/20 ${!inFields ? "bg-white/15" : ""}`}>
          <Plus size={20} aria-hidden="true" />{en ? "Add field" : "Tambah lahan"}
        </Link>
      </nav>
      <div className="mt-6 border-t border-white/30 pt-5 lg:mt-auto">
        <p className="m-0 break-all px-3 text-sm font-bold">{username}</p>
        <button className="mt-3 flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-left font-bold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60" onClick={onLogout} disabled={busy}>
          <LogOut size={20} aria-hidden="true" />{en ? "Sign out" : "Keluar"}
        </button>
      </div>
    </aside>
  );
}
