"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { redirect, useSearchParams } from "next/navigation";

// MapLibre and Terra Draw need `window`, so the whole input flow renders in
// the browser only.
const InputFlow = dynamic(() => import("@/components/input/InputFlow"), {
  ssr: false,
  loading: () => <div className="h-full bg-canvas" />,
});

function Start() {
  const params = useSearchParams();
  if (params.size === 0) redirect("/login");
  return <InputFlow />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-full bg-canvas" />}>
      <Start />
    </Suspense>
  );
}
