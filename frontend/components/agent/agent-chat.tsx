"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Plus, Sprout, X } from "lucide-react";
import anime from "animejs";
import { type ChatLanguage, useAgentChat } from "@/hooks/useAgentChat";
import styles from "./agent-chat.module.css";

const copy = {
  id: {
    open: "Ask AI", title: "Field Atlas", subtitle: "Asisten pertanian",
    close: "Tutup chat", clear: "Hapus percakapan", welcome: "Apa yang ingin Anda tanyakan?",
    intro: "Rotasi tanam, air, dan kesehatan tanah.",
    label: "Pertanyaan Anda", placeholder: "Tulis pertanyaan tentang tanaman…", send: "Kirim pertanyaan", waiting: "Sedang menyiapkan jawaban…",
    retry: "Coba kirim ulang", you: "Anda", ai: "Field Atlas",
  },
  en: {
    open: "Ask AI", title: "Field Atlas", subtitle: "Farming assistant",
    close: "Close chat", clear: "Clear conversation", welcome: "What would you like to ask?",
    intro: "Crop rotations, water, and soil health.",
    label: "Your question", placeholder: "Ask a question about crops…", send: "Send question", waiting: "Preparing your reply…",
    retry: "Try sending again", you: "You", ai: "Field Atlas",
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
  const chatIconRef = useRef<HTMLSpanElement>(null);
  const closeIconRef = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const idleAnim = useRef<anime.AnimeInstance | null>(null);
  const isHovered = useRef(false);
  const { messages, pending, error, send, reset, retry } = useAgentChat(lang);
  const t = copy[lang];

  useEffect(() => { setDraft(""); }, [lang]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages, pending, error, opened]);
  const stopIdle = useCallback(() => {
    idleAnim.current?.pause();
    if (launcher.current) anime.remove(launcher.current);
  }, []);

  const startIdle = useCallback(() => {
    if (typeof window === "undefined" || !launcher.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stopIdle();
    idleAnim.current = anime({
      targets: launcher.current,
      keyframes: [
        { scale: 1, rotate: 0, duration: 0 },
        { scale: 1.05, rotate: -2.5, duration: 250, easing: "easeInOutSine" },
        { scale: 1.07, rotate: 2.5, duration: 250, easing: "easeInOutSine" },
        { scale: 1.03, rotate: -1.5, duration: 200, easing: "easeInOutSine" },
        { scale: 1, rotate: 0, duration: 300, easing: "easeOutQuad" },
        { scale: 1, rotate: 0, duration: 3200 },
      ],
      loop: true,
      autoplay: true,
    });
  }, [stopIdle]);

  useEffect(() => {
    if (!opened && !isHovered.current) startIdle();
    else stopIdle();
    return () => { stopIdle(); };
  }, [opened, startIdle, stopIdle]);

  const handleMouseEnter = () => {
    isHovered.current = true;
    if (typeof window === "undefined" || !launcher.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stopIdle();
    anime({
      targets: launcher.current,
      scale: 1.08,
      rotate: 0,
      duration: 250,
      easing: "easeOutQuad",
    });
  };

  const handleMouseLeave = () => {
    isHovered.current = false;
    if (typeof window === "undefined" || !launcher.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    anime.remove(launcher.current);
    anime({
      targets: launcher.current,
      scale: 1,
      rotate: 0,
      duration: 250,
      easing: "easeOutQuad",
      complete: () => {
        if (!opened && !isHovered.current) startIdle();
      },
    });
  };

  function open() {
    if (closing.current || dialog.current?.open) return;
    stopIdle();
    setOpened(true);
    dialog.current?.showModal();

    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (chatIconRef.current && closeIconRef.current) {
      anime.remove([chatIconRef.current, closeIconRef.current]);
      anime({
        targets: chatIconRef.current,
        rotate: 90,
        opacity: 0,
        scale: 0.4,
        duration: prefersReduced ? 0 : 300,
        easing: "easeOutQuad",
      });
      anime({
        targets: closeIconRef.current,
        rotate: [-90, 0],
        opacity: [0, 1],
        scale: [0.4, 1],
        duration: prefersReduced ? 0 : 300,
        easing: "easeOutQuad",
      });
    }

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

    if (chatIconRef.current && closeIconRef.current) {
      anime.remove([chatIconRef.current, closeIconRef.current]);
      anime({
        targets: chatIconRef.current,
        rotate: [90, 0],
        opacity: [0, 1],
        scale: [0.4, 1],
        duration: prefersReduced ? 0 : 250,
        easing: "easeOutQuad",
      });
      anime({
        targets: closeIconRef.current,
        rotate: [0, -90],
        opacity: [1, 0],
        scale: [1, 0.4],
        duration: prefersReduced ? 0 : 250,
        easing: "easeOutQuad",
      });
    }

    const finish = () => {
      dialog.current?.close();
      setOpened(false);
      closing.current = false;
      launcher.current?.focus();
      if (!isHovered.current) startIdle();
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
        className={`flex items-center gap-2.5 min-h-[50px] px-5 py-3 border border-white rounded-[14px] bg-[#163d2b] text-white text-sm font-semibold shadow-lg shadow-black/10 hover:brightness-105 active:brightness-90 transition-colors focus-visible:outline-3 focus-visible:outline-[#163d2b] focus-visible:outline-offset-3 focus-visible:ring-3 focus-visible:ring-white select-none ${styles.launcher}`}
        onClick={() => { if (opened) { void close(); } else { open(); } }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-expanded={opened}
        aria-controls="field-agent-chat"
        aria-haspopup="dialog"
      >
        <span className="relative inline-flex items-center justify-center w-5 h-5 flex-shrink-0" aria-hidden="true">
          <span ref={chatIconRef} className="absolute inset-0 flex items-center justify-center text-[#c3e77a]">
            <Sprout size={21} aria-hidden="true" />
          </span>
          <span ref={closeIconRef} className="absolute inset-0 flex items-center justify-center opacity-0 -rotate-90 scale-50 text-white">
            <X size={21} aria-hidden="true" />
          </span>
        </span>
        <span>{t.open}</span>
      </button>
      <dialog
        ref={dialog}
        id="field-agent-chat"
        className={`fixed inset-auto right-6 bottom-[98px] m-0 p-0 w-[min(410px,calc(100vw-32px))] h-[min(640px,calc(100dvh-122px))] max-w-none max-h-none border-0 bg-transparent text-[#eef2f0] overflow-visible [color-scheme:dark] backdrop:bg-[#10271e26] max-sm:right-3 max-sm:bottom-3 max-sm:w-[calc(100vw-24px)] max-sm:h-[min(640px,calc(100dvh-24px))] ${styles.panel}`}
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
              <span className={styles.avatar} aria-hidden="true"><Sprout size={22} /></span>
              <div><h2 id="agent-title" className="text-[15px] font-semibold m-0 leading-tight">{t.title}</h2><p className="text-[10px] leading-relaxed text-[#b5beca] m-0">{t.subtitle}</p></div>
            </div>
            <button type="button" className={`grid place-items-center min-w-[44px] min-h-[44px] rounded-full text-[#d2dae3] bg-transparent hover:bg-[#343c47] focus-visible:outline-2 focus-visible:outline-[#c3e77a] focus-visible:outline-offset-3 disabled:opacity-40 ${styles.iconButton}`} disabled={!messages.length && !draft} onClick={() => { reset(); setDraft(""); input.current?.focus(); }} aria-label={t.clear}><Plus size={20} aria-hidden="true" /></button>
            <button type="button" className={`grid place-items-center min-w-[44px] min-h-[44px] rounded-full text-[#d2dae3] bg-transparent hover:bg-[#343c47] focus-visible:outline-2 focus-visible:outline-[#c3e77a] focus-visible:outline-offset-3 ${styles.iconButton}`} onClick={() => void close()} aria-label={t.close}><X size={20} aria-hidden="true" /></button>
          </div>
          <div ref={messagesRef} className={`stagger-reveal flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain p-5.5 max-sm:p-4 [scrollbar-color:#626b79_transparent] ${styles.messages}`}>
            {!messages.length ? <div className={`flex-1 flex flex-col justify-center items-center px-2.5 pb-6 text-center ${styles.empty}`}>
              <span className={`inline-grid place-items-center w-[58px] h-[58px] mb-5 rounded-[18px_18px_18px_4px] bg-[#303d35] text-[#c3e77a] ${styles.leaf}`}><Sprout size={30} aria-hidden="true" /></span>
              <h3 className="max-w-[260px] text-[23px] leading-snug mb-2.5 tracking-tight font-medium">{t.welcome}</h3>
              <p className="text-xs leading-relaxed text-[#b5beca] m-0">{t.intro}</p>
            </div> : <div role="log" aria-live="polite" aria-relevant="additions" className={`flex flex-col gap-6 ${styles.log}`}>
              {messages.map((message, index) => <div key={index} className={message.role === "user" ? styles.user : styles.assistant}>
                {message.role === "assistant" && <span className={styles.avatar} aria-hidden="true"><Sprout size={18} /></span>}
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
