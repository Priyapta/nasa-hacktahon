"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, CloudRain, Plus, Trash2, Waves } from "lucide-react";
import { Logo } from "@/components/shell/AppHeader";
import { CROP_LOOK } from "@/components/results/FieldSeason";
import SatelliteThumb from "./SatelliteThumb";
import { savedFieldHref, type SavedField } from "@/lib/accounts";
import { fetchCrops } from "@/lib/api";
import { lastMonth, patternStrip, startStatus } from "@/lib/field-status";
import { measure } from "@/lib/geo";
import { dictionary, formatHectares, formatMonth } from "@/lib/i18n";
import type { Crop, Lang } from "@/lib/types";

interface Props {
  fields: SavedField[];
  lang: Lang;
  loading: boolean;
  busy: boolean;
  error: string;
  savedId: string | null;
  back: string | null;
  onRetry: () => void;
  onDelete: (field: SavedField) => void;
}

function savedDate(iso: string, lang: Lang) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(date);
}

function StatusChip({ field, lang, now }: { field: SavedField; lang: Lang; now: Date }) {
  const en = lang === "en";
  const status = startStatus(field.plan.time.start_month, now);
  const month = formatMonth(status.effective, lang, "short");
  const look = {
    this: ["bg-sawah-tint text-sawah-lip", en ? "Planting starts this month" : "Mulai tanam bulan ini"],
    next: ["bg-canvas text-ink", en ? "Planting starts next month" : "Mulai tanam bulan depan"],
    later: ["bg-canvas text-ink", en ? `Planting starts ${month}` : `Mulai tanam ${month}`],
    late: ["bg-[#f8e9df] text-[#8e4220]", en ? `Start passed, runs from ${month}` : `Jadwal lewat, dihitung dari ${month}`],
  }[status.kind];
  const Icon = status.kind === "late" ? Clock : CalendarDays;
  return <span className={`inline-flex items-center gap-1.5 self-start rounded-sm px-2.5 py-1 text-[13px] font-bold ${look[0]}`}><Icon size={15} aria-hidden="true" />{look[1]}</span>;
}

