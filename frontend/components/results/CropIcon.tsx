import { Bean, Sprout, Wheat } from "lucide-react";
import type { CropId } from "@/lib/types";

const LOOK: Record<CropId, { ink: string; bg: string }> = {
  padi_sawah: { ink: "#1F7A4D", bg: "#E3F1E8" },
  jagung: { ink: "#8A6200", bg: "#FBF1D6" },
  kedelai: { ink: "#4F7A26", bg: "#EDF3E5" },
  kacang_hijau: { ink: "#4F7A26", bg: "#EDF3E5" },
  orok_orok: { ink: "#765100", bg: "#F7EED0" },
  bera: { ink: "#8E4220", bg: "#F8E9DF" },
};

// Lucide has no maize icon, so this one follows its 24px stroke style.
function Corn({ size, color }: { size: number; color: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5c2.2 0 3.6 3 3.6 7.5s-1.4 8-3.6 8-3.6-3.5-3.6-8 1.4-7.5 3.6-7.5Z" />
      <path d="M8.6 8.5h6.8" />
      <path d="M8.5 12.5h7" />
      <path d="M12 2.5v15.5" />
      <path d="M8.6 12C5.5 13 4 16.5 4 21.5c3.2 0 6-1.2 8-3.5" />
      <path d="M15.4 12c3.1 1 4.6 4.5 4.6 9.5-3.2 0-6-1.2-8-3.5" />
    </svg>
  );
}

export default function CropIcon({ crop, size = 30 }: { crop: CropId; size?: number }) {
  const look = LOOK[crop];
  const inner = Math.round(size * 0.6);
  const icon = crop === "padi_sawah" ? <Wheat aria-hidden="true" size={inner} color={look.ink} />
    : crop === "jagung" ? <Corn size={inner} color={look.ink} />
    : crop === "kedelai" || crop === "kacang_hijau" ? <Bean aria-hidden="true" size={inner} color={look.ink} />
    : <Sprout aria-hidden="true" size={inner} color={look.ink} />;
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: look.bg }}>
      {icon}
    </span>
  );
}
