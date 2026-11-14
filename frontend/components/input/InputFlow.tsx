"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LocationResult } from "@field-atlas/shared";
import AppHeader from "@/components/shell/AppHeader";
import AskAiDock from "@/components/shell/AskAiDock";
import MapPicker, { MIN_DRAW_ZOOM, type MapPickerHandle } from "./MapPicker";
import LocationSearch from "./LocationSearch";
import RotationBuilder from "./RotationBuilder";
import TimeControl from "./TimeControl";
import WaterSourceToggle from "./WaterSourceToggle";
import { fetchCrops } from "@/lib/api";
import { measure } from "@/lib/geo";
import { dictionary, formatCenter, formatHectares } from "@/lib/i18n";
import {
  parsePlan,
  polygonFromRing,
  resultsHref,
  serializePlan,
  startMonthOptions,
  toAnalysisInput,
  type PlanState,
} from "@/lib/query";
import type { Crop, Lang, OpenRing } from "@/lib/types";

const URL_SYNC_MS = 300;

export default function InputFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const [now] = useState(() => new Date());
  const urlKey = params.toString();
  // Local state is the source of truth while the user edits, so quick taps
  // never read a stale URL. The URL follows after a short pause (the field
  // boundary changes on every vertex drag) and is read back on navigation.
  const [plan, setPlan] = useState<PlanState>(() => parsePlan(new URLSearchParams(urlKey), now));
  const written = useRef(urlKey);
  const t = dictionary(plan.lang);
  const monthOptions = useMemo(() => startMonthOptions(now), [now]);
  const map = useRef<MapPickerHandle>(null);

  const [crops, setCrops] = useState<Crop[] | null>(null);
  const [cropsFailed, setCropsFailed] = useState(false);
  const [cropsAttempt, setCropsAttempt] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [invalid, setInvalid] = useState(false);

  const measured = useMemo(() => {
    if (!plan.area) return null;
    try {
      return measure(polygonFromRing(plan.area));
    } catch {
      return null;
    }
  }, [plan.area]);
  const analysisInput = toAnalysisInput(plan);

  function href(next: PlanState) {
    return `/?${serializePlan(next)}`;
  }

  function replacePlan(change: Partial<PlanState>) {
    setPlan((current) => ({ ...current, ...change }));
  }

  useEffect(() => {
    if (urlKey === written.current) return;
    written.current = urlKey;
    setPlan(parsePlan(new URLSearchParams(urlKey), now));
  }, [urlKey, now]);

  useEffect(() => {
    const next = serializePlan(plan).toString();
    if (next === written.current) return;
    const timer = setTimeout(() => {
      written.current = next;
      router.replace(`/?${next}`, { scroll: false });
    }, URL_SYNC_MS);
    return () => clearTimeout(timer);
  }, [plan, router]);

  useEffect(() => {
    document.documentElement.lang = plan.lang;
  }, [plan.lang]);

  useEffect(() => {
    const controller = new AbortController();
    setCrops(null);
    setCropsFailed(false);
    fetchCrops(plan.lang, controller.signal)
      .then(setCrops)
      .catch(() => {
        if (!controller.signal.aborted) setCropsFailed(true);
      });
    return () => controller.abort();
  }, [plan.lang, cropsAttempt]);

  function onAreaChange(ring: OpenRing | null) {
    setInvalid(false);
    setPlan((current) => ({ ...current, area: ring, step: ring ? current.step : 1 }));
  }

  function onSearchSelect(result: LocationResult) {
    map.current?.flyTo(result.center as [number, number], Math.max(result.zoom, 15));
  }

  const step = plan.step;
  const canDraw = zoom >= MIN_DRAW_ZOOM;
  const stepOneHint = drawing ? t.land.drawing : canDraw ? null : t.land.zoomFirst;

  return (
    <div className="flex h-dvh flex-col bg-canvas text-ink">
      <AppHeader t={t} lang={plan.lang} step={step} onLangChange={(lang: Lang) => replacePlan({ lang })} />

      <main className={`relative flex-1 ${step === 2 ? "overflow-y-auto lg:overflow-hidden" : "flex flex-col overflow-hidden lg:block"}`}>
        <div
          className={
            step === 1
              ? "relative flex-1 lg:absolute lg:inset-0"
              : "relative h-56 lg:absolute lg:inset-y-0 lg:left-[560px] lg:right-0 lg:h-auto"
          }
        >
          <MapPicker
            ref={map}
            t={t}
            initialArea={plan.area}
            editable={step === 1}
            onAreaChange={onAreaChange}
            onDrawingChange={setDrawing}
            onZoomChange={setZoom}
            onInvalidBoundary={() => setInvalid(true)}
          />
          {step === 2 && measured && (
            <div className="surface absolute left-3 top-3 flex items-center gap-3 py-1.5 pl-4 pr-1.5 lg:left-5 lg:top-5">
              <span className="text-[15px]">
                <b className="font-bold">{t.land.yourLand}</b>{" "}
                <span className="text-muted">· {formatHectares(measured.areaHectares, plan.lang)} ha</span>
              </span>
              <Link href={href({ ...plan, step: 1 })} className="btn-secondary min-h-10 px-3 text-sm">
                {t.plan.changeLand}
              </Link>
            </div>
          )}
        </div>

        {step === 1 ? (
          <>
            <LocationSearch
              t={t}
              onSelect={onSearchSelect}
              className="absolute inset-x-3 top-3 lg:left-[420px] lg:right-[96px] lg:top-5 lg:mx-auto lg:max-w-[480px]"
            />
            <div className="pointer-events-none relative p-2 lg:absolute lg:inset-0 lg:p-0">
              <AskAiDock t={t} launcherClassName="pointer-events-auto absolute -top-16 right-3 lg:top-auto lg:bottom-11 lg:right-5" />
              <section
                aria-labelledby="lahan-judul"
                className="surface pointer-events-auto flex w-full flex-col gap-3 p-4 lg:absolute lg:bottom-5 lg:left-5 lg:top-5 lg:w-[380px] lg:gap-0 lg:p-0"
              >
                <div className="lg:px-6 lg:pt-6">
                  <h1 id="lahan-judul" className="m-0 text-xl font-bold tracking-tight text-ink-strong lg:text-[26px]">
                    {measured ? t.land.yourLand : t.land.title}
                  </h1>
                  <p className="m-0 mt-1 hidden text-[15px] text-muted lg:block">{t.land.subtitle}</p>
                </div>

                <ol className="m-0 mx-6 mt-5 hidden list-none flex-col gap-3 p-0 lg:flex">
                  {[
                    [t.land.searchStep, t.land.searchStepHint],
                    [t.land.drawStep, t.land.drawStepHint],
                    [t.land.checkStep, t.land.checkStepHint],
                  ].map(([title, hint], index) => {
                    const done = measured ? index < 2 : false;
                    const current = measured ? index === 2 : index === (drawing ? 1 : 0);
                    return (
                      <li key={title} className="flex items-start gap-3">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${
                            current
                              ? "border-b-[3px] border-sawah-lip bg-sawah text-white"
                              : done
                                ? "bg-sawah-tint text-sawah-lip"
                                : "border-2 border-control text-muted"
                          }`}
                        >
                          {done ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : index + 1}
                        </span>
                        <span className="text-[15px] leading-snug">
                          <b className="font-bold">{title}</b>
                          <br />
                          <span className="text-muted">{hint}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>

                {measured ? (
                  <div className="flex flex-col gap-2 lg:mx-6 lg:mt-5 lg:rounded-xl lg:bg-canvas lg:p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-muted">{t.land.area}</span>
                      <span className="text-[30px] font-bold tracking-tight text-sawah lg:text-[34px]">
                        {formatHectares(measured.areaHectares, plan.lang)} <span className="text-base">ha</span>
                      </span>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted">{t.land.center}</span>
                      <span className="font-bold">{formatCenter(measured.centroid, plan.lang)}</span>
                    </div>
                  </div>
                ) : (
                  stepOneHint && (
                    <p role="status" className="m-0 text-sm text-muted lg:mx-6 lg:mt-5">
                      {stepOneHint}
                    </p>
                  )
                )}

                {invalid && (
                  <p role="alert" className="m-0 text-sm text-tanah-strong lg:mx-6 lg:mt-3">
                    {t.land.invalid}
                  </p>
                )}

                <div className="lg:mx-6 lg:mt-3">
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    disabled={!canDraw || drawing}
                    onClick={() => map.current?.startDrawing()}
                  >
                    {measured ? t.land.redraw : t.land.startDraw}
                  </button>
                </div>

                <p className="m-0 mx-6 mt-3 hidden text-[13px] leading-normal text-muted lg:block">{t.land.climateNote}</p>

                <div className="lg:mt-auto lg:px-6 lg:pb-6 lg:pt-4">
                  {measured ? (
                    <Link href={href({ ...plan, step: 2 })} className="btn-primary min-h-14 w-full text-[17px]">
                      {t.land.next}
                    </Link>
                  ) : (
                    <button type="button" disabled className="btn-primary min-h-14 w-full text-[17px]">
                      {t.land.next}
                    </button>
                  )}
                </div>
              </section>
            </div>
          </>
        ) : (
          <>
            <aside
              aria-labelledby="rencana-judul"
              className="flex flex-col bg-surface lg:absolute lg:inset-y-0 lg:left-0 lg:w-[560px] lg:border-r-2 lg:border-hairline"
            >
              <div className="flex flex-col gap-5 px-4 pb-6 pt-5 lg:flex-1 lg:overflow-y-auto lg:px-8 lg:pt-6">
                <div>
                  <h1 id="rencana-judul" className="m-0 text-2xl font-bold tracking-tight text-ink-strong lg:text-[26px]">
                    {t.plan.title}
                  </h1>
                  <p className="m-0 mt-1.5 text-[15px] text-muted">{t.plan.subtitle}</p>
                </div>
                <RotationBuilder
                  t={t}
                  crops={crops}
                  cropsFailed={cropsFailed}
                  onRetry={() => setCropsAttempt((n) => n + 1)}
                  hasPattern={plan.hasPattern}
                  stages={plan.stages}
                  onChange={(next) => replacePlan(next)}
                />
                <TimeControl
                  t={t}
                  lang={plan.lang}
                  horizon={plan.horizon}
                  startMonth={plan.startMonth}
                  monthOptions={monthOptions}
                  onChange={(next) => replacePlan(next)}
                />
                <WaterSourceToggle t={t} value={plan.water} onChange={(water) => replacePlan({ water })} />
                <p className="m-0 text-[13px] text-muted">{t.disclaimer}</p>
              </div>
              <div className="sticky bottom-0 flex flex-col gap-2 border-t-2 border-hairline bg-surface px-3 py-3 lg:static lg:px-8 lg:pb-6 lg:pt-4">
                {!analysisInput && <p className="m-0 text-[13px] text-muted">{t.plan.missing}</p>}
                <div className="flex gap-2.5">
                  <Link href={href({ ...plan, step: 1 })} className="btn-secondary min-h-14 px-5">
                    {t.plan.back}
                  </Link>
                  {analysisInput ? (
                    <Link href={resultsHref(plan)} className="btn-primary min-h-14 flex-1 text-[17px]">
                      {t.plan.compare}
                    </Link>
                  ) : (
                    <button type="button" disabled className="btn-primary min-h-14 flex-1 text-[17px]">
                      {t.plan.compare}
                    </button>
                  )}
                </div>
              </div>
            </aside>
            <AskAiDock
              t={t}
              launcherClassName="fixed bottom-[104px] right-3 z-10 lg:absolute lg:bottom-5 lg:right-5"
            />
          </>
        )}
      </main>
    </div>
  );
}
