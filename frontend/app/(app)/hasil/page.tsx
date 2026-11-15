"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CloudRain, PenLine, Waves } from "lucide-react";
import SaveField from "@/components/input/SaveField";
import AgentChat from "@/components/agent/agent-chat";
import FieldSeason from "@/components/results/FieldSeason";
import SoilSeasonCard from "@/components/results/SoilSeasonCard";
import { DimensionTable, Sources, StrategyCards, WhyCard } from "@/components/results/Compare";
import { ApiError } from "@/lib/api";
import { isRainValidationNote } from "@/lib/explanation-format";
import { analyze, periodYears, timeline, type AnalysisResponse } from "@/lib/analysis";
import { measure } from "@/lib/geo";
import { dictionary, formatHectares, formatMonth } from "@/lib/i18n";
import { addMonths, parsePlan, polygonFromRing, serializePlan, toAnalysisInput } from "@/lib/query";

type Load = { status: "loading" } | { status: "error"; climate: boolean } | { status: "done"; result: AnalysisResponse };

function Results() {
  const params = useSearchParams();
  const [now] = useState(() => new Date());
  const plan = useMemo(() => parsePlan(new URLSearchParams(params.toString()), now), [params, now]);
  const t = dictionary(plan.lang);
  const r = t.results;
  const input = useMemo(() => toAnalysisInput(plan), [plan]);
  const request = input ? JSON.stringify({ ...input, lang: plan.lang }) : null;
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(0);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    setLoad({ status: "loading" });
    analyze(JSON.parse(request), controller.signal)
      .then((result) => {
        setLoad({ status: "done", result });
        setSelected((s) => Math.min(s, Math.max(result.strategies.length - 1, 0)));
        setOffset((o) => Math.min(o, Math.max(JSON.parse(request).time.horizon_months - 1, 0)));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoad({ status: "error", climate: error instanceof ApiError && error.status === 502 });
      });
    return () => controller.abort();
  }, [request, attempt]);

  const back = `/lahan?${serializePlan({ ...plan, step: plan.area ? 2 : 1 })}`;
  // input is null when measure() rejects the boundary, so this call cannot throw.
  const hectares = useMemo(() => (plan.area && input ? formatHectares(measure(polygonFromRing(plan.area)).areaHectares, plan.lang) : ""), [plan.area, input, plan.lang]);
  const WaterIcon = plan.water === "irigasi" ? Waves : CloudRain;

  if (!input || !plan.area) {
    return (
      <div className="flex h-full flex-col bg-canvas text-ink">
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <section className="surface mx-auto flex max-w-xl flex-col gap-3 p-6">
            <p className="m-0 text-[15px] leading-relaxed">{r.incomplete}</p>
            <Link href={back} className="btn-secondary self-start">
              {r.back}
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const result = load.status === "done" ? load.result : null;
  const strategies = result?.strategies ?? [];
  const strategy = strategies[selected];
  const hasBaseline = strategies[0]?.role === "pola_biasa";
  const months = strategy ? timeline(strategy.calendar, plan.startMonth, plan.horizon) : [];
  const activeCalendarMonth = months[Math.min(offset, months.length - 1)]?.calendarMonth ?? Number(plan.startMonth.slice(5));
  const calendarMonths = Array.from({ length: 12 }, (_, i) => Number(addMonths(plan.startMonth, i).slice(5)));
  const [from, to] = result ? periodYears(result.context.climate.period) : ["2016", "2025"];

  return (
    <div className="flex h-full flex-col bg-canvas text-ink">
      <main className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-[22px] px-4 pb-28 pt-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="m-0 text-[28px] font-bold leading-tight tracking-tight text-ink-strong lg:text-[32px]">
                {result ? r.title(hasBaseline, strategies.length - (hasBaseline ? 1 : 0)) : r.loading}
              </h1>
              <p className="m-0 mt-1.5 text-[15px] text-muted">{r.subtitle(from, to)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <dl aria-label={r.planSummary} className="m-0 flex flex-wrap gap-x-6 gap-y-2">
                <div>
                  <dt className="text-xs font-bold text-muted">{t.plan.horizon}</dt>
                  <dd className="m-0 mt-0.5 text-[15px] font-bold">
                    {formatMonth(plan.startMonth, plan.lang, "short")} – {formatMonth(addMonths(plan.startMonth, plan.horizon - 1), plan.lang, "short")}
                    <span className="font-normal text-muted"> · {t.plan.months(plan.horizon)}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-muted">{t.plan.water}</dt>
                  <dd className="m-0 mt-0.5 flex items-center gap-1.5 text-[15px] font-bold">
                    <WaterIcon size={16} className="text-sawah" aria-hidden="true" />
                    {plan.water === "irigasi" ? t.plan.irrigated : t.plan.rainfed}
                  </dd>
                </div>
              </dl>
              <Link href={back} className="btn-secondary min-h-10 px-3 text-sm">
                <PenLine size={16} aria-hidden="true" />
                {r.back}
              </Link>
            </div>
          </div>

          <SaveField input={input} lang={plan.lang} fieldId={plan.fieldId} />

          {load.status === "loading" && (
            <section aria-busy="true" className="surface flex min-h-[420px] flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="size-10 animate-spin rounded-full border-4 border-sawah-tint border-t-sawah motion-reduce:animate-none" aria-hidden="true" />
              <p className="m-0 mt-2 text-base font-bold">{r.loading}</p>
              <p className="m-0 text-sm text-muted">{r.loadingHint}</p>
            </section>
          )}

          {load.status === "error" && (
            <section role="alert" className="surface flex flex-col items-start gap-3 p-6">
              <h2 className="m-0 text-lg font-bold">{r.errorTitle}</h2>
              <p className="m-0 text-[15px] text-muted">{load.climate ? r.errorClimate : r.errorGeneric}</p>
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={() => setAttempt((a) => a + 1)}>
                  {r.retry}
                </button>
                <Link href={back} className="btn-secondary">
                  {r.back}
                </Link>
              </div>
            </section>
          )}

          {result && !strategy && (
            <section className="surface flex flex-col gap-2 p-6">
              <p className="m-0 text-[15px] font-bold">{r.noStrategies}</p>
              {result.notes.filter((n) => !isRainValidationNote(n)).map((n) => (
                <p key={n} className="m-0 text-sm text-muted">
                  {n}
                </p>
              ))}
            </section>
          )}

          {result && strategy && (
            <>
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(300px,1fr)]">
                <div className="surface flex flex-col gap-3 px-5 pb-4 pt-[18px]">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="m-0 text-lg font-bold">
                      {r.sceneTitle} <span className="text-sawah">{strategy.label}</span>
                    </h2>
                    <span className="text-xs text-muted">{r.sceneHint}</span>
                  </div>
                  <FieldSeason
                    ring={plan.area}
                    hectares={hectares}
                    strategy={strategy}
                    monthly={result.context.climate.monthly}
                    startMonth={plan.startMonth}
                    horizon={plan.horizon}
                    offset={Math.min(offset, months.length - 1)}
                    onOffset={setOffset}
                    lang={plan.lang}
                    t={r}
                  />
                </div>
                <SoilSeasonCard
                  ring={plan.area}
                  hectares={hectares}
                  context={result.context}
                  calendarMonths={calendarMonths}
                  activeCalendarMonth={activeCalendarMonth}
                  onPickCalendarMonth={(m) => {
                    const index = months.findIndex((x) => x.calendarMonth === m);
                    if (index >= 0) setOffset(index);
                  }}
                  lang={plan.lang}
                  t={r}
                />
              </section>

              <StrategyCards strategies={strategies} selected={selected} onSelect={setSelected} startMonth={plan.startMonth} horizon={plan.horizon} t={r} />

              <section className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                <DimensionTable strategies={strategies} selected={selected} horizon={plan.horizon} t={r} />
                <WhyCard strategy={strategy} lang={plan.lang} t={r} />
              </section>

              <Sources result={result} t={r} />

            </>
          )}
        </div>
        <AgentChat lang={plan.lang} />
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="h-full bg-canvas" />}>
      <Results />
    </Suspense>
  );
}
