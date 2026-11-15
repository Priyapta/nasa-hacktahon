"use client";

import { useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Polygon } from "geojson";
import { Logo } from "@/components/shell/AppHeader";
import SatelliteThumb from "@/components/account/SatelliteThumb";
import { CROP_LOOK } from "@/components/results/FieldSeason";
import { useSession } from "@/hooks/useSession";
import { dictionary, formatHectares } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

const PHOTO_W = 1120;
const PHOTO_H = 1400;
// Outline of one rice plot in the hero photo, in photo pixels.
const PLOT = "767,667 928,699 896,893 727,856";
// Real field near Purwodadi, the soil sample used by the backend tests.
const SAMPLE: Polygon = {
  type: "Polygon",
  coordinates: [[[110.90732956034972, -7.089099980393409], [110.90736359463493, -7.088560991222937], [110.90682045402073, -7.088560991222937], [110.90678641910013, -7.089099980393409], [110.90732956034972, -7.089099980393409]]],
};
// Grobogan on the 93 to 143 E, 12 S to 8 N map.
const PIN = { left: 35.82, top: 75.45 };
// Median monthly rain in Purwodadi, Nov to Oct, from the analysis fixture.
const RAIN = [235, 293, 296, 363, 224, 192, 121, 109, 31, 46, 118, 155];
const RAIN_COLOR = (mm: number) => (mm >= 200 ? "#5E9FCC" : mm >= 60 ? "#8FB3A0" : "#D9A27F");

const heroStage: CSSProperties = {
  position: "absolute", left: "50%", top: "var(--stage-top)", transform: "translate(-50%, -50%)",
  width: `max(100cqw, calc(100cqh * ${PHOTO_W} / ${PHOTO_H}))`, aspectRatio: `${PHOTO_W} / ${PHOTO_H}`,
};

function Header({ lang }: { lang: Lang }) {
  const t = dictionary(lang).landing;
  const router = useRouter();
  const { user } = useSession();
  return (
    <header className="relative z-10 mx-auto flex min-h-[76px] w-full max-w-[1200px] items-center gap-6 px-4 sm:px-8">
      <Link href={`/?lang=${lang}`} className="flex items-center gap-2.5 text-xl font-bold text-white no-underline"><Logo size={30} />TANI</Link>
      <nav aria-label={lang === "en" ? "Page sections" : "Bagian halaman"} className="hidden flex-1 justify-center gap-7 md:flex">
        <a href="#indonesia" className="text-[15px] text-[#e3ede6] no-underline hover:text-white">{t.navIndonesia}</a>
        <a href="#cara-kerja" className="text-[15px] text-[#e3ede6] no-underline hover:text-white">{t.navSteps}</a>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <div role="group" aria-label={t.language} className="flex rounded-md bg-black/25 p-1">
          {(["id", "en"] as const).map((code) => (
            <button key={code} type="button" aria-pressed={lang === code} onClick={() => router.replace(`/?lang=${code}`, { scroll: false })}
              className={`min-h-9 rounded-sm px-2.5 text-sm font-bold ${lang === code ? "bg-white text-sawah-lip" : "text-white"}`}>{code.toUpperCase()}</button>
          ))}
        </div>
        <Link href={user ? `/akun?lang=${lang}` : `/login?lang=${lang}`} className="btn-secondary min-h-11 border-white px-4 text-[15px]">{user ? t.myFields : t.signIn}</Link>
      </div>
    </header>
  );
}

function Hero({ lang }: { lang: Lang }) {
  const t = dictionary(lang).landing;
  return (
    <section aria-labelledby="hero-title" className="relative h-[640px] overflow-hidden bg-[#2e5a22] text-white [--stage-top:50%] md:h-[800px] md:[--stage-top:34%]" style={{ containerType: "size" }}>
      <div style={heroStage}>
        <img src="/images/login-sawah.jpg" alt={t.heroImage} width={PHOTO_W} height={PHOTO_H} className="absolute inset-0 h-full w-full brightness-[0.66] saturate-[0.95]" />
        <svg viewBox={`0 0 ${PHOTO_W} ${PHOTO_H}`} className="absolute inset-0 hidden h-full w-full md:block" aria-hidden="true">
          <polygon points={PLOT} fill="#c3e77a" fillOpacity="0.26" stroke="#c3e77a" strokeWidth="3.5" strokeLinejoin="round" />
          {PLOT.split(" ").map((pt) => { const [x, y] = pt.split(",").map(Number); return <rect key={pt} x={x - 6} y={y - 6} width="12" height="12" rx="4" fill="#fff" stroke="#145a37" strokeWidth="3" />; })}
        </svg>
        <span className="absolute hidden -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white px-3 py-1.5 text-[15px] font-bold text-sawah-lip md:block" style={{ left: "74.06%", top: "55.6%" }}>
          {formatHectares(0.59, lang)} ha
        </span>
      </div>
      <Header lang={lang} />
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pt-20 sm:px-8 md:pt-[clamp(96px,11vw,168px)]">
        <h1 id="hero-title" className="m-0 max-w-[9.5em] text-[44px] font-bold leading-none tracking-[-0.03em] [text-shadow:0_2px_24px_rgba(0,0,0,0.3)] md:text-[clamp(48px,5.6vw,76px)]">{t.heroTitle}</h1>
        <Link href={`/lahan?lang=${lang}`} className="btn-primary self-start">{t.start}</Link>
      </div>
    </section>
  );
}

