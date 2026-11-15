import { Suspense } from "react";
import AppShell from "@/components/shell/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="h-dvh bg-canvas" />}><AppShell>{children}</AppShell></Suspense>;
}
