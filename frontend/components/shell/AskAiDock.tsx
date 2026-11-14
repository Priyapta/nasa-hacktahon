"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MessageSquare, X } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

interface AskAiDockProps {
  t: Dictionary;
  launcherClassName: string;
  /** The AgentChat panel content. Without it the panel says chat is not connected. */
  children?: ReactNode;
}

// Non-modal on desktop so the plan or results stay usable while reading an
// answer; modal sheet on phones where there is no room for both.
const DESKTOP = "(min-width: 1024px)";

export default function AskAiDock({ t, launcherClassName, children }: AskAiDockProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function show() {
    const element = dialog.current;
    if (!element || element.open) return;
    if (window.matchMedia(DESKTOP).matches) element.show();
    else element.showModal();
    setOpen(true);
  }

  function hide() {
    dialog.current?.close();
  }

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    function closed() {
      setOpen(false);
      requestAnimationFrame(() => launcher.current?.focus());
    }
    element.addEventListener("close", closed);
    return () => element.removeEventListener("close", closed);
  }, []);

  return (
    <>
      <button
        ref={launcher}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
        className={`btn-secondary min-h-[52px] px-4 text-base ${open ? "invisible" : ""} ${launcherClassName}`}
      >
        <MessageSquare size={20} className="text-sawah" aria-hidden="true" />
        {t.ai.open}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="tanya-ai-judul"
        onKeyDown={(event) => {
          if (event.key === "Escape") hide();
        }}
        className="pointer-events-auto fixed inset-x-0 bottom-0 top-11 z-40 m-0 h-auto max-h-none w-full max-w-none flex-col overflow-hidden rounded-t-2xl border-0 bg-surface p-0 text-ink open:flex lg:inset-x-auto lg:bottom-5 lg:right-5 lg:top-[88px] lg:w-[400px] lg:rounded-2xl lg:border-2 lg:border-b-4 lg:border-hairline lg:border-b-hairline-lip"
      >
        <div className="flex items-center gap-2 border-b-2 border-hairline py-3 pl-4 pr-2.5">
          <div className="min-w-0 flex-1">
            <h2 id="tanya-ai-judul" className="m-0 text-lg font-bold text-ink-strong">
              {t.ai.title}
            </h2>
            <p className="m-0 mt-0.5 text-[13px] text-muted">{t.ai.subtitle}</p>
          </div>
          <button type="button" onClick={hide} aria-label={t.ai.close} className="btn-secondary size-11 min-h-11 p-0">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-canvas p-4">
          {children ?? (
            <>
              <p className="m-0 rounded-xl border-2 border-hairline bg-surface px-3 py-2.5 text-[13px] leading-normal text-[#3e4a43]">
                {t.ai.notice}
              </p>
              <p role="status" className="m-0 text-[15px] leading-relaxed text-muted">
                {t.ai.unavailable}
              </p>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
