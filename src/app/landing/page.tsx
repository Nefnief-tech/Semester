"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Copy,
  FileText,
  GraduationCap,
  Sparkles,
  Undo2,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useT } from "@/lib/i18n";
import LangToggle from "@/components/ui/LangToggle";

/**
 * Marketing landing at /landing — "Plans change at 7:45".
 * An editorial, kinetic page that tells one school day through the product,
 * in the app's own paper / forest-green / Fraunces world. Real screenshots
 * and real mini-UI previews instead of mock-ups; one subject marquee; an
 * animated substitution story; a day timeline. Scoped under `.lp` so nothing
 * leaks into the app shell. Locked light; reduced-motion gets the finished
 * layout with every animation settled.
 */

const LP_CSS = `
.lp {
  --lp-bg: #f5f2ea; --lp-bg2: #edeade; --lp-panel: #fdfcf8; --lp-panel2: #f9f6ee;
  --lp-line: #e0dacb; --lp-line-soft: #eae5d8; --lp-ink: #26221b; --lp-soft: #6b6455;
  --lp-faint: #a49b88; --lp-accent: #31633f; --lp-accent-deep: #24492f; --lp-accent-soft: #e2eadd;
  --lp-amber: #8a6a10; --lp-marker: #c14b26;
  --lp-inset: rgba(255,255,255,.8); --lp-drop: rgba(38,34,27,.45); --lp-drop-soft: rgba(38,34,27,.35);
  --lp-head-bg: rgba(224,218,203,.5); --lp-stroke: rgba(49,99,63,.5); --lp-panel-inset: rgba(255,255,255,.5);
  --lp-radius: 18px;
  background: var(--lp-bg); color: var(--lp-ink);
  font-family: var(--font-instrument), system-ui, sans-serif;
  font-size: 16px; line-height: 1.6;
  -webkit-font-smoothing: antialiased; overflow-x: clip;
  min-height: 100dvh;
}
.lp ::selection { background: var(--lp-accent); color: var(--lp-bg); }
/* dark mode — follows the app theme (.dark on <html>, set pre-paint) */
.dark .lp {
  --lp-bg: #17150f; --lp-bg2: #1e1b14; --lp-panel: #211e17; --lp-panel2: #262218;
  --lp-line: #353025; --lp-line-soft: #2b261d; --lp-ink: #ece6d6; --lp-soft: #a29a88;
  --lp-faint: #7a7260; --lp-accent: #8fb99a; --lp-accent-deep: #6f9a7e; --lp-accent-soft: #253528;
  --lp-amber: #d9b95c; --lp-marker: #e08a63;
  --lp-inset: rgba(255,255,255,.05); --lp-drop: rgba(0,0,0,.55); --lp-drop-soft: rgba(0,0,0,.45);
  --lp-head-bg: rgba(53,48,37,.65); --lp-stroke: rgba(143,185,154,.45); --lp-panel-inset: rgba(23,21,15,.6);
  color-scheme: dark;
}
.dark .lp .dotted { background-image: radial-gradient(rgba(143,185,154,.09) 1px, transparent 1.4px); }
.dark .lp .btn-primary { background: var(--lp-accent); color: #17150f; }
.dark .lp .btn-primary:hover { background: var(--lp-ink); }
html:has(.lp) { scroll-behavior: smooth; }
.lp .wrap { max-width: 1200px; margin: 0 auto; padding: 0 28px; }
.lp .display { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; letter-spacing: -0.025em; }
.lp a { color: inherit; }
.lp .mono { font-family: var(--font-plex), monospace; }

/* paper grain + planner dots */
.lp .grain {
  position: fixed; inset: 0; z-index: 90; pointer-events: none; opacity: .035;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
}
.lp .dotted {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image: radial-gradient(rgba(49,99,63,.07) 1px, transparent 1.4px);
  background-size: 26px 26px;
  mask-image: linear-gradient(to bottom, black, transparent 120vh);
  -webkit-mask-image: linear-gradient(to bottom, black, transparent 120vh);
}

/* buttons — pill, the app's shape system */
.lp .btn {
  display: inline-flex; align-items: center; gap: 8px;
  border-radius: 999px; padding: 13px 26px;
  font-size: 15px; font-weight: 500; text-decoration: none; border: 1px solid transparent;
  transition: background-color .2s ease, border-color .2s ease, transform .12s ease, color .2s ease;
}
.lp .btn:active { transform: translateY(1px) scale(.99); }
.lp .btn-primary { background: var(--lp-accent); color: #f5f2ea; }
.lp .btn-primary:hover { background: var(--lp-ink); }
.lp .btn-ghost { border-color: var(--lp-line); color: var(--lp-ink); background: var(--lp-panel); }
.lp .btn-ghost:hover { border-color: var(--lp-accent); color: var(--lp-accent); }

/* nav */
.lp .nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  background: color-mix(in srgb, var(--lp-bg) 78%, transparent);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-bottom: 1px solid var(--lp-line-soft);
}
.lp .nav-inner { display: flex; align-items: center; gap: 28px; height: 66px; }
.lp .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; font-family: var(--font-fraunces), Georgia, serif; font-weight: 600; font-size: 20px; letter-spacing: -0.02em; }
.lp .brand img { width: 26px; height: 26px; border-radius: 7px; box-shadow: 0 2px 6px -2px rgba(49,99,63,.5); }
.lp .nav-links { display: flex; align-items: center; gap: 24px; margin-left: auto; }
.lp .nav-links a:not(.nav-cta) { text-decoration: none; font-size: 14px; color: var(--lp-soft); transition: color .15s ease; }
.lp .nav-links a:not(.nav-cta):hover { color: var(--lp-ink); }
.lp .nav-cta { margin-left: 6px; padding: 9px 20px; font-size: 14px; }
@media (max-width: 720px) { .lp .nav-links a:not(.nav-cta) { display: none; } }

/* ============ hero: manifesto left, live desk right ============ */
.lp .hero { position: relative; z-index: 1; min-height: 100dvh; display: flex; align-items: center; padding: 130px 0 90px; }
.lp .hero-grid { display: grid; grid-template-columns: 11fr 9fr; gap: 56px; align-items: center; width: 100%; }
.lp .hero h1 { font-size: clamp(40px, 4.6vw, 66px); line-height: 1.02; letter-spacing: -0.03em; }
.lp .hero h1 em { font-style: italic; font-weight: 500; color: var(--lp-accent); padding-bottom: .1em; }
.lp .hero .lede { margin: 26px 0 34px; max-width: 46ch; font-size: 17.5px; color: var(--lp-soft); }
.lp .hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; }
@media (max-width: 980px) {
  .lp .hero { min-height: 0; padding-top: 120px; }
  .lp .hero-grid { grid-template-columns: 1fr; gap: 48px; }
}

/* the desk card as a physical thing: perspective stage, mouse tilt,
   ghost cards stacked underneath, floating panes above */
.lp .stage { perspective: 1400px; display: flex; justify-content: center; padding: 10px 0 30px; }
.lp .desk3d {
  position: relative; width: min(460px, 100%); transform-style: preserve-3d;
  transform: rotateX(var(--rx, 6deg)) rotateY(var(--ry, -7deg)); will-change: transform;
}
.lp .desk3d .under-shadow {
  position: absolute; left: 10%; right: 10%; bottom: -38px; height: 78px;
  background: radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--lp-accent) 32%, transparent), transparent 70%);
  filter: blur(26px); transform: translateZ(-90px);
}
.lp .ghost { position: absolute; inset: 0; background: var(--lp-panel); border: 1px solid var(--lp-line); border-radius: 22px; }
.lp .ghost.g1 { transform: translate3d(14px, 18px, -60px) rotate(1.6deg); opacity: .5; }
.lp .ghost.g2 { transform: translate3d(-12px, 34px, -110px) rotate(-2.2deg); opacity: .26; }
.lp .desk { position: relative; transform: translateZ(34px); }
.lp .float-pane {
  position: absolute; padding: 10px 13px;
  background: var(--lp-panel);
  border: 1px solid var(--lp-line); border-radius: 13px;
  box-shadow: 0 24px 50px -26px var(--lp-drop), inset 0 1px 0 var(--lp-inset);
  font-size: 11.5px;
}
.lp .float-pane .k { display: block; font-family: var(--font-plex), monospace; font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--lp-faint); margin-bottom: 3px; }
.lp .float-pane b { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; font-size: 15px; }
.lp .fp-avg { right: -26px; top: -32px; transform: translateZ(84px); }
.lp .fp-avg b { color: var(--lp-accent); }
.lp .fp-next { left: -30px; bottom: -28px; transform: translateZ(60px); }
.lp .fp-next b { color: var(--lp-amber); }
@media (max-width: 560px) { .lp .fp-avg { right: -6px; top: -26px; } .lp .fp-next { left: -6px; bottom: -22px; } }
@media (prefers-reduced-motion: no-preference) {
  .lp .float-pane { animation: lp-bob 6s ease-in-out infinite; }
  .lp .fp-next { animation-delay: -3s; }
  @keyframes lp-bob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -8px; } }
}

/* the live desk card — a real mini version of the app's Today view */
.lp .desk {
  background: var(--lp-panel); border: 1px solid var(--lp-line); border-radius: 22px;
  padding: 20px 20px 16px;
  box-shadow: inset 0 1px 0 var(--lp-inset), 0 20px 40px -30px var(--lp-drop-soft);
}
.lp .desk .head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.lp .desk .hello { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; font-size: 20px; }
.lp .desk .date { font-family: var(--font-plex), monospace; font-size: 10px; color: var(--lp-soft); letter-spacing: .14em; text-transform: uppercase; }
.lp .now {
  margin-top: 14px; border: 1px solid color-mix(in srgb, var(--lp-accent) 30%, var(--lp-line));
  background: var(--lp-accent-soft); border-radius: 14px; padding: 12px 14px;
}
.lp .now .k { font-family: var(--font-plex), monospace; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: var(--lp-accent); }
.lp .now .s { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; font-size: 19px; margin-top: 2px; }
.lp .now .m { font-family: var(--font-plex), monospace; font-size: 10.5px; color: var(--lp-soft); margin-top: 1px; }
.lp .now .bar { margin-top: 9px; height: 4px; border-radius: 99px; background: color-mix(in srgb, var(--lp-accent) 20%, transparent); overflow: hidden; }
.lp .now .bar i { display: block; height: 100%; width: 62%; border-radius: 99px; background: var(--lp-accent); }
.lp .desk ul { margin-top: 12px; list-style: none; padding: 0; }
.lp .desk li { display: flex; align-items: center; gap: 9px; padding: 8px 2px; border-top: 1px solid var(--lp-line-soft); font-size: 12.5px; font-weight: 500; }
.lp .desk li:first-child { border-top: 0; }
.lp .desk .tick { width: 15px; height: 15px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--lp-ink) 32%, transparent); flex: none; }
.lp .desk .tick.done { background: var(--lp-accent); border-color: var(--lp-accent); position: relative; }
.lp .desk .tick.done::after { content: ""; position: absolute; left: 4.5px; top: 2px; width: 4px; height: 7px; border: solid #f5f2ea; border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }
.lp .desk .due { margin-left: auto; font-family: var(--font-plex), monospace; font-size: 9.5px; color: var(--lp-faint); }
.lp .desk .due.hot { color: var(--lp-amber); }

/* ============ subject marquee (the one on the page) ============ */
.lp .marquee-sec { position: relative; z-index: 1; padding: 40px 0 30px; overflow: hidden; }
.lp .marquee { display: flex; width: max-content; gap: 0; }
.lp .marquee span {
  display: inline-flex; align-items: center; gap: 28px; padding-right: 28px;
  font-family: var(--font-fraunces), Georgia, serif; font-style: italic; font-weight: 500;
  font-size: clamp(40px, 5vw, 72px); letter-spacing: -0.02em; white-space: nowrap;
  color: transparent; -webkit-text-stroke: 1.2px var(--lp-stroke);
}
.lp .marquee span b { color: var(--lp-accent); -webkit-text-stroke: 0; font-weight: 500; }
.lp .star { width: 20px; height: 20px; flex: none; color: var(--lp-accent); }
@media (prefers-reduced-motion: no-preference) {
  .lp .marquee { animation: lp-slide 42s linear infinite; }
  .lp .marquee:hover { animation-play-state: paused; }
  @keyframes lp-slide { to { transform: translateX(-50%); } }
}
@media (prefers-reduced-motion: reduce) {
  .lp .marquee { width: 100%; overflow: hidden; }
  .lp .marquee span:nth-child(n+2) { display: none; }
}

/* ============ shared section chrome ============ */
.lp section { position: relative; z-index: 1; padding: 104px 0; }
.lp .section-head { max-width: 58ch; margin-bottom: 52px; }
.lp .section-head h2 { font-size: clamp(30px, 3.6vw, 48px); line-height: 1.04; margin-bottom: 14px; }
.lp .section-head p { color: var(--lp-soft); font-size: 16.5px; }
@media (prefers-reduced-motion: no-preference) {
  .lp .reveal { opacity: 0; transform: translateY(22px); transition: opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1); transition-delay: var(--d, 0s); }
  .lp .reveal.in { opacity: 1; transform: none; }
}

/* ============ 7:45 story: copy left, swapping timetable right ============ */
.lp .story { display: grid; grid-template-columns: 10fr 11fr; gap: 56px; align-items: center; }
@media (max-width: 980px) { .lp .story { grid-template-columns: 1fr; gap: 44px; } }
.lp .stamp {
  display: inline-block; transform: rotate(-3deg);
  border: 1.5px solid var(--lp-marker); color: var(--lp-marker); border-radius: 8px;
  font-family: var(--font-plex), monospace; font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
  padding: 5px 10px; margin-bottom: 22px;
}
.lp .tt {
  background: var(--lp-panel); border: 1px solid var(--lp-line); border-radius: 20px; padding: 20px;
  box-shadow: inset 0 1px 0 var(--lp-inset), 0 40px 80px -48px var(--lp-drop);
  transform: perspective(1200px) rotateX(3deg) rotateY(-4deg);
  transition: transform .5s cubic-bezier(.16,1,.3,1);
}
.lp .tt:hover { transform: perspective(1200px) rotateX(0deg) rotateY(0deg); }
@media (prefers-reduced-motion: reduce) {
  .lp .tt, .lp .tt:hover { transform: none; }
}
.lp .tt .tt-grid { border: 1px solid var(--lp-line); border-radius: 13px; overflow: hidden; background: var(--lp-bg2); font-size: 11px; }
.lp .tt .row { display: grid; grid-template-columns: 30px 1fr 1fr 1fr; }
.lp .tt .row > div { padding: 10px 10px; border-top: 1px solid var(--lp-line-soft); min-height: 46px; }
.lp .tt .row.head > div { border-top: 0; font-family: var(--font-plex), monospace; font-size: 9px; letter-spacing: .1em; color: var(--lp-soft); text-transform: uppercase; background: var(--lp-head-bg); }
.lp .tt .pd { font-family: var(--font-plex), monospace; color: var(--lp-faint); text-align: center; }
.lp .tt .less b { display: block; font-size: 12px; }
.lp .tt .less span { font-family: var(--font-plex), monospace; font-size: 9px; color: var(--lp-soft); }
.lp .tt .swap { transition: background-color 1s ease .3s; }
.lp .tt.swap-in .swap { background: rgba(193,75,38,.09); }
.lp .tt .chip { display: inline-block; margin-top: 4px; padding: 2px 8px; border-radius: 99px; font-family: var(--font-plex), monospace; font-size: 8.5px; border: 1px solid; opacity: 0; transform: translateY(4px); transition: opacity .5s ease, transform .5s ease; }
.lp .tt.swap-in .chip.red { transition-delay: .8s; opacity: 1; transform: none; color: var(--lp-marker); border-color: rgba(193,75,38,.4); background: rgba(193,75,38,.08); }
.lp .tt .cell-sub b { transition: text-decoration-color 1s ease .5s; text-decoration: line-through; text-decoration-color: transparent; text-decoration-thickness: 1.5px; }
.lp .tt.swap-in .cell-sub b { text-decoration-color: var(--lp-marker); }
.lp .tt .sub-line { font-size: 10px; color: var(--lp-amber); margin-top: 2px; opacity: 0; transition: opacity .5s ease 1.3s; }
.lp .tt.swap-in .sub-line { opacity: 1; }
.lp .tt .clockline { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
.lp .tt .clockline .t { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; font-size: 19px; }
.lp .tt .clockline .d { font-family: var(--font-plex), monospace; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--lp-soft); }
@media (prefers-reduced-motion: reduce) {
  .lp .tt .chip { opacity: 1; transform: none; }
  .lp .tt .cell-sub b { text-decoration-color: var(--lp-marker); }
  .lp .tt .sub-line { opacity: 1; }
  .lp .tt.swap { background: rgba(193,75,38,.09); }
}

/* ============ desk screenshot ============ */
.lp .shot-frame {
  border: 1px solid var(--lp-line); border-radius: 18px; overflow: hidden;
  background: var(--lp-panel);
  box-shadow: inset 0 1px 0 var(--lp-inset), 0 50px 100px -56px var(--lp-drop);
}
.lp .shot-frame img { display: block; width: 100%; height: auto; }
.lp .desk-shot { position: relative; }
.lp .desk-shot::before {
  content: ""; position: absolute; inset: -1px; pointer-events: none;
  background: radial-gradient(60% 55% at 50% 0%, rgba(49,99,63,.12), transparent 70%);
}

/* ============ bento ============ */
.lp .bento { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
.lp .bento .cell {
  grid-column: span 4;
  background: var(--lp-panel);
  border: 1px solid var(--lp-line); border-radius: var(--lp-radius);
  padding: 26px; display: flex; flex-direction: column; gap: 10px;
  position: relative; overflow: hidden;
  box-shadow: 0 12px 32px -26px var(--lp-drop-soft);
  transition: border-color .25s ease, transform .25s ease;
}
.lp .bento .cell:hover { border-color: color-mix(in srgb, var(--lp-accent) 45%, var(--lp-line)); transform: translateY(-3px); }
.lp .cell.span7 { grid-column: span 7; }
.lp .cell.span5 { grid-column: span 5; background: linear-gradient(165deg, var(--lp-accent-soft), var(--lp-panel) 78%); }
.lp .cell.span12 { grid-column: span 12; flex-direction: row; align-items: center; justify-content: space-between; gap: 36px; }
.lp .cell.dotted-bg { background-image: radial-gradient(rgba(49,99,63,.1) 1px, transparent 1.4px); background-size: 18px 18px; }
@media (max-width: 980px) {
  .lp .cell, .lp .cell.span7, .lp .cell.span5, .lp .cell.span12 { grid-column: span 12; }
  .lp .cell.span12 { flex-direction: column; align-items: stretch; }
}
.lp .cell .icon { width: 36px; height: 36px; border-radius: 999px; background: var(--lp-accent-soft); border: 1px solid color-mix(in srgb, var(--lp-accent) 22%, var(--lp-line)); display: grid; place-items: center; color: var(--lp-accent); }
.lp .cell h3 { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; font-size: 20px; margin-top: 4px; }
.lp .cell p { font-size: 14px; color: var(--lp-soft); }
.lp .grade-demo { margin-top: auto; display: flex; align-items: center; gap: 12px; border: 1px solid color-mix(in srgb, var(--lp-accent) 25%, var(--lp-line)); border-radius: 13px; background: var(--lp-panel-inset); padding: 13px 15px; }
.lp .grade-demo .g { font-family: var(--font-plex), monospace; font-weight: 600; font-size: 16px; color: var(--lp-accent); }
.lp .grade-demo .bar { flex: 1; height: 4px; border-radius: 99px; background: linear-gradient(90deg, var(--lp-accent), var(--lp-amber), var(--lp-marker)); position: relative; }
.lp .grade-demo .bar i { position: absolute; top: -4.5px; left: 62%; width: 2.5px; height: 13px; border-radius: 2px; background: var(--lp-ink); }
.lp .grade-demo .pts { font-family: var(--font-plex), monospace; font-size: 10.5px; color: var(--lp-soft); }

/* ============ one tuesday: timeline ============ */
.lp .day { padding-bottom: 60px; }
.lp .timeline { position: relative; margin-top: 8px; }
.lp .timeline::before {
  content: ""; position: absolute; left: 89px; top: 8px; bottom: 8px; width: 1px; background: var(--lp-line);
}
.lp .t-row { position: relative; display: grid; grid-template-columns: 70px 40px 1fr; gap: 0 0; padding: 26px 0; }
.lp .t-row .t-time { font-family: var(--font-plex), monospace; font-size: 13px; color: var(--lp-soft); padding-top: 14px; text-align: right; }
.lp .t-row .t-dot { position: relative; }
.lp .t-row .t-dot::before {
  content: ""; position: absolute; left: 19px; top: 19px; width: 11px; height: 11px; border-radius: 99px;
  background: var(--lp-accent); box-shadow: 0 0 0 4px var(--lp-bg);
}
.lp .t-card {
  background: var(--lp-panel); border: 1px solid var(--lp-line); border-radius: 16px; padding: 22px 26px;
  box-shadow: 0 12px 32px -26px var(--lp-drop-soft);
}
.lp .t-card h3 { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; font-size: 21px; margin-bottom: 6px; }
.lp .t-card p { color: var(--lp-soft); font-size: 14.5px; max-width: 58ch; }
.lp .t-card .tagline { display: inline-block; margin-bottom: 8px; font-family: var(--font-plex), monospace; font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--lp-accent); }
@media (max-width: 720px) {
  .lp .timeline::before { left: 19px; }
  .lp .t-row { grid-template-columns: 40px 1fr; }
  .lp .t-row .t-time { grid-column: 2; text-align: left; padding: 0 0 6px 14px; }
  .lp .t-row .t-dot { grid-row: 1 / span 2; }
  .lp .t-row .t-dot::before { left: 14px; top: 22px; }
}

/* ============ spec band ============ */
.lp .specs { border-top: 1px solid var(--lp-line); display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; padding-top: 44px; }
@media (max-width: 780px) { .lp .specs { grid-template-columns: 1fr; gap: 28px; } }
.lp .spec .k { font-family: var(--font-plex), monospace; font-size: 10.5px; letter-spacing: .18em; text-transform: uppercase; color: var(--lp-accent); margin-bottom: 10px; }
.lp .spec h3 { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; font-size: 22px; margin-bottom: 8px; }
.lp .spec p { color: var(--lp-soft); font-size: 14.5px; }

/* ============ CTA + footer ============ */
.lp .cta { padding: 90px 0 110px; }
.lp .cta-box {
  position: relative; overflow: hidden; border-radius: 26px; padding: 64px 56px;
  background: radial-gradient(80% 120% at 85% -10%, rgba(143,185,154,.35), transparent 60%), linear-gradient(160deg, #24492c, #14231a);
  border: 1px solid rgba(49,99,63,.6);
  color: #f5f2ea;
  display: flex; align-items: center; justify-content: space-between; gap: 36px; flex-wrap: wrap;
}
.lp .cta-box h2 { font-family: var(--font-fraunces), Georgia, serif; font-weight: 560; font-size: clamp(28px, 3.4vw, 42px); letter-spacing: -0.02em; }
.lp .cta-box p { color: rgba(245,242,234,.72); font-size: 15.5px; margin-top: 8px; max-width: 50ch; }
.lp .cta-box .btn-primary { background: #f5f2ea; color: #14231a; }
.lp .cta-box .btn-primary:hover { background: #d9e5da; }
.lp .cta-box .btn-ghost { border-color: rgba(245,242,234,.35); background: transparent; color: #f5f2ea; }
.lp .cta-box .btn-ghost:hover { border-color: #f5f2ea; }
@media (max-width: 780px) { .lp .cta-box { padding: 44px 30px; } }
.lp .footer { border-top: 1px solid var(--lp-line-soft); padding: 30px 0 44px; color: var(--lp-soft); font-size: 13px; }
.lp .foot-inner { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.lp .foot-inner .brand { font-size: 16px; }
.lp .foot-right { margin-left: auto; display: flex; gap: 20px; }
.lp .foot-inner a { text-decoration: none; }
.lp .foot-inner a:hover { color: var(--lp-ink); }
`;

