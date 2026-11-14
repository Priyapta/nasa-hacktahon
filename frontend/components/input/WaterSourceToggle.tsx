"use client";

import { CloudRain, Waves } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { WaterSource } from "@/lib/types";

interface WaterSourceToggleProps {
  t: Dictionary;
  value: WaterSource | null;
  onChange: (value: WaterSource) => void;
}

export default function WaterSourceToggle({ t, value, onChange }: WaterSourceToggleProps) {
  const options = [
    { id: "tadah_hujan" as const, label: t.plan.rainfed, hint: t.plan.rainfedHint, Icon: CloudRain },
    { id: "irigasi" as const, label: t.plan.irrigated, hint: t.plan.irrigatedHint, Icon: Waves },
  ];

  return (
    <section aria-labelledby="air-judul" className="flex flex-col gap-2">
      <h2 id="air-judul" className="m-0 text-[17px] font-bold">
        {t.plan.water}
      </h2>
      <div role="radiogroup" aria-labelledby="air-judul" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map(({ id, label, hint, Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            onClick={() => onChange(id)}
            className="tile flex min-h-16 cursor-pointer items-center gap-3 px-3.5 py-3"
          >
            <Icon size={26} aria-hidden="true" className={value === id ? "text-sawah-lip" : "text-muted"} />
            <span className="flex flex-col">
              <span className="text-base font-bold">{label}</span>
              <span className="text-[13px] text-muted">{hint}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="m-0 text-[13px] text-muted">{t.plan.waterNote}</p>
    </section>
  );
}
