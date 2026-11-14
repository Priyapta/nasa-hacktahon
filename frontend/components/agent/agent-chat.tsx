"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Plus, X } from "lucide-react";
import anime from "animejs";
import { type ChatLanguage, useAgentChat } from "@/hooks/useAgentChat";
import styles from "./agent-chat.module.css";
import CropyOrb from "./CropyOrb";

const copy = {
  id: {
    open: "Ask Cropy", title: "Cropy", subtitle: "Asisten pertanian",
    close: "Tutup chat", clear: "Hapus percakapan", welcome: "Apa yang ingin Anda tanyakan?",
    intro: "Rotasi tanam, air, dan kesehatan tanah.",
    label: "Pertanyaan Anda", placeholder: "Tulis pertanyaan tentang tanaman…", send: "Kirim pertanyaan", waiting: "Sedang menyiapkan jawaban…",
    retry: "Coba kirim ulang", you: "Anda", ai: "Cropy",
  },
  en: {
    open: "Ask Cropy", title: "Cropy", subtitle: "Farming assistant",
    close: "Close chat", clear: "Clear conversation", welcome: "What would you like to ask?",
    intro: "Crop rotations, water, and soil health.",
    label: "Your question", placeholder: "Ask a question about crops…", send: "Send question", waiting: "Preparing your reply…",
    retry: "Try sending again", you: "You", ai: "Cropy",
  },
};

