"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/shell/AppHeader";
import AgentChat from "@/components/agent/agent-chat";
import { dictionary } from "@/lib/i18n";
import { parsePlan, serializePlan } from "@/lib/query";

function Results() {
  const params = useSearchParams();
  const router = useRouter();
  const [now] = useState(() => new Date());
  const plan = useMemo(() => parsePlan(new URLSearchParams(params.toString()), now), [params, now]);
  const t = dictionary(plan.lang);
  const back = `/?${serializePlan({ ...plan, step: plan.area ? 2 : 1 })}`;

  return (
    <div className="flex h-dvh flex-col bg-canvas text-ink">
      <AppHeader
        t={t}
        lang={plan.lang}
        step={3}
        onLangChange={(lang) =>
          router.replace(`/hasil?${serializePlan({ ...plan, lang }, { includeStep: false })}`)
        }
      />
      <main className="relative flex-1 overflow-y-auto p-4 lg:p-8">
        <section className="surface mx-auto flex max-w-xl flex-col gap-3 p-6">
          <h1 className="m-0 text-2xl font-bold tracking-tight text-ink-strong">{t.results.title}</h1>
          <p className="m-0 text-[15px] leading-relaxed text-muted">{t.results.body}</p>
          <Link href={back} className="btn-secondary self-start">
            {t.results.back}
          </Link>
        </section>
        <AgentChat lang={plan.lang} />
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-canvas" />}>
      <Results />
    </Suspense>
  );
}
