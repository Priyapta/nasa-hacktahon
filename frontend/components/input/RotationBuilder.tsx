"use client";

import { Minus, Plus, X } from "lucide-react";
import { formatMonth, type Dictionary } from "@/lib/i18n";
import { previewPattern } from "@/lib/plan-preview";
import {
  FALLOW_MAX_MONTHS,
  FALLOW_MIN_MONTHS,
  MAX_STAGES,
  type Crop,
  type Horizon,
  type Lang,
  type Stage,
} from "@/lib/types";

interface RotationBuilderProps {
  t: Dictionary;
  lang: Lang;
  startMonth: string;
  horizon: Horizon;
  crops: Crop[] | null;
  cropsFailed: boolean;
  onRetry: () => void;
  hasPattern: boolean;
  stages: Stage[];
  onChange: (next: { hasPattern: boolean; stages: Stage[] }) => void;
}

export default function RotationBuilder({
  t,
  lang,
  startMonth,
  horizon,
  crops,
  cropsFailed,
  onRetry,
  hasPattern,
  stages,
  onChange,
}: RotationBuilderProps) {
  const names = new Map(crops?.map((crop) => [crop.crop_id, crop]) ?? []);
  const full = stages.length >= MAX_STAGES;
  const preview = crops ? previewPattern(stages, crops, startMonth, horizon) : null;
  const covered = Boolean(preview && preview.total >= horizon);

  function update(next: Stage[]) {
    onChange({ hasPattern: true, stages: next });
  }

  function add(crop: Crop) {
    if (full || covered) return;
    update([
      ...stages,
      crop.crop_id === "bera"
        ? { crop_id: "bera", months: FALLOW_MIN_MONTHS }
        : { crop_id: crop.crop_id },
    ]);
  }

  function setFallow(index: number, months: number) {
    update(stages.map((stage, i) => (i === index ? { ...stage, months } : stage)));
  }

  return (
    <section aria-labelledby="pola-judul" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="pola-judul" className="m-0 text-[17px] font-bold">
          {t.plan.pattern}
        </h2>
        {hasPattern && (
          <span className="text-sm text-muted">{t.plan.stageCount(stages.length, MAX_STAGES)}</span>
        )}
      </div>

      <div role="group" aria-labelledby="pola-judul" className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="seg text-[15px]"
          aria-pressed={hasPattern}
          onClick={() => onChange({ hasPattern: true, stages })}
        >
          {t.plan.hasPattern}
        </button>
        <button
          type="button"
          className="seg text-[15px]"
          aria-pressed={!hasPattern}
          onClick={() => onChange({ hasPattern: false, stages })}
        >
          {t.plan.noPattern}
        </button>
      </div>

      {!hasPattern ? (
        <p className="m-0 text-sm leading-relaxed text-muted">{t.plan.noPatternNote}</p>
      ) : (
        <>
          <p className="m-0 text-sm leading-relaxed text-muted">{t.plan.patternHint}</p>
          {stages.length === 0 ? (
            <p className="m-0 rounded-xl border-2 border-dashed border-control px-4 py-3 text-sm text-muted">
              {t.plan.emptyStages}
            </p>
          ) : (
            <ol className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
              {stages.map((stage, index) => {
                const timing = preview?.rows[index];
                const fallow = stage.crop_id === "bera";
                const crop = names.get(stage.crop_id);
                const months = fallow ? (stage.months ?? FALLOW_MIN_MONTHS) : crop?.slot_bulan;
                return (
                  <li key={index} className={`tile flex flex-col gap-0.5 py-2 pl-3 pr-1.5 ${fallow ? "tile-fallow" : ""} ${timing?.outside ? "opacity-60" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${fallow ? "text-tanah-strong" : "text-muted"}`}>
                        {t.plan.stage(index + 1)}
                      </span>
                      <button
                        type="button"
                        aria-label={t.plan.removeStage(index + 1)}
                        onClick={() => update(stages.filter((_, i) => i !== index))}
                        className="-my-1 flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-black/5"
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                    <span className="text-[15px] font-bold">{crop?.nama ?? stage.crop_id}</span>
                    {fallow && months ? (
                      <span className="mt-1 flex items-center justify-between gap-1 pr-1.5 text-[13px] font-bold">
                        <button
                          type="button"
                          aria-label={t.plan.fallowLess}
                          disabled={months <= FALLOW_MIN_MONTHS}
                          onClick={() => setFallow(index, months - 1)}
                          className="flex size-9 cursor-pointer items-center justify-center rounded-lg border-2 border-tanah-edge bg-white text-tanah-strong disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <span aria-live="polite">{t.plan.monthsShort(months)}</span>
                        <button
                          type="button"
                          aria-label={t.plan.fallowMore}
                          disabled={months >= FALLOW_MAX_MONTHS}
                          onClick={() => setFallow(index, months + 1)}
                          className="flex size-9 cursor-pointer items-center justify-center rounded-lg border-2 border-tanah-edge bg-white text-tanah-strong disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      </span>
                    ) : (
                      <span className="text-[13px] text-muted">{months ? t.plan.referenceMonths(months) : ""}</span>
                    )}
                    {timing && <span className="mt-1 pr-1 text-xs text-muted">
                      {formatMonth(timing.start, lang, "short")} – {formatMonth(timing.end, lang, "short")}
                    </span>}
                    {timing?.outside && <span className="pr-1 text-xs font-bold text-tanah-strong">{t.plan.outside}</span>}
                    {timing?.continues && <span className="pr-1 text-xs font-bold text-tanah-strong">{t.plan.continues}</span>}
                  </li>
                );
              })}
            </ol>
          )}

          {crops === null && !cropsFailed && (
            <p role="status" className="m-0 text-sm text-muted">
              {t.plan.cropsLoading}
            </p>
          )}
          {cropsFailed && (
            <p role="alert" className="m-0 flex flex-wrap items-center gap-3 text-sm text-tanah-strong">
              {t.plan.cropsFailed}
              <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={onRetry}>
                {t.plan.retry}
              </button>
            </p>
          )}
          {crops && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-sm text-muted">{t.plan.choices}</span>
              {crops.map((crop) => (
                <button
                  key={crop.crop_id}
                  type="button"
                  disabled={full || covered}
                  onClick={() => add(crop)}
                  className={`btn-secondary min-h-10 px-3 text-sm ${crop.crop_id === "bera" ? "text-tanah-strong" : ""}`}
                >
                  {crop.nama}
                </button>
              ))}
            </div>
          )}
          {preview && preview.total > 0 && <div role="status" className="space-y-1 rounded-lg bg-canvas p-3 text-[13px] text-muted">
            <p className="m-0 font-bold text-ink">{t.plan.patternTotal(preview.total)}</p>
            {preview.outside > 0 && <p className="m-0 text-tanah-strong">{t.plan.outsideNote(preview.outside)}</p>}
            {preview.total < horizon && <p className="m-0">{t.plan.repeatNote}</p>}
            {covered && !full && <p className="m-0">{t.plan.periodFilled}</p>}
          </div>}
          {full && <p className="m-0 text-[13px] text-muted">{t.plan.full}</p>}
        </>
      )}
    </section>
  );
}
