"use client";

import { useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { parseCoordinates, type LocationResult } from "@field-atlas/shared";
import { searchPlaces } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";

interface LocationSearchProps {
  t: Dictionary;
  onSelect: (result: LocationResult) => void;
  className?: string;
}

export default function LocationSearch({ t, onSelect, className = "" }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const abort = useRef<AbortController | null>(null);

  function choose(result: LocationResult) {
    setResults(null);
    setQuery(result.name);
    onSelect(result);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = query.trim();
    if (text.length < 2) return;
    abort.current?.abort();
    setMessage("");
    try {
      const coordinate = parseCoordinates(text);
      if (coordinate) {
        choose(coordinate);
        return;
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.search.failed);
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setStatus("loading");
    try {
      const found = await searchPlaces(text, controller.signal);
      setResults(found);
      setStatus("idle");
    } catch {
      if (controller.signal.aborted) return;
      setStatus("error");
      setMessage(t.search.failed);
      setResults(null);
    }
  }

  return (
    <form role="search" onSubmit={submit} className={`surface flex items-center gap-2 py-1 pl-4 pr-1 focus-within:border-sawah ${className}`}>
      <Search size={20} className="shrink-0 text-muted" aria-hidden="true" />
      <label htmlFor="cari-lokasi" className="sr-only-label">
        {t.search.label}
      </label>
      <input
        id="cari-lokasi"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t.search.placeholder}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted focus-visible:outline-none"
      />
      <button type="submit" className="btn-primary min-h-11 px-4 text-[15px]" disabled={status === "loading"}>
        {status === "loading" ? t.search.searching : t.search.submit}
      </button>
      {(results || message) && (
        <div className="surface absolute inset-x-[-2px] top-[calc(100%+8px)] z-10 p-1.5">
          {message && (
            <p role="alert" className="m-0 px-3 py-2.5 text-sm text-tanah-strong">
              {message}
            </p>
          )}
          {results && results.length === 0 && (
            <p role="status" className="m-0 px-3 py-2.5 text-sm text-muted">
              {t.search.empty}
            </p>
          )}
          {results && results.length > 0 && (
            <ul aria-label={t.search.results} className="m-0 list-none p-0">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => choose(result)}
                    className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-[15px] font-bold text-ink hover:bg-sawah-tint"
                  >
                    {result.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
