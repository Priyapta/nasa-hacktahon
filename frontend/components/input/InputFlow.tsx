"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import anime from "animejs";
import Link from "next/link";
import { Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LocationResult } from "@field-atlas/shared";
import AgentChat from "@/components/agent/agent-chat";
import MapPicker, { MIN_DRAW_ZOOM, type MapPickerHandle } from "./MapPicker";
import LocationSearch from "./LocationSearch";
import RotationBuilder from "./RotationBuilder";
import TimeControl from "./TimeControl";
import WaterSourceToggle from "./WaterSourceToggle";
import { fetchCrops } from "@/lib/api";
import { measure } from "@/lib/geo";
import { previewPattern } from "@/lib/plan-preview";
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
import type { Crop, OpenRing } from "@/lib/types";

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
  const mapFrame = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const cardContent = useRef<HTMLDivElement>(null);
  const transitionFrom = useRef<{
    bounds: DOMRect;
    borderRadius: string;
    borderTopWidth: string;
    borderRightWidth: string;
    borderBottomWidth: string;
    borderLeftWidth: string;
    focusHeading: boolean;
  } | null>(null);

  function captureLayout() {
    if (!card.current) return;
    const style = getComputedStyle(card.current);
    transitionFrom.current = {
      bounds: card.current.getBoundingClientRect(),
      borderRadius: style.borderTopLeftRadius,
      borderTopWidth: style.borderTopWidth,
      borderRightWidth: style.borderRightWidth,
      borderBottomWidth: style.borderBottomWidth,
      borderLeftWidth: style.borderLeftWidth,
      focusHeading: document.activeElement?.matches(":focus-visible") ?? false,
    };
  }

  useLayoutEffect(() => {
    const from = transitionFrom.current;
    transitionFrom.current = null;
    const element = card.current;
    const content = cardContent.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!from || !element || !content) return;
    if (plan.step === 1) element.closest("main")?.scrollTo({ top: 0, behavior: "instant" });
    if (from.focusHeading) element.querySelector("h1")?.focus({ preventScroll: true });
    if (motion.matches) return;

    const to = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const left = parseFloat(style.left) || 0;
    const top = parseFloat(style.top) || 0;
    const elements: HTMLElement[] = [element, content];
    const mapElement = mapFrame.current;
    const freezeMap = mapElement && !window.matchMedia("(min-width: 1024px)").matches;
    if (freezeMap) elements.push(mapElement);
    const originalStyles = elements.map((node) => node.style.cssText);
    if (freezeMap) {
      const height = mapElement.getBoundingClientRect().height;
      mapElement.style.flex = "none";
      mapElement.style.height = `${height}px`;
    }
    const contentBounds = content.getBoundingClientRect();
    content.style.width = `${contentBounds.width}px`;
    content.style.height = `${contentBounds.height}px`;
    content.style.flex = "none";
    element.style.overflow = "hidden";

    function finish() {
      animation.pause();
      elements.forEach((node, index) => { node.style.cssText = originalStyles[index]; });
      window.removeEventListener("resize", finish);
      motion.removeEventListener("change", finish);
    }

    const animation = anime.timeline({
      duration: 1000,
      easing: "cubicBezier(0.22, 1, 0.36, 1)",
      autoplay: false,
      complete: finish,
    });
    animation.add({
      targets: element,
      width: [from.bounds.width, to.width],
      height: [from.bounds.height, to.height],
      left: [left + from.bounds.left - to.left, left],
      top: [top + from.bounds.top - to.top, top],
      borderRadius: [from.borderRadius, style.borderTopLeftRadius],
      borderTopWidth: [from.borderTopWidth, style.borderTopWidth],
      borderRightWidth: [from.borderRightWidth, style.borderRightWidth],
      borderBottomWidth: [from.borderBottomWidth, style.borderBottomWidth],
      borderLeftWidth: [from.borderLeftWidth, style.borderLeftWidth],
    }, 0);
    animation.add({ targets: content, opacity: [0, 1], duration: 180, easing: "linear" }, 100);
    window.addEventListener("resize", finish);
    motion.addEventListener("change", finish);
    animation.play();
    return finish;
  }, [plan.step]);

  function navigateStep(event: { preventDefault: () => void }, step: 1 | 2) {
    event.preventDefault();
    if (step === plan.step || transitionFrom.current) return;
    captureLayout();
    const next = { ...plan, step };
    written.current = serializePlan(next).toString();
    setPlan(next);
    router.push(href(next), { scroll: false });
  }

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
  const patternPreview = crops ? previewPattern(plan.stages, crops, plan.startMonth, plan.horizon) : null;
  const outsidePeriod = plan.hasPattern && Boolean(patternPreview?.outside);
  const patternBlocked = plan.hasPattern && (!patternPreview || cropsFailed || outsidePeriod);
  const analysisInput = patternBlocked ? null : toAnalysisInput(plan);

  function href(next: PlanState) {
    return `/lahan?${serializePlan(next)}`;
  }

  function replacePlan(change: Partial<PlanState>) {
    setPlan((current) => ({ ...current, ...change }));
  }

  useEffect(() => {
    if (urlKey === written.current) return;
    written.current = urlKey;
    const next = parsePlan(new URLSearchParams(urlKey), now);
    if (next.step !== plan.step) captureLayout();
    setPlan(next);
  }, [urlKey, now]);

  useEffect(() => {
    const next = serializePlan(plan).toString();
    if (next === written.current) return;
    const timer = setTimeout(() => {
      written.current = next;
      router.replace(`/lahan?${next}`, { scroll: false });
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
  const stepOneHint = drawing ? t.land.drawing : canDraw ? t.land.drawReady : t.land.zoomFirst;

  return (
    <div className="flex h-full flex-col bg-canvas text-ink">

      <main className={`relative flex-1 ${step === 2 ? "overflow-y-auto lg:overflow-hidden" : "flex flex-col overflow-hidden lg:block"}`}>
        <div
          ref={mapFrame}
          className={
            step === 1
              ? "relative flex-1 lg:absolute lg:inset-0"
              : "relative h-56 lg:absolute lg:inset-0 lg:h-auto"
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
        </div>
        {step === 2 && measured && (
          <div className="surface absolute left-3 top-3 flex items-center gap-3 py-1.5 pl-4 pr-1.5 lg:left-[580px] lg:top-5">
            <span className="text-[15px]">
              <b className="font-bold">{t.land.yourLand}</b>{" "}
              <span className="text-muted">· {formatHectares(measured.areaHectares, plan.lang)} ha</span>
            </span>
            <Link href={href({ ...plan, step: 1 })} onNavigate={(event) => navigateStep(event, 1)} className="btn-secondary min-h-10 px-3 text-sm">
              {t.plan.changeLand}
            </Link>
          </div>
        )}

        {step === 1 && (
          <LocationSearch
            t={t}
            onSelect={onSearchSelect}
            className="absolute inset-x-3 top-3 lg:left-[420px] lg:right-[96px] lg:top-5 lg:mx-auto lg:max-w-[480px]"
          />
        )}
        <div className={`pointer-events-none relative lg:absolute lg:inset-0 ${step === 1 ? "p-2 lg:p-0" : ""}`}>
          <section
            ref={card}
            role={step === 2 ? "complementary" : undefined}
            aria-labelledby={step === 1 ? "lahan-judul" : "rencana-judul"}
            className={`surface pointer-events-auto relative flex flex-col lg:absolute ${step === 1 ? "w-full lg:bottom-5 lg:left-5 lg:top-5 lg:w-[380px]" : "rounded-none border-0 lg:inset-y-0 lg:left-0 lg:w-[560px] lg:border-r-2"}`}
          >
            <div ref={cardContent} className={`flex min-h-0 flex-1 flex-col ${step === 1 ? "gap-3 p-4 lg:gap-0 lg:p-0" : ""}`}>
              {step === 1 ? (
                <>
                  <div className="lg:px-6 lg:pt-6">
                    <h1 id="lahan-judul" tabIndex={-1} className="m-0 text-xl font-bold tracking-tight text-ink-strong lg:text-[26px]">
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
                      <p id="drawing-guidance" role="status" className={`m-0 rounded-lg border px-3 py-2 text-sm lg:mx-6 lg:mt-5 ${canDraw ? "border-sawah bg-sawah-tint text-sawah-lip" : "border-control-lip bg-canvas text-muted"}`}>
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
                      aria-describedby={!measured ? "drawing-guidance" : undefined}
                      disabled={!canDraw || drawing}
                      onClick={() => map.current?.startDrawing()}
                    >
                      {measured ? t.land.redraw : t.land.startDraw}
                    </button>
                  </div>

                  <div className="lg:mt-auto lg:px-6 lg:pb-6 lg:pt-4">
                    {measured ? (
                      <Link href={href({ ...plan, step: 2 })} onNavigate={(event) => navigateStep(event, 2)} className="btn-primary min-h-14 w-full text-[17px]">
                        {t.land.next}
                      </Link>
                    ) : (
                      <button type="button" disabled className="btn-primary min-h-14 w-full text-[17px]">
                        {t.land.next}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-5 px-4 pb-6 pt-5 lg:flex-1 lg:overflow-y-auto lg:px-8 lg:pt-6">
                    <div>
                      <h1 id="rencana-judul" tabIndex={-1} className="m-0 text-2xl font-bold tracking-tight text-ink-strong lg:text-[26px]">
                        {t.plan.title}
                      </h1>
                      <p className="m-0 mt-1.5 text-[15px] text-muted">{t.plan.subtitle}</p>
                    </div>
                    <RotationBuilder
                      t={t}
                      lang={plan.lang}
                      startMonth={plan.startMonth}
                      horizon={plan.horizon}
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
                  </div>
                  <div className="sticky bottom-0 flex flex-col gap-2 border-t-2 border-hairline bg-surface px-3 py-3 lg:static lg:px-8 lg:pb-6 lg:pt-4">
                    {!analysisInput && <p className="m-0 text-[13px] text-muted">{!measured ? t.land.invalid : outsidePeriod ? t.plan.outsideSubmit : plan.hasPattern && cropsFailed ? t.plan.cropsFailed : plan.hasPattern && !patternPreview ? t.plan.cropsLoading : !plan.water ? t.plan.chooseWater : t.plan.missing}</p>}
                    <div className="flex gap-2.5">
                      <Link href={href({ ...plan, step: 1 })} onNavigate={(event) => navigateStep(event, 1)} className="btn-secondary min-h-14 px-5">
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
                </>
              )}
            </div>
          </section>
        </div>
      </main>
      <AgentChat lang={plan.lang} launcherClassName={step === 2 ? "max-lg:[--agent-bottom:104px]" : ""} />
    </div>
  );
}
