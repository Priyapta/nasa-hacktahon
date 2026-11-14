"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Logo } from "@/components/shell/AppHeader";
import { savedFieldHref, type SavedField } from "@/lib/accounts";
import { sceneGeometry, SCENE_H, SCENE_W } from "@/lib/field-scene";
import { measure } from "@/lib/geo";
import { formatCenter, formatHectares } from "@/lib/i18n";
import { ringFromPolygon } from "@/lib/query";
import type { Lang } from "@/lib/types";

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

function FieldCard({ field, lang, busy, onDelete }: Pick<Props, "lang" | "busy" | "onDelete"> & { field: SavedField }) {
  const en = lang === "en";
  const measured = measure(field.plan.location);
  const geometry = sceneGeometry(ringFromPolygon(field.plan.location));

  return (
    <li className="surface flex min-w-0 flex-col overflow-hidden">
      <div className="relative border-b-2 border-hairline bg-canvas">
        <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="block h-40 w-full" aria-hidden="true">
          {geometry.sides.map((side, index) => <polygon key={index} points={side} fill="#145a37" />)}
          <polygon points={geometry.surface} fill="#c3e77a" stroke="#1f7a4d" strokeWidth="4" strokeLinejoin="round" />
        </svg>
        <span className="absolute bottom-3 left-4 text-xs font-bold text-muted">{en ? "Field boundary" : "Batas lahan"}</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="m-0 min-w-0 flex-1 break-words text-xl font-bold text-ink-strong">{field.name}</h2>
          <span className="text-lg font-bold text-sawah-lip">{formatHectares(measured.areaHectares, lang)} <span className="text-sm">ha</span></span>
        </div>
        <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
          <div><dt className="text-muted">{en ? "Water source" : "Sumber air"}</dt><dd className="m-0 mt-1 font-bold">{field.plan.water_source === "irigasi" ? (en ? "Irrigated" : "Irigasi") : (en ? "Rainfed" : "Tadah hujan")}</dd></div>
          <div><dt className="text-muted">{en ? "Planning period" : "Periode rencana"}</dt><dd className="m-0 mt-1 font-bold">{field.plan.time.horizon_months} {en ? "months" : "bulan"}</dd></div>
          <div className="col-span-2"><dt className="text-muted">{en ? "Center coordinates" : "Koordinat tengah"}</dt><dd className="m-0 mt-1 break-words">{formatCenter(measured.centroid, lang)}</dd></div>
        </dl>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Link prefetch={false} href={savedFieldHref(field)} className="btn-primary flex-1">{en ? "Open field" : "Buka lahan"}</Link>
          <button className="btn-secondary" disabled={busy} onClick={() => onDelete(field)} aria-label={`${en ? "Delete" : "Hapus"} ${field.name}`}>{en ? "Delete" : "Hapus"}</button>
        </div>
      </div>
    </li>
  );
}

export default function Dashboard({ fields, lang, loading, busy, error, savedId, back, onRetry, onDelete }: Props) {
  const en = lang === "en";
  const newField = `/?lang=${lang}`;
  const saved = fields.find((field) => field.id === savedId);

  return (
    <div className="min-h-full bg-canvas text-ink">
      <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="m-0 mb-2 text-sm text-muted">{en ? "Your farming space" : "Ruang tani Anda"}</p><h1 className="m-0 text-3xl font-bold tracking-tight text-ink-strong">{en ? "My fields" : "Lahan saya"}</h1></div>
            <Link href={newField} className="btn-primary"><Plus size={18} aria-hidden="true" />{en ? "New field" : "Buat lahan baru"}</Link>
          </div>

          {saved && !loading && <p role="status" className="m-0 rounded-md bg-sawah-tint px-4 py-3 text-sm font-bold text-sawah-lip">{en ? `“${saved.name}” has been saved.` : `“${saved.name}” sudah tersimpan.`}</p>}
          {error && <div role="alert" className="surface flex flex-wrap items-center justify-between gap-3 p-4"><p className="m-0">{error}</p><button className="btn-secondary" disabled={busy} onClick={onRetry}>{en ? "Retry" : "Coba lagi"}</button></div>}

          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-hairline pb-4">
            <p className="m-0 text-sm text-muted">{en ? "Open a field to run its analysis again or update its planting plan." : "Buka lahan untuk menjalankan analisis ulang atau memperbarui rencana tanam."}</p>
            {!loading && <p className="m-0 whitespace-nowrap text-sm font-bold">{fields.length} {en ? "saved fields" : "lahan tersimpan"}</p>}
          </div>

          {loading ? <p role="status" className="surface m-0 p-6">{en ? "Loading your fields…" : "Memuat lahan Anda…"}</p> : fields.length ? (
            <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 xl:grid-cols-3">
              {fields.map((field) => <FieldCard key={field.id} field={field} lang={lang} busy={busy} onDelete={onDelete} />)}
            </ul>
          ) : !error && (
            <section className="surface flex flex-col items-start gap-4 px-6 py-10 sm:px-10">
              <Logo size={48} />
              <h2 className="m-0 text-xl font-bold">{en ? "Start with your first field" : "Mulai dari lahan pertama Anda"}</h2>
              <p className="m-0 max-w-md leading-relaxed text-muted">{en ? "No saved fields yet. Draw your field boundary, choose a planting plan, then save it after viewing the results." : "Belum ada lahan tersimpan. Gambar batas lahan, atur rencana tanam, lalu simpan setelah melihat hasilnya."}</p>
              <Link href={newField} className="btn-primary">{en ? "Choose field" : "Pilih lahan"}</Link>
            </section>
          )}
          <p className="m-0 text-sm leading-relaxed text-muted">{en ? "Saved planting months that have passed move to the current month when opened." : "Bulan tanam yang sudah lewat digeser ke bulan berjalan saat lahan dibuka."}</p>
          {back && <Link className="btn-secondary self-start" href={back}>{en ? "Back to field" : "Kembali ke lahan"}</Link>}
        </div>
      </main>
    </div>
  );
}