function Indonesia({ lang }: { lang: Lang }) {
  const t = dictionary(lang).landing;
  const columns = <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block"><div className="mx-auto grid h-full max-w-[1200px] grid-cols-4 px-8">{[0, 1, 2, 3].map((i) => <span key={i} className="border-l-[1.5px] border-dashed border-[#e6e7e0] last:border-r-[1.5px]" />)}</div></div>;
  return (
    <section id="indonesia" aria-labelledby="indo-title" className="relative border-t-2 border-hairline bg-white pt-16 md:pt-24">
      {columns}
      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-4">
            <h2 id="indo-title" className="m-0 max-w-[15em] text-[30px] font-bold leading-tight tracking-tight text-ink-strong md:text-[42px]">{t.indoTitle}</h2>
          </div>
          <p className="m-0 min-w-0 flex-[0_1_400px] text-[17px] leading-relaxed text-muted">{t.indoLead}</p>
        </div>
        <div className="relative mt-8 md:mb-24 md:mt-14">
          <img src="/images/peta-indonesia.svg" alt={t.mapAlt} width={1500} height={600} className="block h-auto w-full [mask-image:linear-gradient(90deg,transparent,#000_3%,#000_97%,transparent)]" />
          <span className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-sawah bg-white shadow-[0_0_0_10px_rgba(46,139,87,0.18),0_0_0_22px_rgba(46,139,87,0.08)]" style={{ left: `${PIN.left}%`, top: `${PIN.top}%` }} />
          <div className="absolute hidden w-[330px] -rotate-2 gap-3.5 rounded-[18px] bg-white p-3.5 shadow-[0_1px_2px_rgba(22,32,27,0.06),0_24px_48px_rgba(22,32,27,0.14)] md:flex"
            style={{ left: `calc(${PIN.left}% + 30px)`, top: `calc(${PIN.top}% + 26px)` }}>
            <div className="w-[76px] shrink-0 overflow-hidden rounded-md"><SatelliteThumb location={SAMPLE} width={160} height={160} credit={false} /></div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-bold text-ink-strong">{t.cardTitle}</span>
              <span className="text-xs leading-snug text-muted">{t.cardText}</span>
              <div aria-hidden="true" className="grid h-7 grid-cols-12 items-end gap-0.5">
                {RAIN.map((mm, i) => <span key={i} className="rounded-[2px]" style={{ height: Math.max(3, Math.round((mm / 363) * 28)), background: RAIN_COLOR(mm) }} />)}
              </div>
              <span className="text-[11px] text-[#6a746d]">{t.cardSource}</span>
            </div>
          </div>
        </div>
        <dl className="relative m-0 grid grid-cols-2 md:grid-cols-4">
          {t.stats.map((stat) => (
            <div key={stat.value} className="flex flex-col items-center gap-2 px-3 pb-10 pt-7 text-center">
              <dt className="order-2 max-w-[15em] text-sm leading-snug text-[#4a5650]">{stat.label}</dt>
              <dd className="order-1 m-0 text-[28px] font-bold leading-tight tracking-tight text-ink-strong [text-wrap:balance] md:text-[clamp(28px,2.6vw,40px)]">{stat.value}</dd>
              <dd className="order-3 m-0 text-xs text-[#6a746d]">{stat.source}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Steps({ lang }: { lang: Lang }) {
  const t = dictionary(lang).landing;
  const crops = dictionary(lang).results.crops;
  const strips: [string, number][][] = [
    [["padi_sawah", 8], ["bera", 4]],
    [["padi_sawah", 4], ["jagung", 4], ["bera", 4]],
    [["padi_sawah", 4], ["kacang_hijau", 2], ["bera", 6]],
  ];
  const visuals = [
    <SatelliteThumb key="map" location={SAMPLE} />,
    <div key="plan" className="flex aspect-[400/170] flex-col justify-center gap-3 bg-canvas p-5">
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-sawah px-3 py-1.5 text-[13px] font-bold text-white">{crops.padi_sawah}</span>
        <span className="rounded-full bg-sawah px-3 py-1.5 text-[13px] font-bold text-white">{crops.padi_sawah}</span>
        <span className="rounded-full border-2 border-dashed border-[#cf9a7b] bg-[#f8e9df] px-3 py-1 text-[13px] font-bold text-[#8e4220]">{t.fallowMonths}</span>
      </div>
      <div className="flex flex-wrap gap-1" aria-hidden="true">
        {[6, 12, 18, 24].map((n) => <span key={n} className={`rounded-full px-3 py-1.5 text-[13px] font-bold ${n === 12 ? "bg-sawah text-white" : "border-2 border-control bg-white text-ink"}`}>{n === 12 ? `12 ${t.monthsShort}` : n}</span>)}
        <span className="rounded-full bg-[#e1ecf5] px-3 py-1.5 text-[13px] font-bold text-[#134a6e]">{t.rainfed}</span>
      </div>
    </div>,
    <div key="results" className="flex aspect-[400/170] flex-col justify-center gap-2.5 bg-canvas p-5" aria-hidden="true">
      {strips.map((strip, i) => (
        <div key={i} className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
          <span className="text-xs font-bold">{t.strategies[i]}</span>
          <div className="grid grid-cols-12 gap-0.5">{strip.map(([crop, months], j) => <span key={j} className="h-3 rounded-[4px]" style={{ gridColumn: `span ${months}`, background: CROP_LOOK[crop].bg, border: crop === "bera" ? "2px dashed #cf9a7b" : undefined }} />)}</div>
        </div>
      ))}
    </div>,
  ];
  return (
    <section id="cara-kerja" aria-labelledby="steps-title" className="py-16 md:py-24">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 sm:px-8">
        <h2 id="steps-title" className="m-0 text-[30px] font-bold leading-tight tracking-tight text-ink-strong md:text-[42px]">{t.stepsTitle}</h2>
        <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
          {t.steps.map((step, i) => (
            <li key={step.title} className="surface flex flex-col overflow-hidden">
              <div className="border-b-2 border-hairline">{visuals[i]}</div>
              <div className="flex flex-col gap-2.5 p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-[#eaf5d2] text-[15px] font-bold text-[#2f5a12]">{i + 1}</span>
                <h3 className="m-0 text-[21px] font-bold text-ink-strong">{step.title}</h3>
                <p className="m-0 text-[15px] leading-relaxed text-[#4a5650]">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Closing({ lang }: { lang: Lang }) {
  const t = dictionary(lang).landing;
  return (
    <>
      <section aria-labelledby="closing-title" className="relative overflow-hidden bg-[#0f1612] py-20 text-white md:py-28">
        <img src="/images/peta-asia-pasifik-gelap.svg" alt="" width={1400} height={720}
          className="absolute -right-[6%] top-1/2 hidden w-[72%] -translate-y-1/2 [mask-image:radial-gradient(ellipse_75%_80%_at_50%_50%,#000_55%,transparent_100%)] md:block" />
        <div className="relative mx-auto flex max-w-[1200px] flex-col gap-5 px-4 sm:px-8">
          <h2 id="closing-title" className="m-0 max-w-[11em] text-[34px] font-bold leading-[1.05] tracking-tight md:text-[clamp(36px,4.2vw,58px)]">{t.closingTitle}</h2>
          <p className="m-0 max-w-[26em] text-[17px] leading-relaxed text-[#b8c4bc]">{t.closingLead}</p>
          <Link href={`/lahan?lang=${lang}`} className="btn-primary self-start border-b-[#8db04a] bg-[#c3e77a] text-ink-strong hover:bg-[#b5dc66]">{t.start}</Link>
        </div>
      </section>
      <footer className="border-t-2 border-hairline bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-7 text-[13px] text-muted sm:px-8 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <span className="flex items-center gap-2.5 text-[17px] font-bold text-ink-strong"><Logo size={26} />TANI</span>
          <span>{t.footerData}</span>
          <span>{t.footerProject}</span>
          <p className="m-0 basis-full text-xs">{t.credit}</p>
        </div>
      </footer>
    </>
  );
}

export default function Landing() {
  const params = useSearchParams();
  const lang: Lang = params.get("lang") === "en" ? "en" : "id";
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <Hero lang={lang} />
      <main>
        <Indonesia lang={lang} />
        <Steps lang={lang} />
      </main>
      <Closing lang={lang} />
    </div>
  );
}