function Strip({ field, crops, lang }: { field: SavedField; crops: Crop[] | null; lang: Lang }) {
  const { start_month: start, horizon_months: horizon } = field.plan.time;
  const names = dictionary(lang).results.crops;
  const segments = crops ? patternStrip(field.plan.rotation.stages, crops, horizon) : null;
  if (!segments) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-muted"><span>{formatMonth(start, lang, "short")}</span><span>{formatMonth(lastMonth(start, horizon), lang, "short")}</span></div>
      <div role="img" aria-label={segments.map((s) => `${names[s.crop]} ${s.months} ${lang === "en" ? "months" : "bulan"}`).join(", ")}
        className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${horizon}, minmax(0, 1fr))` }}>
        {segments.map((s, i) => (
          <span key={i} className="flex h-[22px] min-w-0 items-center justify-center rounded-[5px] px-1 text-[11px] font-bold"
            style={{ gridColumn: `span ${s.months}`, background: CROP_LOOK[s.crop].bg, color: CROP_LOOK[s.crop].ink, border: s.crop === "bera" ? "2px dashed #cf9a7b" : undefined }}>
            <span className="truncate">{s.months >= 2 ? names[s.crop] : ""}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FieldCard({ field, crops, lang, busy, now, onDelete }: { field: SavedField; crops: Crop[] | null; lang: Lang; busy: boolean; now: Date; onDelete: (field: SavedField) => void }) {
  const en = lang === "en";
  const hectares = measure(field.plan.location).areaHectares;
  const irrigated = field.plan.water_source === "irigasi";
  const saved = savedDate(field.created_at, lang);
  return (
    <li className="surface flex min-w-0 flex-col overflow-hidden">
      <div className="relative">
        <SatelliteThumb location={field.plan.location} />
        <span className="absolute right-3 top-3 rounded-sm bg-white px-2.5 py-1 text-sm font-bold text-sawah-lip">{formatHectares(hectares, lang)} ha</span>
      </div>
      <div className="flex flex-1 flex-col gap-3.5 p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 break-words text-xl font-bold text-ink-strong">{field.name}</h2>
          {saved && <span className="text-[13px] text-muted">{en ? `Saved ${saved}` : `Disimpan ${saved}`}</span>}
        </div>
        <StatusChip field={field} lang={lang} now={now} />
        <Strip field={field} crops={crops} lang={lang} />
        <div className="flex flex-wrap gap-2 text-[13px] font-bold">
          <span className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 ${irrigated ? "bg-sawah-tint text-sawah-lip" : "bg-[#e1ecf5] text-[#1e4e79]"}`}>
            {irrigated ? <Waves size={15} aria-hidden="true" /> : <CloudRain size={15} aria-hidden="true" />}
            {irrigated ? (en ? "Irrigated" : "Irigasi") : (en ? "Rainfed" : "Tadah hujan")}
          </span>
          <span className="rounded-sm bg-canvas px-2.5 py-1 text-ink">{field.plan.time.horizon_months} {en ? "months" : "bulan"}</span>
        </div>
        <div className="mt-auto flex gap-2 pt-1">
          <Link prefetch={false} href={savedFieldHref(field, now)} className="btn-primary flex-1">{en ? "View results" : "Lihat hasil"}</Link>
          <button className="btn-secondary w-12 px-0" disabled={busy} onClick={() => onDelete(field)} aria-label={`${en ? "Delete" : "Hapus"} ${field.name}`}>
            <Trash2 size={18} className="text-[#8e4220]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function Dashboard({ fields, lang, loading, busy, error, savedId, back, onRetry, onDelete }: Props) {
  const en = lang === "en";
  const newField = `/?lang=${lang}`;
  const saved = fields.find((field) => field.id === savedId);
  const [now] = useState(() => new Date());
  const [crops, setCrops] = useState<Crop[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchCrops(lang, controller.signal).then(setCrops).catch(() => {});
    return () => controller.abort();
  }, [lang]);

  const summary = useMemo(() => {
    const hectares = fields.reduce((sum, field) => sum + measure(field.plan.location).areaHectares, 0);
    const irrigated = fields.filter((field) => field.plan.water_source === "irigasi").length;
    const rainfed = fields.length - irrigated;
    const water = [rainfed && `${rainfed} ${en ? "rainfed" : "tadah hujan"}`, irrigated && `${irrigated} ${en ? "irrigated" : "irigasi"}`].filter(Boolean).join(" · ");
    return { hectares, water };
  }, [fields, en]);

  return (
    <div className="min-h-full bg-canvas text-ink">
      <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="m-0 mb-1.5 text-sm text-muted">{en ? "Your farming space" : "Ruang tani Anda"}</p><h1 className="m-0 text-3xl font-bold tracking-tight text-ink-strong">{en ? "My fields" : "Lahan saya"}</h1></div>
            <Link href={newField} className="btn-primary"><Plus size={18} aria-hidden="true" />{en ? "Add field" : "Tambah lahan"}</Link>
          </div>

          {saved && !loading && <p role="status" className="m-0 rounded-md bg-sawah-tint px-4 py-3 text-sm font-bold text-sawah-lip">{en ? `“${saved.name}” has been saved.` : `“${saved.name}” sudah tersimpan.`}</p>}
          {error && <div role="alert" className="surface flex flex-wrap items-center justify-between gap-3 p-4"><p className="m-0">{error}</p><button className="btn-secondary" disabled={busy} onClick={onRetry}>{en ? "Retry" : "Coba lagi"}</button></div>}

          {loading ? <p role="status" className="surface m-0 p-6">{en ? "Loading your fields…" : "Memuat lahan Anda…"}</p> : fields.length ? (
            <>
              <p className="m-0 -mt-3 text-sm text-muted sm:hidden">{fields.length} {en ? "fields" : "lahan"} · {formatHectares(summary.hectares, lang)} ha · {summary.water}</p>
              <dl className="m-0 hidden gap-3 sm:grid sm:grid-cols-3">
                <div className="surface flex flex-col gap-1 px-[18px] py-3.5"><dt className="text-[13px] text-muted">{en ? "Saved fields" : "Lahan tersimpan"}</dt><dd className="m-0 text-[26px] font-bold text-ink-strong">{fields.length}</dd></div>
                <div className="surface flex flex-col gap-1 px-[18px] py-3.5"><dt className="text-[13px] text-muted">{en ? "Total area" : "Total luas"}</dt><dd className="m-0 text-[26px] font-bold text-sawah">{formatHectares(summary.hectares, lang)} <span className="text-[15px]">ha</span></dd></div>
                <div className="surface flex flex-col gap-1 px-[18px] py-3.5"><dt className="text-[13px] text-muted">{en ? "Water source" : "Sumber air"}</dt><dd className="m-0 pt-1.5 text-[17px] font-bold text-ink-strong">{summary.water}</dd></div>
              </dl>
              <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 xl:grid-cols-3">
                {fields.map((field) => <FieldCard key={field.id} field={field} crops={crops} lang={lang} busy={busy} now={now} onDelete={onDelete} />)}
                <li>
                  <Link href={newField} className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed border-control p-6 text-center text-sawah-lip no-underline hover:bg-white">
                    <span className="flex size-12 items-center justify-center rounded-md bg-sawah-tint"><Plus size={22} aria-hidden="true" /></span>
                    <span className="text-[17px] font-bold">{en ? "Add field" : "Tambah lahan"}</span>
                    <span className="text-sm font-medium text-muted">{en ? "Draw another field boundary on the map" : "Gambar batas lahan lain di peta"}</span>
                  </Link>
                </li>
              </ul>
            </>
          ) : !error && (
            <section className="surface flex flex-col items-start gap-4 px-6 py-10 sm:px-10">
              <Logo size={48} />
              <h2 className="m-0 text-xl font-bold">{en ? "Start with your first field" : "Mulai dari lahan pertama Anda"}</h2>
              <p className="m-0 max-w-md leading-relaxed text-muted">{en ? "No saved fields yet. Draw your field boundary, choose a planting plan, then save it after viewing the results." : "Belum ada lahan tersimpan. Gambar batas lahan, atur rencana tanam, lalu simpan setelah melihat hasilnya."}</p>
              <Link href={newField} className="btn-primary">{en ? "Choose field" : "Pilih lahan"}</Link>
            </section>
          )}
          {back && <Link className="btn-secondary self-start" href={back}>{en ? "Back to field" : "Kembali ke lahan"}</Link>}
        </div>
      </main>
    </div>
  );
}
