"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { formatMonth, type Dictionary } from "@/lib/i18n";
import { addMonths } from "@/lib/query";
import { HORIZONS, type Horizon, type Lang } from "@/lib/types";
import styles from "./TimeControl.module.css";

interface TimeControlProps {
  t: Dictionary;
  lang: Lang;
  horizon: Horizon;
  startMonth: string;
  monthOptions: string[];
  onChange: (next: { horizon?: Horizon; startMonth?: string }) => void;
}

export default function TimeControl({
  t,
  lang,
  horizon,
  startMonth,
  monthOptions,
  onChange,
}: TimeControlProps) {
  const pickerId = useId();
  const field = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const [year, setYear] = useState(startMonth.slice(0, 4));
  const currentYear = Number(monthOptions[0].slice(0, 4));
  const years = [String(currentYear), String(currentYear + 1)];

  function positionPicker() {
    if (!field.current || !picker.current) return;
    const bounds = field.current.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    Object.assign(picker.current.style, {
      left: `${Math.max(12, Math.min(bounds.right - width, window.innerWidth - width - 12))}px`,
      top: `${bounds.bottom + 8}px`,
      width: `${width}px`,
      maxHeight: `${Math.max(0, window.innerHeight - bounds.bottom - 20)}px`,
    });
  }

  useEffect(() => {
    const reposition = () => { if (picker.current?.matches(":popover-open")) positionPicker(); };
    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.1fr_1fr] sm:gap-3.5">
      <section aria-labelledby="lama-judul" className="flex flex-col gap-2">
        <h2 id="lama-judul" className="m-0 text-[17px] font-bold">
          {t.plan.horizon}
        </h2>
        <div role="group" aria-labelledby="lama-judul" className="grid grid-cols-4 gap-1.5">
          {HORIZONS.map((value) => (
            <button
              key={value}
              type="button"
              className="seg"
              aria-pressed={horizon === value}
              aria-label={`${value} ${t.plan.horizonUnit}`}
              onClick={() => onChange({ horizon: value })}
            >
              {value}
            </button>
          ))}
        </div>
        <span className="text-[13px] text-muted">{formatMonth(startMonth, lang, "short")} – {formatMonth(addMonths(startMonth, horizon - 1), lang, "short")}</span>
      </section>

      <section aria-labelledby="mulai-judul" className="flex flex-col gap-2">
        <h2 id="mulai-judul" className="m-0 text-[17px] font-bold">
          {t.plan.start}
        </h2>
        <button
          ref={field}
          type="button"
          popoverTarget={pickerId}
          aria-labelledby={`mulai-judul ${pickerId}-value`}
          aria-haspopup="dialog"
          className="tile flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 bg-canvas px-3 text-[15px] font-bold hover:border-sawah active:translate-y-px"
        >
          <span id={`${pickerId}-value`} aria-live="polite">
            {formatMonth(startMonth, lang)}
          </span>
          <CalendarDays size={18} className="shrink-0 text-sawah" aria-hidden="true" />
        </button>
        <div
          ref={picker}
          id={pickerId}
          popover="auto"
          role="dialog"
          aria-labelledby="mulai-judul"
          onBeforeToggle={(event) => {
            if (event.newState === "open") {
              setYear(startMonth.slice(0, 4));
              positionPicker();
            }
          }}
          onToggle={(event) => {
            if (event.newState === "open")
              picker.current?.querySelector<HTMLElement>(`[aria-label="${t.plan.month}"] [aria-pressed="true"]`)?.focus();
          }}
          className={`${styles.calendar} fixed inset-auto m-0 overflow-y-auto overscroll-contain rounded-xl border-2 border-control bg-canvas p-3 text-ink shadow-lg`}
        >
          <div className="sticky -top-3 z-10 -mx-3 -mt-3 mb-3 flex items-center gap-3 border-b border-hairline bg-canvas p-3">
            <span className="text-sm font-bold">{t.plan.year}</span>
            <div role="group" aria-label={t.plan.year} className="grid flex-1 grid-cols-2 gap-1.5">
              {years.map((value) => (
                <button key={value} type="button" aria-pressed={year === value} onClick={() => setYear(value)} className="seg px-2 text-sm">
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div role="group" aria-label={t.plan.month} className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }, (_, index) => {
              const month = `${year}-${String(index + 1).padStart(2, "0")}`;
              const selected = month === startMonth;
              return (
                <button
                  key={month}
                  type="button"
                  disabled={!monthOptions.includes(month)}
                  aria-label={formatMonth(month, lang)}
                  aria-pressed={selected}
                  className={`relative min-h-11 cursor-pointer rounded-lg border-2 px-1.5 text-[13px] font-semibold active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 ${selected ? "border-sawah-lip bg-sawah text-white" : "border-transparent hover:border-control hover:bg-sawah-tint"}`}
                  onClick={() => {
                    picker.current?.hidePopover();
                    onChange({ startMonth: month });
                  }}
                >
                  {new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))}
                  {selected && <Check size={11} className="absolute right-1 top-1" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
