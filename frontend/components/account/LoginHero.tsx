import type { CSSProperties } from "react";

const W = 1120;
const H = 1400;
// Field outline in photo pixels; the label hangs below its bottom edge.
const FIELD = "429,584 763,664 723,849 394,774";
const EDGE: [number, number] = [558, 811];
const LABEL_Y = 881;

const stage: CSSProperties = {
  position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
  width: `max(100cqw, calc(100cqh * ${W} / ${H}))`, aspectRatio: `${W} / ${H}`,
};

export default function LoginHero({ en }: { en: boolean }) {
  return (
    <section aria-label={en ? "Example of a saved field" : "Contoh lahan tersimpan"}
      className="relative h-72 overflow-hidden bg-[#2e5a22] lg:h-auto lg:min-h-full" style={{ containerType: "size" }}>
      <div style={stage}>
        <img src="/images/login-sawah.jpg" alt={en ? "Aerial photo of rice fields with one field outlined" : "Foto udara petak-petak sawah dengan satu lahan ditandai"}
          width={W} height={H} className="absolute inset-0 h-full w-full brightness-[0.88]" />
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <polygon points={FIELD} fill="#c3e77a" fillOpacity="0.16" stroke="#d4f28e" strokeWidth="4" strokeLinejoin="round" />
          <line x1={EDGE[0]} y1={EDGE[1]} x2={EDGE[0]} y2={LABEL_Y} stroke="#d4f28e" strokeWidth="3" />
          <circle cx={EDGE[0]} cy={EDGE[1]} r="7" fill="#d4f28e" />
        </svg>
        <div className="absolute flex -translate-x-1/2 flex-col gap-1 whitespace-nowrap rounded-[10px] bg-white px-4 py-3"
          style={{ left: `${(EDGE[0] / W) * 100}%`, top: `${(LABEL_Y / H) * 100}%` }}>
          <span className="text-base font-bold text-ink-strong">Sawah Purwodadi · 0,59 ha</span>
          <span className="text-sm text-muted">{en ? "Example rotation · Rice → Rice → Fallow" : "Rotasi contoh · Padi → Padi → Bera"}</span>
        </div>
      </div>
      <p className="absolute inset-x-5 top-5 m-0 text-2xl font-bold leading-tight tracking-tight text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.4)] lg:inset-x-16 lg:top-16 lg:text-[34px]">
        {en ? "Save your fields." : "Simpan lahan."}<br />{en ? "Plan the next season." : "Rencanakan musim berikutnya."}
      </p>
    </section>
  );
}
