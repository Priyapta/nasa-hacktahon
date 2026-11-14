import type { CSSProperties } from "react";
import type { CropId } from "@/lib/types";
import styles from "./FieldSeason.module.css";

const BLADES =
  "M0 0 Q-2 -30 -14 -50 M0 0 Q-1 -34 -6 -58 M0 0 Q1 -36 4 -60 M0 0 Q2 -32 12 -52 M0 0 Q3 -20 18 -34 M0 0 Q-3 -20 -18 -32 M0 0 Q-1 -26 -9 -44 M0 0 Q1 -26 9 -46";

interface PlantProps {
  crop: CropId;
  ripe: boolean;
  cob: boolean;
  style: CSSProperties;
  delay: string;
}

/** Every crop is drawn once; switching crops only fades, so the change animates. */
export default function Plant({ crop, ripe, cob, style, delay }: PlantProps) {
  const show = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0, transitionDelay: delay });
  return (
    <svg className={styles.plant} viewBox="-26 -92 52 94" style={style} aria-hidden="true">
      <g className={styles.quick} style={show(crop === "padi_sawah")}>
        <path d={BLADES} stroke="#2F7F3E" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <path d={BLADES} stroke="#55B060" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <g className={styles.quick} style={{ opacity: ripe ? 1 : 0 }}>
          <path d={BLADES} stroke="#B8952C" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M-6 -58 Q2 -66 9 -50 M4 -60 Q12 -64 15 -46 M-14 -50 Q-20 -56 -22 -42" stroke="#F0CF66" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="3 2" />
        </g>
      </g>
      <g className={styles.quick} style={show(crop === "jagung")}>
        <path d="M0 0 L0 -78" stroke="#3F7A2C" strokeWidth="4" strokeLinecap="round" />
        <path d="M0 -18 Q-14 -24 -22 -16 M0 -32 Q14 -40 22 -30 M0 -46 Q-13 -54 -20 -46 M0 -58 Q12 -66 18 -60" stroke="#5FA845" strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <ellipse className={styles.quick} cx="4" cy="-40" rx="3.8" ry="8.5" fill="#E9B83E" style={{ opacity: cob ? 1 : 0 }} />
        <path d="M0 -78 L-5 -86 M0 -78 L5 -86 M0 -78 L0 -88" stroke="#E0C060" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className={styles.quick} style={show(crop === "kacang_hijau")}>
        <path d="M0 0 L0 -12" stroke="#4E7A34" strokeWidth="2.5" />
        <circle cx="-8" cy="-14" r="9" fill="#5E9A42" />
        <circle cx="8" cy="-16" r="10" fill="#77B656" />
        <circle cx="0" cy="-24" r="9" fill="#86C463" />
        <path className={styles.quick} d="M-10 -10 l-3 6 M6 -12 l3 6 M-2 -20 l-3 6" stroke="#2F4A1F" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: ripe ? 1 : 0 }} />
      </g>
      <g className={styles.quick} style={show(crop === "kedelai")}>
        <path d="M0 0 L0 -16" stroke="#4A6E2E" strokeWidth="2.5" />
        <ellipse cx="-9" cy="-18" rx="9" ry="7" fill="#4F8A3A" />
        <ellipse cx="9" cy="-20" rx="9" ry="7" fill="#5E9A44" />
        <ellipse cx="0" cy="-29" rx="9" ry="7" fill="#6BAA4E" />
        <path className={styles.quick} d="M-12 -12 q-2 6 1 9 M7 -14 q2 6 -1 9 M-1 -22 q-2 6 1 9" stroke="#A8894A" strokeWidth="3" fill="none" strokeLinecap="round" style={{ opacity: ripe ? 1 : 0 }} />
      </g>
      <g className={styles.quick} style={show(crop === "orok_orok")}>
        <path d="M0 0 L0 -64" stroke="#4E7A34" strokeWidth="3" strokeLinecap="round" />
        <path d="M0 -16 Q-12 -20 -16 -12 M0 -28 Q12 -32 16 -24 M0 -40 Q-11 -44 -15 -36 M0 -52 Q10 -56 14 -48" stroke="#6FAE4E" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path className={styles.quick} d="M0 -64 l0 -10 M-3 -66 l-3 -6 M3 -66 l3 -6" stroke="#F2C230" strokeWidth="4" strokeLinecap="round" style={{ opacity: ripe ? 1 : 0 }} />
      </g>
    </svg>
  );
}