export default function AgentChat({ lang = "id", launcherClassName = "" }: { lang?: ChatLanguage; launcherClassName?: string }) {
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const launcherLabel = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const { messages, pending, error, send, reset, retry } = useAgentChat(lang);
  const t = copy[lang];

  useEffect(() => { setDraft(""); }, [lang]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages, pending, error, opened]);
  useEffect(() => {
    if (!opened) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); void close(); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [opened]);
  function morphLauncher(compact: boolean) {
    const button = launcher.current;
    const label = launcherLabel.current;
    if (!button || !label) return;
    const textWidth = label.scrollWidth;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    anime.remove([button, label]);
    anime({
      targets: button,
      width: compact ? 56 : 66 + textWidth,
      borderRadius: compact ? 28 : 18,
      duration: reduced ? 0 : 320,
      easing: "easeInOutCubic",
    });
    anime({
      targets: label,
      width: compact ? 0 : textWidth,
      marginLeft: compact ? 0 : 10,
      opacity: compact ? 0 : 1,
      duration: reduced ? 0 : 260,
      easing: "easeInOutCubic",
    });
  }

  function syncLauncher() {
    morphLauncher(!launcher.current?.matches(":hover, :focus-visible"));
  }

  function open() {
    if (closing.current || dialog.current?.open) return;
    setOpened(true);
    dialog.current?.show();
    syncLauncher();

    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || !surface.current) {
      if (surface.current) {
        surface.current.style.opacity = "1";
        surface.current.style.transform = "none";
      }
      input.current?.focus();
      return;
    }

    anime.remove([surface.current, headerRef.current, messagesRef.current, composerRef.current]);

    const tl = anime.timeline({
      easing: "easeOutExpo",
      complete: () => {
        if (surface.current) surface.current.style.transform = "none";
        const items = [headerRef.current, messagesRef.current, composerRef.current];
        items.forEach((el) => {
          if (el) el.style.transform = "none";
        });
        input.current?.focus();
      },
    });

    tl.add({
      targets: surface.current,
      scale: [0, 1],
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 320,
    });

    const staggerItems = [headerRef.current, messagesRef.current, composerRef.current].filter(Boolean);
    if (staggerItems.length) {
      tl.add(
        {
          targets: staggerItems,
          opacity: [0.7, 1],
          translateY: [10, 0],
          delay: anime.stagger(40),
          duration: 240,
          easing: "easeOutQuad",
        },
        "-=200"
      );
    }
  }

  async function close() {
    if (closing.current || !dialog.current?.open) return;
    closing.current = true;

    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    syncLauncher();

    const finish = () => {
      dialog.current?.close();
      setOpened(false);
      closing.current = false;
      launcher.current?.focus();
    };

    if (prefersReduced || !surface.current) {
      finish();
      return;
    }

    anime.remove([surface.current, headerRef.current, messagesRef.current, composerRef.current]);

    anime({
      targets: surface.current,
      scale: [1, 0],
      opacity: [1, 0],
      translateY: [0, 20],
      duration: 250,
      easing: "easeInExpo",
      complete: finish,
    });
  }

  function submit() {
    if (!draft.trim() || pending || error) return;
    void send(draft);
    setDraft("");
  }

  return (
    <div className={`fixed right-6 bottom-9 z-30 font-sans max-sm:right-3 ${launcherClassName} ${styles.widget}`} lang={lang}>
      <button
        ref={launcher}
        type="button"
        className={styles.launcher}
        onClick={() => { if (opened) { void close(); } else { open(); } }}
        onPointerEnter={syncLauncher}
        onPointerLeave={syncLauncher}
        onFocus={syncLauncher}
        onBlur={syncLauncher}
        aria-label={opened ? (lang === "id" ? "Tutup Cropy" : "Close Cropy") : t.open}
        aria-expanded={opened}
        aria-controls="field-agent-chat"
        aria-haspopup="dialog"
      >
        <span className={styles.launcherLogo} aria-hidden="true"><CropyOrb animated thinking={pending} /></span>
        <span ref={launcherLabel} className={styles.launcherLabel} aria-hidden="true"><span className={styles.launcherText}>{t.open}</span></span>
      </button>
      <dialog
        ref={dialog}
        id="field-agent-chat"
        className={styles.panel}
        aria-labelledby="agent-title"
        onCancel={(event) => { event.preventDefault(); void close(); }}
        onClose={() => { setOpened(false); launcher.current?.focus(); }}
      >
        <div
          ref={surface}
          className={`flex flex-col h-full border border-[#626b79] rounded-[22px] overflow-hidden bg-[#20242c] shadow-[0_16px_48px_rgba(0,0,0,0.25)] origin-bottom-right ${styles.surface}`}
          style={{ transformOrigin: "bottom right" }}
        >
          <div ref={headerRef} className={`stagger-reveal flex items-center gap-1 px-4.5 py-3 border-b border-[#343b45] bg-[#252b34] max-sm:px-3.5 max-sm:py-2.5 ${styles.heading}`}>
            <div className={`flex items-center gap-2.5 flex-1 min-w-0 ${styles.identity}`}>
              <span className={styles.avatar} aria-hidden="true"><CropyOrb animated={opened} thinking={pending} /></span>
              <div><h2 id="agent-title" className="text-[15px] font-semibold m-0 leading-tight">{t.title}</h2><p className="text-[10px] leading-relaxed text-[#b5beca] m-0">{t.subtitle}</p></div>
            </div>
            <button type="button" className={`grid place-items-center min-w-[44px] min-h-[44px] rounded-full text-[#d2dae3] bg-transparent hover:bg-[#343c47] focus-visible:outline-2 focus-visible:outline-[#c3e77a] focus-visible:outline-offset-3 disabled:opacity-40 ${styles.iconButton}`} disabled={!messages.length && !draft} onClick={() => { reset(); setDraft(""); input.current?.focus(); }} aria-label={t.clear}><Plus size={20} aria-hidden="true" /></button>
            <button type="button" className={`grid place-items-center min-w-[44px] min-h-[44px] rounded-full text-[#d2dae3] bg-transparent hover:bg-[#343c47] focus-visible:outline-2 focus-visible:outline-[#c3e77a] focus-visible:outline-offset-3 ${styles.iconButton}`} onClick={() => void close()} aria-label={t.close}><X size={20} aria-hidden="true" /></button>
          </div>
          <div ref={messagesRef} className={`stagger-reveal flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain p-5.5 max-sm:p-4 [scrollbar-color:#626b79_transparent] ${styles.messages}`}>
            {!messages.length ? <div className={`flex-1 flex flex-col justify-center items-center px-2.5 pb-6 text-center ${styles.empty}`}>
              <span className={styles.leaf}><CropyOrb animated={opened} /></span>
              <h3 className="max-w-[260px] text-[23px] leading-snug mb-2.5 tracking-tight font-medium">{t.welcome}</h3>
              <p className="text-xs leading-relaxed text-[#b5beca] m-0">{t.intro}</p>
            </div> : <div role="log" aria-live="polite" aria-relevant="additions" className={`flex flex-col gap-6 ${styles.log}`}>
              {messages.map((message, index) => <div key={index} className={message.role === "user" ? styles.user : styles.assistant}>
                {message.role === "assistant" && <span className={styles.avatar} aria-hidden="true"><CropyOrb /></span>}
                <div className={message.role === "assistant" ? styles.assistantBubble : styles.userBubble}>
                  <span className={styles.sender}>{message.role === "user" ? t.you : t.ai}</span>
                  {message.role === "assistant" ? <AssistantMessage content={message.content} /> : <p>{message.content}</p>}
                </div>
              </div>)}
            </div>}
            {pending && opened && <ThinkingDots label={t.waiting} />}
            {error && <div className={`p-3 mt-4 border border-[#d7a38d] rounded-[10px] bg-[#392c29] ${styles.error}`} role="alert"><p className="text-[#f2c6b4] text-xs m-0 mb-1.5 break-words">{error}</p><button type="button" className="text-[#f2c6b4] text-xs font-semibold min-h-[44px] underline underline-offset-3" onClick={() => void retry()}>{t.retry}</button></div>}
            <div ref={bottom} />
          </div>
          <div ref={composerRef} className={`stagger-reveal p-3.5 bg-[#20242c] max-sm:p-3 ${styles.composer}`}>
            <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
              <label className="sr-only" htmlFor="agent-question">{t.label}</label>
              <div className={`flex items-end gap-1.5 p-1 border border-[#7b8593] rounded-[26px] bg-[#191d24] focus-within:border-[#c3e77a] focus-within:ring-1 focus-within:ring-[#c3e77a] ${styles.inputRow}`}>
                <textarea ref={input} id="agent-question" autoFocus rows={1} maxLength={2000} value={draft} disabled={pending || !!error} placeholder={t.placeholder} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} className="flex-1 min-w-0 px-3 pt-3 pb-2.5 min-h-[44px] max-h-[120px] resize-none border-0 rounded-[20px] bg-transparent text-[#eef2f0] text-[13px] max-sm:text-base leading-normal outline-none placeholder:text-[#b5beca] [field-sizing:content]" />
                <button type="submit" className={`flex-shrink-0 min-w-[44px] h-[44px] p-2.5 border border-[#c3e77a] bg-[#c3e77a] text-[#17221d] rounded-full disabled:opacity-100 disabled:text-[#9da79f] disabled:bg-[#303d35] disabled:border-[#626b79] focus-visible:outline-2 focus-visible:outline-[#c3e77a] focus-visible:outline-offset-3 ${styles.send}`} disabled={pending || !!error || !draft.trim()} aria-label={t.send}><ArrowUp size={21} aria-hidden="true" /></button>
              </div>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function ThinkingDots({ label }: { label: string }) {
  const dots = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = dots.current!;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    function update() {
      anime.remove(element);
      element.style.transform = "none";
      if (!preference.matches) anime({ targets: element, rotate: [0, 360], duration: 1400, easing: "linear", loop: true });
    }
    update();
    preference.addEventListener("change", update);
    return () => { anime.remove(element); preference.removeEventListener("change", update); };
  }, []);
  return <div className={styles.pending} role="status" aria-label={label}>
    <span className={styles.srOnly}>{label}</span>
    <span ref={dots} className={styles.thinkingDots} aria-hidden="true"><i /><i /><i /></span>
  </div>;
}

function AssistantMessage({ content }: { content: string }) {
  const bold = (value: string) => value.split(/(\*\*[^*\n]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part);
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) { if (blocks.at(-1)?.lines.length) blocks.push({ list: false, lines: [] }); continue; }
    const list = /^\s*(?:[-*•]|\d+[.)])\s+/.test(line);
    let block = blocks.at(-1);
    if (!block || (block.lines.length && block.list !== list)) { block = { list, lines: [] }; blocks.push(block); }
    block.list = list;
    block.lines.push(list ? line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "") : line);
  }
  return <div className={styles.answer}>{blocks.filter((block) => block.lines.length).map((block, index) => block.list
    ? <ul key={index}>{block.lines.map((line, item) => <li key={item}>{bold(line)}</li>)}</ul>
    : <p key={index}>{bold(block.lines.join("\n"))}</p>)}</div>;
}
