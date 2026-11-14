"use client";

import { useEffect, useId, useRef } from "react";
import { animate, cancelFrame, frame, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { orbContour } from "@/lib/cropy-orb";
import styles from "./agent-chat.module.css";

export default function CropyOrb({ animated = false, thinking = false }: { animated?: boolean; thinking?: boolean }) {
  const orb = useRef<HTMLSpanElement>(null);
  const id = useId();
  const phase = useMotionValue(0);
  const speed = useSpring(.65, { stiffness: 80, damping: 18 });
  const ripple = useMotionValue(1);
  const contour = useTransform(() => orbContour(phase.get(), 1 + Math.min(1.4, Math.max(0, speed.get() - .65) * .6)));
  const breath = useTransform(phase, t => 1 + Math.sin(t * .73) * .012);
  const limeX = useTransform(phase, t => Math.sin(t * .61) * 12);
  const limeY = useTransform(phase, t => Math.cos(t * .47) * 9);
  const mintX = useTransform(phase, t => Math.sin(t * .43 + 1.7) * 13);
  const mintY = useTransform(phase, t => Math.sin(t * .59 + .8) * 11);
  const mintScale = useTransform(phase, t => 1 + Math.sin(t * .37) * .13);
  const lightX = useTransform(phase, t => Math.cos(t * .53 + 2.6) * 10);
  const lightY = useTransform(phase, t => Math.sin(t * .41 + 3.1) * 12);
  const lightScale = useTransform(phase, t => 1 + Math.cos(t * .49) * .1);
  const rippleRadius = useTransform(ripple, [0, 1], [3, 68]);
  const rippleOpacity = useTransform(ripple, [0, .15, .65, 1], [0, .3, .12, 0]);

  useEffect(() => {
    if (!animated || !orb.current) return;
    const element = orb.current;
    const target = element.closest("button") ?? element;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let rippleAnimation: ReturnType<typeof animate> | undefined;
    const tick = ({ delta }: { delta: number }) => {
      phase.set(phase.get() + Math.min(delta, 40) / 1000 * speed.get());
    };
    function update() {
      cancelFrame(tick);
      if (preference.matches || document.hidden) {
        element.dataset.cropyState = preference.matches ? "reduced" : "paused";
        rippleAnimation?.stop();
        ripple.set(1);
        return;
      }
      const hovered = target.matches(":hover, :focus-visible");
      element.dataset.cropyState = thinking ? "thinking" : hovered ? "hover" : "idle";
      speed.set(hovered ? 3.2 : thinking ? 1.65 : .65);
      frame.update(tick, true);
    }
    function click() {
      if (preference.matches || document.hidden) return;
      rippleAnimation?.stop();
      ripple.set(0);
      rippleAnimation = animate(ripple, 1, { duration: 1.25, ease: [.2, .65, .3, 1] });
    }
    update();
    target.addEventListener("pointerenter", update);
    target.addEventListener("pointerleave", update);
    target.addEventListener("focus", update);
    target.addEventListener("blur", update);
    target.addEventListener("click", click);
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      cancelFrame(tick);
      rippleAnimation?.stop();
      ripple.set(1);
      target.removeEventListener("pointerenter", update);
      target.removeEventListener("pointerleave", update);
      target.removeEventListener("focus", update);
      target.removeEventListener("blur", update);
      target.removeEventListener("click", click);
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [animated, thinking, phase, ripple, speed]);

  return <span ref={orb} className={styles.orb} data-cropy-orb="" aria-hidden="true">
    <motion.svg viewBox="0 0 100 100" className={styles.orbSvg} style={{ scale: breath }} focusable="false">
      <defs>
        <radialGradient id={`${id}-base`} cx="28%" cy="20%" r="85%">
          <stop stopColor="#dcffa5" /><stop offset=".42" stopColor="#8cde72" /><stop offset="1" stopColor="#29b88f" />
        </radialGradient>
        <radialGradient id={`${id}-lime`}>
          <stop stopColor="#eaffb0" stopOpacity=".95" /><stop offset=".62" stopColor="#c4fa75" stopOpacity=".6" /><stop offset="1" stopColor="#abef62" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-mint`} x1=".2" y1="0" x2=".7" y2="1">
          <stop stopColor="#e2ffe7" stopOpacity=".8" /><stop offset=".55" stopColor="#9af3c8" stopOpacity=".5" /><stop offset="1" stopColor="#62e7b3" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2=".85" y2="1">
          <stop stopColor="#f2ffbf" stopOpacity=".75" /><stop offset=".55" stopColor="#b8f67b" stopOpacity=".4" /><stop offset="1" stopColor="#79e68d" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-sheen`} cx="32%" cy="18%" r="82%">
          <stop stopColor="#f9ffdf" stopOpacity=".28" /><stop offset=".5" stopColor="#f9ffdf" stopOpacity="0" /><stop offset="1" stopColor="#087459" stopOpacity=".15" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <clipPath id={`${id}-clip`}><motion.path d={contour} /></clipPath>
      </defs>
      <motion.path d={contour} fill={`url(#${id}-base)`} data-cropy-contour="" />
      <g clipPath={`url(#${id}-clip)`}>
        <motion.g style={{ x: limeX, y: limeY }} data-cropy-fluid="lime">
          <ellipse cx="34" cy="32" rx="60" ry="52" fill={`url(#${id}-lime)`} />
        </motion.g>
        <motion.g style={{ x: mintX, y: mintY, scaleY: mintScale }} data-cropy-fluid="mint">
          <path d="M -20 55 C 12 13 35 93 77 47 S 128 1 126 64 L 130 130 L -20 130 Z" fill={`url(#${id}-mint)`} filter={`url(#${id}-soft)`} />
        </motion.g>
        <motion.g style={{ x: lightX, y: lightY, scaleX: lightScale }} data-cropy-fluid="light">
          <path d="M -18 79 C 18 99 39 27 78 38 S 124 76 132 10 L 130 130 L -18 130 Z" fill={`url(#${id}-light)`} filter={`url(#${id}-soft)`} />
        </motion.g>
        <rect width="100" height="100" fill={`url(#${id}-sheen)`} />
        <motion.circle cx="50" cy="50" r={rippleRadius} fill="none" stroke="#efffdc" strokeWidth="1.3" style={{ opacity: rippleOpacity }} data-cropy-ripple="" />
      </g>
      <motion.path d={contour} fill="none" stroke="#efffdc" strokeWidth=".6" opacity=".24" />
    </motion.svg>
  </span>;
}
