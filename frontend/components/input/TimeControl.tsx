"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth, type Dictionary } from "@/lib/i18n";
import { HORIZONS, type Horizon, type Lang } from "@/lib/types";

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
  const index = Math.max(0, monthOptions.indexOf(startMonth));
  const last = monthOptions[monthOptions.length - 1];

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
        <span className="text-[13px] text-muted">{t.plan.horizonUnit}</span>
      </section>

      <section aria-labelledby="mulai-judul" className="flex flex-col gap-2">
        <h2 id="mulai-judul" className="m-0 text-[17px] font-bold">
          {t.plan.start}
        </h2>
        <div className="tile flex min-h-12 items-center">
          <button
            type="button"
            aria-label={t.plan.prevMonth}
            disabled={index === 0}
            onClick={() => onChange({ startMonth: monthOptions[index - 1] })}
            className="flex size-11 cursor-pointer items-center justify-center text-sawah disabled:cursor-not-allowed disabled:text-[#b5bcb3]"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span aria-live="polite" className="flex-1 text-center text-[15px] font-bold">
            {formatMonth(startMonth, lang)}
          </span>
          <button
            type="button"
            aria-label={t.plan.nextMonth}
            disabled={index >= monthOptions.length - 1}
            onClick={() => onChange({ startMonth: monthOptions[index + 1] })}
            className="flex size-11 cursor-pointer items-center justify-center text-sawah disabled:cursor-not-allowed disabled:text-[#b5bcb3]"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <span className="text-[13px] text-muted">{t.plan.until(formatMonth(last, lang))}</span>
      </section>
    </div>
  );
}
