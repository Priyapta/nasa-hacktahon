"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// MapLibre and Terra Draw need `window`, so the whole input flow renders in
// the browser only.
const InputFlow = dynamic(() => import("@/components/input/InputFlow"), {
  ssr: false,
  loading: () => <div className="h-full bg-canvas" />,
});

export default function Page() {
  return (
    <Suspense fallback={<div className="h-full bg-canvas" />}>
      <InputFlow />
    </Suspense>
  );
}