export default function LandingPage() {
  const t = useT();
  // the desk card shows today's real date — written straight into the DOM
  // after mount (an external system), so there is no SSR mismatch
  const dateRef = useRef<HTMLSpanElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const desk3dRef = useRef<HTMLDivElement>(null);

  /* date stamp + scroll reveals + the 7:45 swap, one mount effect */
  useEffect(() => {
    if (dateRef.current) {
      dateRef.current.textContent = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });
    }

    const els = document.querySelectorAll(".lp .reveal, .lp .tt");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("in", "swap-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in", "swap-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.25 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* the desk card tilts toward the cursor — spring-smoothed, fine pointers
     only, never under reduced motion */
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!matchMedia("(pointer: fine)").matches) return;
    const hero = heroRef.current;
    const card = desk3dRef.current;
    if (!hero || !card) return;
    let tx = 6, ty = -7, cx = 6, cy = -7;
    let raf: number | null = null;
    const tick = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      card.style.setProperty("--rx", cx.toFixed(2) + "deg");
      card.style.setProperty("--ry", cy.toFixed(2) + "deg");
      if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) raf = requestAnimationFrame(tick);
      else raf = null;
    };
    const kick = () => {
      if (raf === null) raf = requestAnimationFrame(tick);
    };
    const move = (e: MouseEvent) => {
      const r = hero.getBoundingClientRect();
      tx = 6 - ((e.clientY - r.top) / r.height - 0.5) * 12;
      ty = -7 + ((e.clientX - r.left) / r.width - 0.5) * 14;
      kick();
    };
    const leave = () => {
      tx = 6;
      ty = -7;
      kick();
    };
    hero.addEventListener("mousemove", move);
    hero.addEventListener("mouseleave", leave);
    return () => {
      hero.removeEventListener("mousemove", move);
      hero.removeEventListener("mouseleave", leave);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  const brand = (
    <img
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='96' fill='%2331633f'/%3E%3Cg stroke='%23f5f2ea' stroke-width='34' stroke-linecap='round'%3E%3Cline x1='256' y1='128' x2='256' y2='384'/%3E%3Cline x1='143.6' y1='192' x2='368.4' y2='320'/%3E%3Cline x1='143.6' y1='320' x2='368.4' y2='192'/%3E%3C/g%3E%3Ccircle cx='256' cy='256' r='40' fill='%23f5f2ea'/%3E%3C/svg%3E"
      alt=""
    />
  );

  const star = (cls: string) => (
    <svg className={cls} viewBox="0 0 512 512" aria-hidden focusable="false">
      <g stroke="currentColor" strokeWidth="40" strokeLinecap="round">
        <line x1="256" y1="96" x2="256" y2="416" />
        <line x1="121" y1="176" x2="391" y2="336" />
        <line x1="121" y1="336" x2="391" y2="176" />
      </g>
      <circle cx="256" cy="256" r="46" fill="currentColor" />
    </svg>
  );

  const subjects = ["Mathe", "Deutsch", "Englisch", "Physik", "Bio", "Geschichte", "Sport", "Kunst"];

  return (
    <div className="lp">
      <style dangerouslySetInnerHTML={{ __html: LP_CSS }} />
      <div className="dotted" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <nav className="nav">
        <div className="wrap nav-inner">
          <a className="brand" href="/landing">
            {brand}
            Semester.
          </a>
          <div className="nav-links">
            <a href="/landing#features">{t("Features")}</a>
            <a href="/landing#system">{t("How it works")}</a>
            <Link href="/docs">{t("Docs")}</Link>
            <LangToggle />
            <ThemeToggle />
            <Link className="btn btn-primary nav-cta" href="/">
              {t("Open the app")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ============ hero: manifesto + live desk ============ */}
      <header className="hero" ref={heroRef}>
        <div className="wrap hero-grid">
          <div>
            <h1 className="display">
              {t("Plans change at 7:45.")}
              <br />
              <em>{t("Your desk doesn't.")}</em>
            </h1>
            <p className="lede">
              {t("Semester puts your timetable, tasks, homework, grades and study material on one desk that keeps up when the substitute plan flips. Web and phone, always in sync.")}
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href="/">
                {t("Open your desk")}
              </Link>
              <a
                className="btn btn-ghost"
                href="https://github.com/Nefnief-tech/study/releases"
              >
                {t("Download for Android")}
              </a>
            </div>
          </div>

          <div className="stage">
            <div className="desk3d" ref={desk3dRef}>
              <div className="under-shadow" aria-hidden="true" />
              <div className="ghost g1" aria-hidden="true" />
              <div className="ghost g2" aria-hidden="true" />
              <div
                className="desk"
                role="img"
                aria-label="Preview of Semester's Today view: the current lesson with a progress bar and two open tasks"
              >
                <div className="head">
                  <span className="hello">{t("Today")}</span>
                  <span className="date" ref={dateRef}>
                    &nbsp;
                  </span>
                </div>
                <div className="now">
                  <span className="k">{t("Now · until")} 10:45</span>
                  <div className="s">Sport</div>
                  <div className="m">{t("Gym · Fr. Lauf · 18 min left")}</div>
                  <div className="bar">
                    <i />
                  </div>
                </div>
                <ul>
                  <li>
                    <span className="tick done" />
                    Geschichte Quellenarbeit
                    <span className="due">{t("done")}</span>
                  </li>
                  <li>
                    <span className="tick" />
                    Mathe Blatt 14
                    <span className="due hot">{t("today")}</span>
                  </li>
                  <li>
                    <span className="tick" />
                    Englisch Vokabeln
                    <span className="due">{t("tomorrow")}</span>
                  </li>
                </ul>
              </div>
              <div className="float-pane fp-avg">
                <span className="k">{t("avg. grade")}</span>
                <b>2,3</b>
              </div>
              <div className="float-pane fp-next">
                <span className="k">{t("tomorrow, 3rd pd.")}</span>
                <b>Sport → Fr. Lauf</b>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============ the one marquee: subjects, shared by everything ============ */}
      <div className="marquee-sec" aria-hidden="true">
        <div className="marquee">
          {[0, 1].map((copy) => (
            <span key={copy}>
              {subjects.map((s) => (
                <b key={s}>
                  {s}
                  {star("star")}
                </b>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ============ 7:45: the substitution story ============ */}
      <section id="features">
        <div className="wrap">
          <div className="story">
            <div className="reveal">
              <span className="stamp">7:45 · {t("DER PLAN KIPPT")}</span>
              <h2 className="display" style={{ fontSize: "clamp(30px, 3.6vw, 48px)", lineHeight: 1.04, marginBottom: 14 }}>
                {t("The plan you copied this morning is already old.")}
              </h2>
              <p style={{ color: "var(--lp-soft)", fontSize: 16.5 }}>
                {t("Semester pulls the substitute plan straight from your school portal and rewrites the grid before you reach school: cancellations crossed out, substitutes and rooms filled in. Upcoming Schulaufgaben land on your calendar and in your tasks on their own.")}
              </p>
            </div>

            <div
              className="tt"
              role="img"
              aria-label="Timetable fragment where the Englisch lesson in period 3 is cancelled and Sport moves in with substitute Fr. Lauf"
            >
              <div className="clockline">
                <span className="t">This week</span>
                <span className="d">Mon · Wed · Fri</span>
              </div>
              <div className="tt-grid">
                <div className="row head">
                  <div>Pd</div>
                  <div>Mon</div>
                  <div>Wed</div>
                  <div>Fri</div>
                </div>
                <div className="row">
                  <div className="pd">1</div>
                  <div className="less"><b>Mathe</b><span>B1</span></div>
                  <div className="less"><b>Sport</b><span>Gym</span></div>
                  <div className="less"><b>Englisch</b><span>112</span></div>
                </div>
                <div className="row">
                  <div className="pd">3</div>
                  <div className="less"><b>Physik</b><span>Lab</span></div>
                  <div className="less swap cell-sub">
                    <b>Sport</b>
                    <span>Gym</span>
                    <span className="chip red">cancelled</span>
                  </div>
                  <div className="less">
                    <b>Musik</b>
                    <span>112</span>
                    <div className="sub-line">→ Sport · Fr. Lauf · Gym</div>
                  </div>
                </div>
                <div className="row">
                  <div className="pd">5</div>
                  <div className="less"><b>Deutsch</b><span>B2</span></div>
                  <div className="less"><b>Mathe</b><span>B1</span></div>
                  <div className="less"><b>Bio</b><span>Lab 2</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ the desk itself ============ */}
      <section>
        <div className="wrap">
          <div className="section-head reveal">
            <h2 className="display">{t("The desk itself.")}</h2>
            <p>
              {t("One overview with everything that matters today: open tasks, due dates, your grade average and the week ahead.")}
            </p>
          </div>
          <div className="desk-shot shot-frame reveal">
            <Image
              src="/shots/desk.png"
              alt="The Semester overview: greeting, current lesson, task queue, week strip and subject grades"
              width={1720}
              height={1160}
              priority
              sizes="(max-width: 1200px) 100vw, 1144px"
            />
          </div>
        </div>
      </section>

      {/* ============ features bento ============ */}
      <section>
        <div className="wrap">
          <div className="section-head reveal">
            <h2 className="display">{t("Everything a school week throws at you.")}</h2>
            <p>{t("Six tools that share one set of subjects, one timetable and one database. No export-import dances between apps.")}</p>
          </div>

          <div className="bento">
            <div className="cell span7 reveal">
              <div className="icon"><GraduationCap size={17} /></div>
              <h3>{t("Tasks & homework")}</h3>
              <p>{t("Due dates with times, priorities, subject tags and notes. The overview groups them by urgency: overdue, today, this week.")}</p>
            </div>

            <div className="cell span5 reveal" style={{ "--d": ".08s" } as React.CSSProperties}>
              <div className="icon"><Copy size={17} /></div>
              <h3>{t("Grades")}</h3>
              <p>{t("Weighted per-subject averages in the Punkte system, shown as the German Note scale.")}</p>
              <div className="grade-demo">
                <span className="g">2,3</span>
                <span className="bar"><i /></span>
                <span className="pts">12 P</span>
              </div>
            </div>

            <div className="cell span12 dotted-bg reveal" style={{ "--d": ".05s" } as React.CSSProperties}>
              <div style={{ maxWidth: "46ch" }}>
                <div className="icon"><Clock size={17} /></div>
                <h3>{t("Timetable with live substitutions")}</h3>
                <p>{t("Import your weekly grid once, then watch the school portal rewrite it live. Double periods, rooms and substitutes included.")}</p>
              </div>
              <div className="shot-frame" style={{ width: "min(480px, 100%)" }}>
                <Image src="/shots/timetable.png" alt="Semester timetable with a cancelled and a substituted lesson marked" width={1720} height={1160} sizes="480px" />
              </div>
            </div>

            <div className="cell span4 reveal">
              <div className="icon"><Calendar size={17} /></div>
              <h3>{t("Calendar")}</h3>
              <p>{t("Month and week views that combine events, exams, deadlines and task due dates in one place.")}</p>
            </div>

            <div className="cell span4 reveal" style={{ "--d": ".08s" } as React.CSSProperties}>
              <div className="icon"><Undo2 size={17} /></div>
              <h3>{t("Daily digest")}</h3>
              <p>{t("Every afternoon, a push with tomorrow's classes, overdue homework and upcoming exams.")}</p>
            </div>

            <div className="cell span4 reveal" style={{ "--d": ".16s" } as React.CSSProperties}>
              <div className="glow-top" />
              <div className="icon"><Sparkles size={17} /></div>
              <h3>{t("AI study room")}</h3>
              <p>{t("Chat with grounded answers that cite your documents, and auto-build flashcard decks.")}</p>
            </div>

            <div className="cell span12 reveal" style={{ "--d": ".05s" } as React.CSSProperties}>
              <div style={{ maxWidth: "46ch" }}>
                <div className="icon"><FileText size={17} /></div>
                <h3>{t("Your documents, answered.")}</h3>
                <p>{t("Upload PDFs, slides or notes and ask away. Answers are grounded in your material and cite the exact page.")}</p>
              </div>
              <div className="shot-frame" style={{ width: "min(480px, 100%)" }}>
                <Image src="/shots/room.png" alt="AI study room chat answering with a citation from an uploaded document" width={1720} height={1160} sizes="480px" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ one tuesday, on Semester ============ */}
      <section className="day" id="system">
        <div className="wrap">
          <div className="section-head reveal">
            <h2 className="display">{t("One Tuesday, on Semester.")}</h2>
            <p>{t("From the morning plan flip to the evening study session. The boring parts are the feature.")}</p>
          </div>

          <div className="timeline">
            <div className="t-row reveal">
              <div className="t-time">07:45</div>
              <div className="t-dot" />
              <div className="t-card">
                <span className="tagline">{t("substitutions")}</span>
                <h3>{t("The portal flips.")}</h3>
                <p>{t("Sport is cancelled, Fr. Lauf takes over in the Gym. The grid on your phone is already rewritten before you leave the house.")}</p>
              </div>
            </div>
            <div className="t-row reveal">
              <div className="t-time">08:00</div>
              <div className="t-dot" />
              <div className="t-card">
                <span className="tagline">{t("the grid knows")}</span>
                <h3>{t("Now: Sport, Gym, 18 minutes left.")}</h3>
                <p>{t("The overview shows the running lesson with a progress bar, then the next one. No counting periods in your head.")}</p>
              </div>
            </div>
            <div className="t-row reveal">
              <div className="t-time">13:05</div>
              <div className="t-dot" />
              <div className="t-card">
                <span className="tagline">{t("Tasks")}</span>
                <h3>{t("Tick it off, type the next one.")}</h3>
                <p>{t("Today's pile at the top, quick-add one field below it. Homework and tasks live side by side and land on the calendar by themselves.")}</p>
              </div>
            </div>
            <div className="t-row reveal">
              <div className="t-time">17:00</div>
              <div className="t-dot" />
              <div className="t-card">
                <span className="tagline">{t("Daily digest")}</span>
                <h3>{t("Your phone knows tomorrow.")}</h3>
                <p>{t("An afternoon push: tomorrow's classes, what is overdue, which Schulaufgaben are creeping closer.")}</p>
              </div>
            </div>
            <div className="t-row reveal">
              <div className="t-time">21:30</div>
              <div className="t-dot" />
              <div className="t-card">
                <span className="tagline">{t("Study Room")}</span>
                <h3>{t("Ask your own documents.")}</h3>
                <p>{t("Upload the history PDF once, then ask. Answers cite the exact page, and flashcard decks build themselves.")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ spec band ============ */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap reveal">
          <div className="specs">
            <div className="spec">
              <div className="k">{t("Autosave")}</div>
              <h3>{t("No save buttons, anywhere.")}</h3>
              <p>{t("Every edit commits as you type. Closing a form can never lose input, on web and phone alike.")}</p>
            </div>
            <div className="spec">
              <div className="k">{t("Sync")}</div>
              <h3>{t("Offline first, always agreeing.")}</h3>
              <p>{t("Edits live locally first and win over the cloud until their push lands. Devices agree without coordination.")}</p>
            </div>
            <div className="spec">
              <div className="k">{t("Privacy")}</div>
              <h3>{t("Credentials stay put.")}</h3>
              <p>{t("Portal logins never leave your device except to your own server for the fetch. Self-hosted, open source.")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="cta">
        <div className="wrap">
          <div className="cta-box reveal">
            <div>
              <h2>{t("Set up your desk in one afternoon.")}</h2>
              <p>{t("Paste your timetable as JSON, connect your school portal, install the app. Everything else follows.")}</p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="btn btn-primary" href="/">
                {t("Open your desk")}
              </Link>
              <a className="btn btn-ghost" href="https://github.com/Nefnief-tech/study#readme">
                {t("Read the docs")}
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap foot-inner">
          <a className="brand" href="/landing">
            {brand}
            Semester.
          </a>
          <span>{t("Open source and self-hostable.")}</span>
            <div className="foot-right">
              <Link href="/docs">Docs</Link>
              <a href="https://github.com/Nefnief-tech/study">GitHub</a>
              <a href="https://github.com/Nefnief-tech/study/releases">Releases</a>
            </div>
        </div>
      </footer>
    </div>
  );
}
