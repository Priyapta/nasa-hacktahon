import { Suspense } from "react";
import Landing from "@/components/landing/Landing";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#2e5a22]" />}>
      <Landing />
    </Suspense>
  );
}
