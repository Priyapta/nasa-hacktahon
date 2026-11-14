import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

// Lexend was designed for reading ease, which matters for farmers who do not
// read on screens every day.
const lexend = Lexend({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-lexend",
});

export const metadata: Metadata = {
  title: "Field Shift",
  description:
    "Bandingkan urutan tanam untuk lahan Anda dengan riwayat iklim NASA POWER dan data tanah SoilGrids.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={lexend.variable}>
      <body>{children}</body>
    </html>
  );
}
