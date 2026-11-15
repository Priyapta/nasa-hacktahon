// Space Apps rules ask for a visible mark on SI-generated images.
export default function SiImageLabel({ en, className = "" }: { en: boolean; className?: string }) {
  return (
    <span className={`pointer-events-none absolute z-10 rounded-md bg-black/35 px-2 py-1 text-[11px] font-medium leading-none text-white/85 backdrop-blur-sm ${className}`}>
      {en ? "SI-generated image" : "Gambar buatan SI"}
    </span>
  );
}
