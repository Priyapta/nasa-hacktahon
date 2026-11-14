import { Check } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <rect width="30" height="30" rx="8" fill="#1f7a4d" />
      <rect x="5" y="7" width="14" height="4" rx="2" fill="#ffffff" />
      <rect x="9" y="13" width="14" height="4" rx="2" fill="#c3e77a" />
      <rect x="13" y="19" width="12" height="4" rx="2" fill="#ffffff" />
    </svg>
  );
}

interface AppHeaderProps {
  t: Dictionary;
  lang: Lang;
  step: 1 | 2 | 3;
  onLangChange: (lang: Lang) => void;
}

export default function AppHeader({ t, lang, step, onLangChange }: AppHeaderProps) {
  const steps = [t.steps.land, t.steps.plan, t.steps.results];
  return (
    <header className="relative z-20 flex h-[60px] shrink-0 items-center gap-6 border-b-2 border-hairline bg-surface px-3 pl-4 lg:h-[68px] lg:px-6">
      <a href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink-strong no-underline lg:text-xl">
        <Logo size={30} />
        {t.appName}
      </a>

      <ol aria-label={t.steps.label} className="m-0 hidden flex-1 list-none items-center justify-center gap-2.5 p-0 text-[15px] lg:flex">
        {steps.map((label, index) => {
          const n = (index + 1) as 1 | 2 | 3;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label} aria-current={current ? "step" : undefined} className="flex items-center gap-2.5">
              {index > 0 && (
                <span aria-hidden="true" className={`h-[3px] w-12 rounded-sm ${n <= step ? "bg-sawah" : "bg-control"}`} />
              )}
              <span
                className={`inline-flex size-[30px] items-center justify-center rounded-lg text-sm font-bold ${
                  current
                    ? "border-b-[3px] border-sawah-lip bg-sawah text-white"
                    : done
                      ? "bg-sawah-tint text-sawah-lip"
                      : "border-2 border-b-[3px] border-control bg-surface text-muted"
                }`}
              >
                {done ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : n}
              </span>
              <span className={current || done ? "font-bold text-ink-strong" : "text-muted"}>{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
        <span className="mr-1 text-[13px] text-muted lg:hidden">{step < 3 ? t.stepOf(step) : ""}</span>
        <div role="group" aria-label={t.language} className="flex gap-1">
          {(["id", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={lang === code}
              onClick={() => onLangChange(code)}
              className="tile min-h-11 cursor-pointer px-3 text-center text-sm font-bold uppercase"
            >
              {code}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
