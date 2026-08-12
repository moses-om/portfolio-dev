/**
 * Moses AI Assistant Widget (Phase 9A.2 — Conversational Portfolio Guide)
 * Purpose-built portfolio discovery interface inspired by Apple Intelligence,
 * Notion AI, Perplexity, and Linear. Communicates with /api/chat (Gemini Backend).
 */
(function () {
  'use strict';

  if (document.getElementById('moses-local-assistant')) return;

  const API_BASE = window.MOSES_AI_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3001' : 'https://moses-ai-backend.onrender.com');
  const API_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/chat`;
  let conversationHistory = [];

  // Strict allowlist for internal portfolio section navigation
  const PORTFOLIO_SECTIONS = ['hero', 'about', 'skills', 'projects', 'experience', 'research', 'contact'];

  // ═══════════════════════════════════════════════
  // 1. SCOPED CSS
  // ═══════════════════════════════════════════════
  const style = document.createElement('style');
  style.id = 'moses-local-assistant-styles';
  style.textContent = `
    /* ─── ROOT CONTAINER (UNLOCKED AT LAST SECTION: #contact) ─── */
    #moses-local-assistant {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 14px;
      opacity: 0;
      pointer-events: none;
    }

    /* ─── FUTURISTIC ARC-LAUNCH ENTRY ANIMATION ─── */
    /* ─── ELEGANT 4-ACT ENTRANCE CHOREOGRAPHY ───
         Act 1 (0→22%):   Spring Pop Entrance — tiny → overshoot → spring back → settle
         Act 2 (22→35%):  Patient Hold — rests briefly at top right
         Act 3 (35→82%):  Continuous Depth Descent — grows as it approaches midpoint,
                          shrinks back to original size as it reaches landing
         Act 4 (82→100%): Soft Landing Bounce & Settle
    ─────────────────────────────────────────────────── */
    @keyframes mosesOblateEntry {

      /* Act 1a: Smooth gentle pop-in — starts soft, no harsh snap */
      0% {
        opacity: 1;
        transform: translateY(calc(-100vh + 100px)) scale(0.2);
        filter: drop-shadow(0 0 6px rgba(212, 160, 23, 0.4));
        animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
      }

      /* Act 1b: Soft overshoot — gentle expansion */
      10% {
        opacity: 1;
        transform: translateY(calc(-100vh + 100px)) scale(1.16);
        filter: brightness(1.12) drop-shadow(0 0 20px rgba(212, 160, 23, 0.65));
        animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
      }

      /* Act 1c: Soft recoil settle */
      18% {
        opacity: 1;
        transform: translateY(calc(-100vh + 100px)) scale(0.96);
        filter: drop-shadow(0 0 12px rgba(212, 160, 23, 0.4));
        animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
      }

      /* Act 1d & Act 2: Settled at top right — patient hold */
      25% {
        opacity: 1;
        transform: translateY(calc(-100vh + 100px)) scale(1.0);
        filter: drop-shadow(0 0 14px rgba(212, 160, 23, 0.4));
        animation-timing-function: linear;
      }
      36% {
        opacity: 1;
        transform: translateY(calc(-100vh + 100px)) scale(1.0);
        filter: drop-shadow(0 0 14px rgba(212, 160, 23, 0.4));
        /* Ease-in timing function: starts descent gently and picks up momentum */
        animation-timing-function: cubic-bezier(0.42, 0, 1, 1);
      }

      /* Act 3a: Midpoint of screen — sweeps through at peak speed & scale */
      60% {
        opacity: 1;
        transform: translateY(calc(-48vh)) scale(1.46);
        filter: brightness(1.14) drop-shadow(0 0 28px rgba(212, 160, 23, 0.65));
        /* Ease-out timing function: smoothly decelerates into landing */
        animation-timing-function: cubic-bezier(0, 0, 0.58, 1);
      }

      /* Act 3b: Arrives at landing spot — back to original scale */
      83% {
        opacity: 1;
        transform: translateY(0) scale(1.0);
        filter: brightness(1.0) drop-shadow(0 4px 14px rgba(0, 0, 0, 0.28));
        animation-timing-function: linear;
      }

      /* Act 4a: Soft landing bounce — float up slightly */
      90% {
        opacity: 1;
        transform: translateY(-12px) scale(1.06);
        filter: brightness(1.05) drop-shadow(0 6px 18px rgba(212, 160, 23, 0.45));
        animation-timing-function: linear;
      }

      /* Act 4b: Gentle dip back down */
      96% {
        opacity: 1;
        transform: translateY(3px) scale(0.98);
        animation-timing-function: linear;
      }

      /* Act 4c: Final settled rest */
      100% {
        opacity: 1;
        transform: translateY(0) scale(1.0);
        filter: brightness(1.0) drop-shadow(0 0 14px rgba(212, 160, 23, 0.35));
      }
    }

    #moses-local-assistant.launching {
      animation: mosesOblateEntry 6.5s linear forwards;
      pointer-events: none;
    }

    #moses-local-assistant.launched {
      opacity: 1;
      transform: translateX(0) translateY(0) scale(1);
      pointer-events: auto;
    }

    /* ─── INTRO SPEECH BUBBLE ─── */
    .moses-intro-bubble {
      position: absolute;
      /* sits above the launcher; launcher is ~60px, gap is 14px */
      bottom: calc(100% + 18px);
      right: 0;
      background: linear-gradient(135deg, #0D1B3E 0%, #071024 55%, #1F0712 100%);
      border: 1.5px solid rgba(212, 160, 23, 0.6);
      border-radius: 14px 14px 4px 14px;
      padding: 10px 18px;
      color: rgba(255, 255, 255, 0.93);
      font-size: 0.8rem;
      font-weight: 400;
      letter-spacing: 0.01em;
      white-space: nowrap;
      box-shadow:
        0 8px 28px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(212, 160, 23, 0.12),
        0 2px 8px rgba(212, 160, 23, 0.18);
      transform-origin: bottom right;
      opacity: 0;
      pointer-events: auto;
      cursor: pointer;
      z-index: 1;
      transition:
        transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
        border-color 0.25s ease,
        box-shadow 0.25s ease,
        background 0.25s ease;
    }

    .moses-intro-bubble:hover {
      transform: translateY(-4px) scale(1.05);
      border-color: rgba(255, 215, 0, 0.95);
      background: linear-gradient(135deg, #11224D 0%, #0A1633 55%, #2B0A19 100%);
      box-shadow:
        0 14px 38px rgba(3, 7, 18, 0.75),
        0 0 22px rgba(212, 160, 23, 0.45),
        inset 0 1px 1px rgba(255, 255, 255, 0.3);
    }

    /* Triangle pointer — points down-right toward the orb */
    .moses-intro-bubble::after {
      content: '';
      position: absolute;
      bottom: -7px;
      right: 18px;
      width: 0;
      height: 0;
      border-left: 7px solid transparent;
      border-right: 0px solid transparent;
      border-top: 7px solid rgba(212, 160, 23, 0.6);
      transition: border-top-color 0.25s ease;
    }

    .moses-intro-bubble:hover::after {
      border-top-color: rgba(255, 215, 0, 0.95);
    }

    .moses-intro-bubble.show {
      animation: mosesIntroIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .moses-intro-bubble.hide {
      animation: mosesIntroOut 0.4s ease-in forwards;
    }

    @keyframes mosesIntroIn {
      0%   { opacity: 0; transform: scale(0.65) translateY(10px); filter: blur(2px); }
      60%  { opacity: 1; transform: scale(1.04) translateY(-2px); filter: blur(0); }
      100% { opacity: 1; transform: scale(1)    translateY(0);     filter: blur(0); }
    }

    @keyframes mosesIntroOut {
      0%   { opacity: 1; transform: scale(1)    translateY(0);    filter: blur(0); }
      100% { opacity: 0; transform: scale(0.88) translateY(-8px); filter: blur(1px); }
    }

    /* ─── FLOATING LAUNCHER (60px) ─── */
    .moses-launcher {
      position: relative;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 30% 25%, rgba(255, 215, 0, 0.28), transparent 45%),
        radial-gradient(circle at 75% 80%, rgba(107, 26, 42, 0.35), transparent 50%),
        linear-gradient(145deg, #0D1B3E 0%, #071024 60%, #1F0712 100%);
      border: 1.5px solid rgba(212, 160, 23, 0.45);
      box-shadow:
        0 12px 32px rgba(3, 7, 18, 0.65),
        0 4px 14px rgba(212, 160, 23, 0.18),
        inset 0 1.5px 1px rgba(255, 255, 255, 0.25);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition:
        transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 0.25s ease,
        border-color 0.25s ease;
      outline: none;
      overflow: visible;
      animation: mosesLauncherIdle 4.5s ease-in-out infinite;
    }

    @keyframes mosesLauncherIdle {
      0%, 100% {
        transform: translateY(0) scale(1);
        box-shadow:
          0 12px 32px rgba(3, 7, 18, 0.65),
          0 4px 14px rgba(212, 160, 23, 0.18),
          inset 0 1.5px 1px rgba(255, 255, 255, 0.25);
      }
      50% {
        transform: translateY(-3px) scale(1.025);
        box-shadow:
          0 16px 38px rgba(3, 7, 18, 0.72),
          0 6px 20px rgba(212, 160, 23, 0.28),
          inset 0 1.5px 1px rgba(255, 255, 255, 0.32);
      }
    }

    .moses-launcher:hover {
      transform: translateY(-4px) scale(1.05);
      border-color: rgba(255, 215, 0, 0.75);
      box-shadow:
        0 20px 48px rgba(3, 7, 18, 0.75),
        0 8px 24px rgba(212, 160, 23, 0.35),
        inset 0 1.5px 1px rgba(255, 255, 255, 0.45);
    }

    .moses-launcher:active {
      transform: translateY(-1px) scale(0.96);
      transition-duration: 0.08s;
    }

    .moses-launcher:focus-visible {
      outline: 2.5px solid #D4A017;
      outline-offset: 4px;
    }

    /* ─── 3D SPHERICAL CORE (DEEP SPACE FLOATING ORB) ─── */
    .moses-launcher-core {
      position: relative;
      width: 84%;
      height: 84%;
      border-radius: 50%;
      background:
        radial-gradient(circle at 35% 22%, rgba(255, 255, 255, 0.58) 0%, rgba(255, 215, 0, 0.38) 16%, transparent 45%),
        radial-gradient(circle at 50% 50%, rgba(212, 160, 23, 0.30) 0%, transparent 62%),
        radial-gradient(circle at 74% 78%, rgba(107, 26, 42, 0.52) 0%, transparent 55%),
        radial-gradient(circle at 50% 50%, #172B54 0%, #081226 58%, #030712 100%);
      box-shadow:
        inset 0 2.5px 4px rgba(255, 255, 255, 0.52),
        inset 0 0 16px rgba(212, 160, 23, 0.42),
        inset 0 -12px 22px rgba(0, 0, 0, 0.85),
        0 8px 24px rgba(0, 0, 0, 0.52);
      transition: transform 0.22s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.25s ease, filter 0.25s ease;
      animation: mosesSpaceOrbFloat 5.5s ease-in-out infinite;
      overflow: hidden;
    }

    @keyframes mosesSpaceOrbFloat {
      0%, 100% {
        transform: translateY(0) scale(1);
        filter: brightness(1) contrast(1) drop-shadow(0 0 10px rgba(212, 160, 23, 0.25));
      }
      50% {
        transform: translateY(-2.5px) scale(1.02);
        filter: brightness(1.16) contrast(1.06) drop-shadow(0 0 18px rgba(212, 160, 23, 0.44));
      }
    }

    .moses-launcher-core::before {
      content: '';
      position: absolute;
      inset: 6%;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 22%, rgba(255, 255, 255, 0.45), transparent 45%);
      opacity: 0.95;
      pointer-events: none;
    }



    /* ─── 4 WHITE AUTONOMOUS PARTICLES OUTSIDE THE CORE ─── */
    .moses-launcher-particle {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 4.5px;
      height: 4.5px;
      margin-top: -2.25px;
      margin-left: -2.25px;
      border-radius: 50%;
      background: radial-gradient(circle, #FFFFFF 0%, rgba(255, 255, 255, 0.9) 60%, transparent 100%);
      box-shadow: 0 0 6px rgba(255, 255, 255, 0.75), 0 0 2px rgba(255, 255, 255, 0.9);
      pointer-events: none;
      will-change: transform, opacity;
    }

    .moses-launcher-particle.particle-1 {
      animation: mosesWander1 7.8s ease-in-out infinite;
    }
    .moses-launcher-particle.particle-2 {
      animation: mosesWander2 9.2s ease-in-out infinite;
    }
    .moses-launcher-particle.particle-3 {
      animation: mosesWander3 8.4s ease-in-out infinite;
    }
    .moses-launcher-particle.particle-4 {
      animation: mosesWander4 10.6s ease-in-out infinite;
    }

    .moses-launcher:hover .moses-launcher-particle {
      filter: brightness(1.2);
    }

    @keyframes mosesWander1 {
      0%, 100% {
        transform: translate(-22px, -18px) scale(0.9);
        opacity: 0.85;
      }
      28% {
        transform: translate(-27px, -9px) scale(1.18);
        opacity: 0.40;
      }
      54% {
        transform: translate(-17px, -25px) scale(0.75);
        opacity: 0.95;
      }
      80% {
        transform: translate(-21px, -13px) scale(1.05);
        opacity: 0.60;
      }
    }

    @keyframes mosesWander2 {
      0%, 100% {
        transform: translate(21px, -17px) scale(1.0);
        opacity: 0.50;
      }
      32% {
        transform: translate(26px, -23px) scale(0.82);
        opacity: 0.92;
      }
      62% {
        transform: translate(16px, -7px) scale(1.22);
        opacity: 0.38;
      }
      84% {
        transform: translate(23px, -19px) scale(0.95);
        opacity: 0.82;
      }
    }

    @keyframes mosesWander3 {
      0%, 100% {
        transform: translate(22px, 19px) scale(1.1);
        opacity: 0.90;
      }
      24% {
        transform: translate(16px, 25px) scale(0.82);
        opacity: 0.42;
      }
      58% {
        transform: translate(27px, 13px) scale(1.08);
        opacity: 0.82;
      }
      82% {
        transform: translate(19px, 17px) scale(0.72);
        opacity: 0.58;
      }
    }

    @keyframes mosesWander4 {
      0%, 100% {
        transform: translate(-19px, 21px) scale(0.8);
        opacity: 0.40;
      }
      36% {
        transform: translate(-25px, 15px) scale(1.12);
        opacity: 0.88;
      }
      68% {
        transform: translate(-15px, 27px) scale(0.88);
        opacity: 0.52;
      }
      88% {
        transform: translate(-21px, 17px) scale(1.02);
        opacity: 0.92;
      }
    }

    /* ─── CLICK INTERACTION: ELEGANT 3D SPRING BOUNCE ─── */
    .moses-launcher.bouncing {
      animation: mosesLauncherBounce 0.34s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }

    .moses-launcher.bouncing .moses-launcher-core {
      animation: mosesCoreBounce 0.34s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }

    .moses-launcher.bouncing .moses-launcher-particle {
      animation: mosesParticleBounce 0.34s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }

    @keyframes mosesLauncherBounce {
      0% {
        transform: translateY(0) scale(1);
      }
      35% {
        transform: translateY(3px) scale(0.93);
      }
      70% {
        transform: translateY(-6px) scale(1.07);
        box-shadow:
          0 24px 54px rgba(3, 7, 18, 0.8),
          0 10px 28px rgba(212, 160, 23, 0.4),
          inset 0 1.5px 1px rgba(255, 255, 255, 0.5);
      }
      100% {
        transform: translateY(0) scale(1);
      }
    }

    @keyframes mosesCoreBounce {
      0% {
        transform: scale(1);
        filter: brightness(1) contrast(1);
      }
      35% {
        transform: scale(0.90);
        filter: brightness(1.2) contrast(1.1);
      }
      70% {
        transform: scale(1.10);
        filter: brightness(1.4) drop-shadow(0 0 18px rgba(255, 215, 0, 0.65));
      }
      100% {
        transform: scale(1);
        filter: brightness(1) contrast(1);
      }
    }

    @keyframes mosesParticleBounce {
      0% {
        transform: scale(1);
        opacity: 0.8;
      }
      35% {
        transform: scale(0.7);
        opacity: 0.9;
      }
      70% {
        transform: scale(1.4);
        opacity: 1;
        filter: brightness(1.4);
      }
      100% {
        transform: scale(1);
        opacity: 0.8;
      }
    }

    /* ─── SUBTLE MAGNETIC MICRO-SPARKS ─── */
    .moses-launcher-sparks {
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      will-change: transform, opacity;
      z-index: 10;
    }

    .moses-launcher.sparking .moses-launcher-sparks {
      opacity: 0.65;
    }

    .moses-launcher-spark {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 1.8px;
      height: 7px;
      margin-top: -3.5px;
      margin-left: -0.9px;
      background: linear-gradient(to bottom, rgba(255, 255, 255, 0.9) 0%, rgba(255, 215, 0, 0.6) 70%, transparent 100%);
      border-radius: 999px;
      box-shadow: 0 0 5px rgba(255, 215, 0, 0.4), 0 0 2px rgba(255, 255, 255, 0.6);
      transform-origin: center bottom;
      opacity: 0;
      will-change: transform, opacity;
    }

    .moses-launcher.sparking .moses-launcher-spark.spark-1 {
      animation: mosesSparkSubtle1 0.6s ease-out infinite;
    }
    .moses-launcher.sparking .moses-launcher-spark.spark-2 {
      animation: mosesSparkSubtle2 0.75s ease-out infinite 0.12s;
    }
    .moses-launcher.sparking .moses-launcher-spark.spark-3 {
      animation: mosesSparkSubtle3 0.68s ease-out infinite 0.25s;
    }

    @keyframes mosesSparkSubtle1 {
      0% { transform: rotate(-15deg) translateY(-14px) scaleY(0.4); opacity: 0; }
      45% { transform: rotate(-10deg) translateY(-22px) scaleY(1); opacity: 0.55; }
      100% { transform: rotate(-5deg) translateY(-28px) scaleY(0.3); opacity: 0; }
    }

    @keyframes mosesSparkSubtle2 {
      0% { transform: rotate(10deg) translateY(-14px) scaleY(0.4); opacity: 0; }
      45% { transform: rotate(18deg) translateY(-24px) scaleY(1); opacity: 0.50; }
      100% { transform: rotate(24deg) translateY(-30px) scaleY(0.3); opacity: 0; }
    }

    @keyframes mosesSparkSubtle3 {
      0% { transform: rotate(-30deg) translateY(-14px) scaleY(0.4); opacity: 0; }
      45% { transform: rotate(-22deg) translateY(-20px) scaleY(1); opacity: 0.48; }
      100% { transform: rotate(-16deg) translateY(-26px) scaleY(0.3); opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .moses-launcher,
      .moses-launcher-core,
      .moses-launcher-orbit,
      .moses-launcher-filament {
        animation: none !important;
      }

      .moses-launcher {
        transition-duration: 0.15s;
      }

      .moses-launcher:hover {
        transform: scale(1.04);
      }

      .moses-launcher-orbit {
        transform: translate(-50%, -50%) translateX(24px);
      }
    }



    /* ─── ASSISTANT PANEL (PREMIUM DISPLACEMENT) ─── */
    .moses-panel {
      width: 420px;
      max-width: calc(100vw - 32px);
      height: 640px;
      max-height: calc(100vh - 90px);
      background: #FFFFFF;
      border-radius: 20px;
      box-shadow:
        0 32px 80px rgba(5, 11, 26, 0.36),
        0 12px 28px rgba(107, 26, 42, 0.15),
        0 0 0 1px rgba(212, 160, 23, 0.18);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      display: none;
      transform-origin: bottom right;
      will-change: transform, opacity, filter;
    }

    .moses-panel.open {
      display: flex;
      animation: mosesPanelDisplaceOpen 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .moses-panel.closing {
      display: flex !important;
      animation: mosesPanelDisplaceClose 0.24s cubic-bezier(0.4, 0, 1, 1) forwards;
      pointer-events: none;
    }

    @keyframes mosesPanelDisplaceOpen {
      0% {
        opacity: 0;
        transform: translateY(28px) scale(0.92) rotate(1deg);
        filter: blur(8px) brightness(0.95);
      }
      60% {
        filter: blur(0px) brightness(1.02);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1) rotate(0deg);
        filter: blur(0px) brightness(1);
      }
    }

    @keyframes mosesPanelDisplaceClose {
      0% {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: blur(0px);
      }
      100% {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        filter: blur(6px);
      }
    }

    /* ─── HEADER (ANIMATED GRADIENT & NEURAL CANVAS) ─── */
    .moses-header {
      background: linear-gradient(135deg, #070E1E 0%, #0D1B3E 45%, #4A0F1C 80%, #0B1936 100%);
      background-size: 260% 260%;
      animation: miraHeaderGradientFlow 14s ease-in-out infinite;
      padding: 16px 18px 14px;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    @keyframes miraHeaderGradientFlow {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }

    #miraHeaderCanvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
      opacity: 0.88;
    }

    .moses-header-info {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 3px;
      width: 100%;
    }

    .moses-header-name {
      font-size: 1.05rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      text-align: center;
    }

    .moses-header-meta {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-weight: 400;
    }

    .moses-status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .moses-status-dot {
      width: 6px;
      height: 6px;
      background: #22C55E;
      border-radius: 50%;
      display: inline-block;
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }

    .moses-status-dot.thinking {
      background: #D4A017;
      animation: mosesStatusPulse 1.2s infinite ease-in-out;
    }

    .moses-status-dot.executing {
      background: #3B82F6;
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.7);
      animation: mosesStatusPulse 0.7s infinite ease-in-out;
    }

    @keyframes mosesStatusPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }

    .moses-close-btn {
      position: absolute;
      top: 14px;
      right: 14px;
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      width: 30px;
      height: 30px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.88rem;
      transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
      outline: none;
      flex-shrink: 0;
      z-index: 100;
      pointer-events: auto;
    }

    .moses-close-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.95);
      transform: scale(1.1);
    }

    .moses-close-btn:focus-visible {
      outline: 2px solid #D4A017;
      outline-offset: 2px;
    }

    /* ─── VOICE VISUALIZER SLOT (Phase 9B) ─── */
    .moses-voice-slot {
      display: none;
      width: 100%;
      height: 0;
    }

    /* ─── MESSAGES AREA ─── */
    .moses-messages {
      flex: 1;
      padding: 20px 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: #FAFAFA;
    }

    .moses-messages::-webkit-scrollbar { width: 4px; }
    .moses-messages::-webkit-scrollbar-track { background: transparent; }
    .moses-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }

    /* ─── MESSAGE BUBBLES ─── */
    .moses-msg {
      max-width: 88%;
      font-family: 'Outfit', sans-serif;
      font-size: 0.875rem;
      line-height: 1.6;
      word-break: break-word;
    }

    .moses-msg.bot {
      color: #1C1917;
      align-self: flex-start;
      padding: 0;
      background: transparent;
    }

    .moses-msg.bot p { margin: 0 0 8px 0; }
    .moses-msg.bot p:last-child { margin-bottom: 0; }

    .moses-msg.bot ul, .moses-msg.bot ol {
      margin: 6px 0 10px 0;
      padding-left: 20px;
    }

    .moses-msg.bot li {
      margin-bottom: 4px;
      line-height: 1.55;
    }

    .moses-msg.bot strong { color: #0D1B3E; font-weight: 600; }

    .moses-msg.bot code {
      background: rgba(107, 26, 42, 0.06);
      color: #6B1A2A;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'DM Mono', ui-monospace, monospace;
      font-size: 0.82em;
    }

    .moses-msg.user {
      background: #0D1B3E;
      color: #FFFFFF;
      align-self: flex-end;
      padding: 10px 14px;
      border-radius: 14px 14px 4px 14px;
      box-shadow: 0 2px 8px rgba(13, 27, 62, 0.18);
    }

    /* ─── WELCOME STATE ─── */
    .moses-welcome {
      align-self: stretch;
      text-align: left;
      padding: 0;
      background: transparent;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .moses-welcome-heading {
      font-size: 1.15rem;
      font-weight: 600;
      color: #0D1B3E;
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }

    .moses-welcome-body {
      font-size: 0.84rem;
      color: #57534E;
      line-height: 1.5;
      margin: 0 0 18px 0;
    }

    /* ─── DISCOVERY SECTION ─── */
    .moses-discover-label {
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #A8A29E;
      margin: 0 0 8px 0;
    }

    /* ─── DISCOVERY QUESTION PROMPTS ─── */
    .moses-discover-questions {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .moses-discover-q {
      background: transparent;
      border: none;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      color: #1C1917; /* Black by default */
      font-family: 'Outfit', sans-serif;
      font-size: 0.825rem;
      font-weight: 400;
      padding: 10px 10px;
      margin: 0 -6px;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                  background 0.25s ease,
                  color 0.25s ease,
                  padding-left 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      line-height: 1.45;
      width: calc(100% + 12px);
      position: relative;
    }

    .moses-discover-q:last-child {
      border-bottom: none;
    }

    .moses-discover-q:hover {
      background: rgba(107, 26, 42, 0.04); /* Subtle Maroon hover tint */
      color: #6B1A2A; /* Maroon font on hover */
      transform: translateX(10px);
      padding-left: 14px;
    }

    .moses-discover-q:focus-visible {
      outline: 2px solid #D4A017;
      outline-offset: 2px;
      border-radius: 8px;
    }

    .moses-discover-q .moses-q-arrow {
      flex-shrink: 0;
      width: 14px;
      height: 14px;
      stroke: #1C1917; /* Black arrow by default */
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: stroke 0.25s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .moses-discover-q:hover .moses-q-arrow {
      stroke: #6B1A2A; /* Maroon arrow on hover */
      transform: translateX(4px) scale(1.15);
    }

    /* ─── FOLLOW-UP CHIPS (Architecture — Phase 9A.3+) ─── */
    .moses-followups {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
    }

    .moses-followup-chip {
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.10);
      color: #44403C;
      font-family: 'Outfit', sans-serif;
      font-size: 0.76rem;
      font-weight: 400;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .moses-followup-chip:hover {
      background: #0D1B3E;
      color: #FFFFFF;
      border-color: #0D1B3E;
    }

    .moses-followup-chip:focus-visible {
      outline: 2px solid #D4A017;
      outline-offset: 2px;
    }

    /* ─── STAGGERED WELCOME ENTRANCE ─── */
    .moses-welcome .moses-welcome-heading,
    .moses-welcome .moses-welcome-body,
    .moses-welcome .moses-discover-label,
    .moses-welcome .moses-discover-q,
    .moses-welcome .moses-grounded-note {
      opacity: 0;
      transform: translateY(6px);
      animation: mosesWelcomeFadeIn 0.35s ease forwards;
    }

    .moses-welcome .moses-welcome-heading { animation-delay: 0.08s; }
    .moses-welcome .moses-welcome-body    { animation-delay: 0.14s; }
    .moses-welcome .moses-discover-label   { animation-delay: 0.20s; }
    .moses-welcome .moses-discover-q:nth-child(1) { animation-delay: 0.24s; }
    .moses-welcome .moses-discover-q:nth-child(2) { animation-delay: 0.30s; }
    .moses-welcome .moses-discover-q:nth-child(3) { animation-delay: 0.36s; }
    .moses-welcome .moses-discover-q:nth-child(4) { animation-delay: 0.42s; }
    .moses-welcome .moses-discover-q:nth-child(5) { animation-delay: 0.48s; }
    .moses-welcome .moses-grounded-note           { animation-delay: 0.54s; }

    @keyframes mosesWelcomeFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ─── THINKING INDICATOR ─── */
    .moses-thinking {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 2px;
    }

    .moses-thinking span {
      width: 5px;
      height: 5px;
      background: #6B1A2A;
      border-radius: 50%;
      animation: mosesDotBounce 1.4s infinite ease-in-out both;
    }

    .moses-thinking span:nth-child(1) { animation-delay: -0.32s; }
    .moses-thinking span:nth-child(2) { animation-delay: -0.16s; }
    .moses-thinking span:nth-child(3) { animation-delay: 0s; }

    @keyframes mosesDotBounce {
      0%, 80%, 100% { transform: scale(0.55); opacity: 0.35; }
      40% { transform: scale(1.1); opacity: 1; }
    }

    /* ─── TYPEWRITER CURSOR ─── */
    .moses-cursor {
      display: inline-block;
      width: 2px;
      height: 15px;
      background: #6B1A2A;
      margin-left: 2px;
      vertical-align: text-bottom;
      border-radius: 1px;
      animation: mosesCursorBlink 0.7s infinite;
    }

    @keyframes mosesCursorBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    /* ─── INTERNAL PORTFOLIO NAVIGATION LINKS ─── */
    .moses-section-link {
      display: inline;
      color: #6B1A2A;
      text-decoration: none;
      font-weight: 500;
      border-bottom: 1px solid rgba(107, 26, 42, 0.25);
      transition: color 0.15s ease, border-color 0.15s ease;
      cursor: pointer;
    }

    .moses-section-link:hover {
      color: #4A0F1C;
      border-bottom-color: #6B1A2A;
    }

    .moses-section-link:focus-visible {
      outline: 2px solid #D4A017;
      outline-offset: 2px;
      border-radius: 2px;
    }

    /* ─── COMPOSER ─── */
    .moses-composer-wrap {
      background: #FFFFFF;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      padding: 8px 14px 12px;
    }

    .moses-composer-hint {
      font-size: 0.84rem;
      font-weight: 500;
      color: #57534E;
      text-align: center;
      padding: 0;
      margin-bottom: 6px;
      line-height: 1.3;
    }

    .moses-grounded-note {
      font-size: 0.72rem;
      color: #A8A29E;
      text-align: center;
      margin-top: 24px;
      margin-bottom: 4px;
      padding: 10px 10px 0;
      border-top: 1px dashed rgba(0, 0, 0, 0.08);
      line-height: 1.35;
    }

    .moses-composer {
      padding: 0;
      background: transparent;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .moses-composer-input {
      flex: 1;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: #FBFBFB;
      border-radius: 12px;
      padding: 10px 14px;
      font-family: 'Outfit', sans-serif;
      font-size: 0.875rem;
      outline: none;
      color: #1C1917;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    }

    .moses-composer-input::placeholder {
      color: #A8A29E;
      font-weight: 400;
    }

    .moses-composer-input:focus {
      background: #FFFFFF;
      border-color: #0D1B3E;
      box-shadow: 0 0 0 3px rgba(13, 27, 62, 0.08);
    }

    /* Microphone Slot (Phase 9B) */
    .moses-mic-slot {
      display: none;
      width: 36px;
      height: 36px;
      align-items: center;
      justify-content: center;
    }

    .moses-send-btn {
      background: linear-gradient(135deg, #0D1B3E 0%, #152554 100%);
      color: #FFFFFF;
      border: 1px solid rgba(255, 255, 255, 0.12);
      width: 38px;
      height: 38px;
      border-radius: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(13, 27, 62, 0.22);
    }

    .moses-send-btn:hover {
      background: linear-gradient(135deg, #152554 0%, #1E3A72 100%);
      color: #FFFFFF;
      transform: translateY(-1px) scale(1.05);
      box-shadow: 0 6px 18px rgba(13, 27, 62, 0.32);
      border-color: rgba(212, 160, 23, 0.4);
    }

    .moses-send-btn:active {
      transform: translateY(0) scale(0.96);
      box-shadow: 0 2px 6px rgba(13, 27, 62, 0.2);
    }

    .moses-send-btn:focus-visible {
      outline: 2px solid #D4A017;
      outline-offset: 2px;
    }

    .moses-send-btn svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* ─── MOBILE RESPONSIVE ─── */
    @media (max-width: 480px) {
      #moses-local-assistant { bottom: 16px; right: 16px; }
      .moses-panel {
        width: calc(100vw - 24px);
        height: calc(100vh - 100px);
        max-height: calc(100vh - 100px);
        border-radius: 14px;
      }
      .moses-messages { padding: 16px 12px; }
      .moses-discover-q { font-size: 0.78rem; padding: 9px 10px 9px 0; }
      .moses-followup-chip { font-size: 0.72rem; padding: 5px 10px; }
      .moses-composer-hint,
      .moses-grounded-note { font-size: 0.72rem; }
    }

    /* ─── REDUCED MOTION ─── */
    @media (prefers-reduced-motion: reduce) {
      .moses-launcher,
      .moses-panel,
      .moses-panel.open,
      .moses-panel.closing,
      .moses-thinking span,
      .moses-cursor,
      .moses-status-dot.thinking,
      .moses-welcome .moses-welcome-heading,
      .moses-welcome .moses-welcome-body,
      .moses-welcome .moses-discover-label,
      .moses-welcome .moses-discover-q,
      .moses-welcome .moses-grounded-note {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
      .moses-launcher,
      .moses-panel,
      .moses-discover-q,
      .moses-followup-chip,
      .moses-send-btn,
      .moses-close-btn,
      .moses-composer-input,
      .moses-section-link {
        transition-duration: 0.01ms !important;
      }
    }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════
  // 2. HTML MARKUP
  // ═══════════════════════════════════════════════
  const wrapper = document.createElement('div');
  wrapper.id = 'moses-local-assistant';
  wrapper.innerHTML = `
    <!-- Panel -->
    <div class="moses-panel" id="mosesPanel" role="dialog" aria-label="MIRA Intelligence Assistant" aria-modal="false">
      <div class="moses-header">
        <canvas id="miraHeaderCanvas"></canvas>
        <div class="moses-header-info">
          <div class="moses-header-name">MIRA Intelligence</div>
          <div class="moses-header-meta">
            <span class="moses-status-indicator">
              <span class="moses-status-dot" id="mosesStatusDot"></span>
              <span id="mosesStatusText">Ready</span>
            </span>
            <span>&nbsp;&nbsp;·&nbsp;&nbsp;Decoupled Portfolio Orchestration Engine (DPOE)</span>
          </div>
        </div>
        <button class="moses-close-btn" id="mosesCloseBtn" aria-label="Close assistant">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
        </button>
      </div>

      <div class="moses-voice-slot" id="mosesVoiceSlot" aria-hidden="true"></div>

      <div class="moses-messages" id="mosesMessages">
        <div class="moses-msg bot moses-welcome">
          <p class="moses-welcome-heading">Explore Moses's work</p>
          <p class="moses-welcome-body">Ask me anything about his projects, experience, research, technical capabilities, or how he could contribute to your team or research.</p>
          <p class="moses-discover-label">Try asking</p>
          <div class="moses-discover-questions">
            <button class="moses-discover-q" data-query="What would Moses bring to a data or BI engineering team?">
              <svg class="moses-q-arrow" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              What would Moses bring to a data or BI team?
            </button>
            <button class="moses-discover-q" data-query="Which projects best demonstrate Moses's technical and engineering skills?">
              <svg class="moses-q-arrow" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              Which projects demonstrate his engineering skills?
            </button>
            <button class="moses-discover-q" data-query="Could Moses contribute to a research project? What areas of research is he interested in?">
              <svg class="moses-q-arrow" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              Could Moses contribute to a research project?
            </button>
            <button class="moses-discover-q" data-query="How has Moses used data to solve real-world problems?">
              <svg class="moses-q-arrow" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              How has he used data to solve real problems?
            </button>
            <button class="moses-discover-q" data-query="What is Moses's professional and educational background?">
              <svg class="moses-q-arrow" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              What is Moses's background?
            </button>
          </div>
          <div class="moses-grounded-note">Grounded in Moses’s portfolio, projects, research, and professional experience.</div>
        </div>
      </div>

      <div class="moses-composer-wrap">
        <div class="moses-composer-hint">Ask a simple question — or go deeper.</div>
        <form class="moses-composer" id="mosesForm">
          <input type="text" class="moses-composer-input" id="mosesInput" placeholder="Ask about a project, skill, or opportunity…" autocomplete="off" aria-label="Ask MIRA Intelligence a question" />
          <div class="moses-mic-slot" id="mosesMicSlot" aria-hidden="true"></div>
          <button type="submit" class="moses-send-btn" id="mosesSendBtn" aria-label="Send message">
            <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>

    <!-- Launcher -->
    <button class="moses-launcher" id="mosesLauncher" aria-label="Open MIRA Intelligence Assistant" title="MIRA Intelligence">
      <!-- Subtle Proximity Sparks Container -->
      <span class="moses-launcher-sparks" id="mosesLauncherSparks" aria-hidden="true">
        <span class="moses-launcher-spark spark-1"></span>
        <span class="moses-launcher-spark spark-2"></span>
        <span class="moses-launcher-spark spark-3"></span>
      </span>

      <!-- 4 White autonomous particles OUTSIDE the core -->
      <span class="moses-launcher-particle particle-1" aria-hidden="true"></span>
      <span class="moses-launcher-particle particle-2" aria-hidden="true"></span>
      <span class="moses-launcher-particle particle-3" aria-hidden="true"></span>
      <span class="moses-launcher-particle particle-4" aria-hidden="true"></span>

      <!-- 3D Spherical Core (Central Ball) -->
      <span class="moses-launcher-core" aria-hidden="true"></span>
    </button>
  `;
  document.body.appendChild(wrapper);

  // ═══════════════════════════════════════════════
  // 3. ELEMENT REFERENCES
  // ═══════════════════════════════════════════════
  const panel     = document.getElementById('mosesPanel');
  const launcher  = document.getElementById('mosesLauncher');
  const closeBtn  = document.getElementById('mosesCloseBtn');
  const messages  = document.getElementById('mosesMessages');
  const form      = document.getElementById('mosesForm');
  const input     = document.getElementById('mosesInput');
  const statusDot = document.getElementById('mosesStatusDot');
  const statusTxt = document.getElementById('mosesStatusText');

  // ═══════════════════════════════════════════════
  // 4. STATUS MANAGEMENT
  // ═══════════════════════════════════════════════
  function setStatus(state) {
    if (!statusDot || !statusTxt) return;
    if (state === 'thinking') {
      statusDot.className = 'moses-status-dot thinking';
      statusTxt.textContent = 'Thinking\u2026';
      if (window.miraSetThinkingState) window.miraSetThinkingState(true);
    } else if (state === 'executing') {
      statusDot.className = 'moses-status-dot executing';
      statusTxt.textContent = 'Executing\u2026';
      if (window.miraSetThinkingState) window.miraSetThinkingState(true);
    } else {
      statusDot.className = 'moses-status-dot';
      statusTxt.textContent = 'Ready';
      if (window.miraSetThinkingState) window.miraSetThinkingState(false);
    }
  }

  // ═══════════════════════════════════════════════
  // 5. PANEL TOGGLE
  // ═══════════════════════════════════════════════
  let transitioning = false;

  function togglePanel(show) {
    if (transitioning) return;
    const isOpen = panel.classList.contains('open') && !panel.classList.contains('closing');
    const shouldOpen = typeof show === 'boolean' ? show : !isOpen;

    if (shouldOpen) {
      if (currentIntroBubble) {
        currentIntroBubble.remove();
        currentIntroBubble = null;
      }
      if (isOpen) return;
      panel.classList.remove('closing');
      panel.classList.add('open');
      input.focus();
    } else {
      if (!isOpen) return;
      transitioning = true;
      panel.classList.add('closing');
      setTimeout(() => {
        panel.classList.remove('open', 'closing');
        transitioning = false;
      }, 220);
    }
  }

  // 🧲 High-Intensity 3D Magnetic Proximity Attraction & Dynamic Directional Sparks
  const coreEl = launcher ? launcher.querySelector('.moses-launcher-core') : null;
  const sparksEl = document.getElementById('mosesLauncherSparks');
  const MAGNETIC_RADIUS = 260;

  document.addEventListener('mousemove', (e) => {
    if (!launcher || launcher.classList.contains('bouncing')) return;
    const rect = launcher.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist < MAGNETIC_RADIUS) {
      launcher.classList.add('sparking');
      const pull = Math.pow(1 - dist / MAGNETIC_RADIUS, 1.1);
      const pullX = (dx / dist) * pull * 18;
      const pullY = (dy / dist) * pull * 18;

      // Orient magnetic spark flashes toward approaching cursor
      if (sparksEl) {
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        sparksEl.style.transform = `rotate(${angleDeg}deg) scale(${0.85 + pull * 0.35})`;
      }

      // Inner 3D ball reaches dramatically outwards to "almost come out" towards mouse
      const corePullX = (dx / dist) * pull * 38;
      const corePullY = (dy / dist) * pull * 38;
      const coreScale = 1 + pull * 0.22;

      launcher.style.transform = `translate(${pullX}px, ${pullY}px) scale(${1 + pull * 0.06})`;
      if (coreEl) {
        coreEl.style.transform = `translate(${corePullX}px, ${corePullY}px) scale(${coreScale})`;
        coreEl.style.filter = `brightness(${1 + pull * 0.42}) contrast(${1 + pull * 0.15}) drop-shadow(0 0 ${12 + pull * 22}px rgba(255, 215, 0, ${0.3 + pull * 0.5}))`;
        coreEl.style.boxShadow = `inset 0 ${2.5 + pull * 3}px ${4 + pull * 4}px rgba(255, 255, 255, ${0.5 + pull * 0.3}), inset 0 0 ${16 + pull * 12}px rgba(212, 160, 23, ${0.4 + pull * 0.4}), inset 0 -12px 22px rgba(0, 0, 0, 0.85), 0 ${8 + pull * 12}px ${24 + pull * 16}px rgba(0, 0, 0, 0.6)`;
      }
    } else {
      launcher.classList.remove('sparking');
      if (launcher.style.transform) launcher.style.transform = '';
      if (sparksEl && sparksEl.style.transform) sparksEl.style.transform = '';
      if (coreEl && coreEl.style.transform) {
        coreEl.style.transform = '';
        coreEl.style.filter = '';
        coreEl.style.boxShadow = '';
      }
    }
  });

  // 💫 Smooth 3D Spring Bounce Click Interaction
  launcher.addEventListener('click', (e) => {
    e.stopPropagation();
    if (launcher.classList.contains('bouncing')) return;
    const isOpen = panel.classList.contains('open') && !panel.classList.contains('closing');
    if (isOpen) {
      togglePanel(false);
      return;
    }

    launcher.style.transform = '';
    if (coreEl) {
      coreEl.style.transform = '';
      coreEl.style.filter = '';
    }

    launcher.classList.add('bouncing');

    setTimeout(() => {
      launcher.classList.remove('bouncing');
      togglePanel(true);
    }, 280);
  });
  function handleCloseClick(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    togglePanel(false);
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', handleCloseClick);
    closeBtn.addEventListener('pointerdown', handleCloseClick);
  }

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('open') && !panel.classList.contains('closing')) {
      if (!panel.contains(e.target) && !launcher.contains(e.target)) togglePanel(false);
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (panel.classList.contains('open') && !panel.classList.contains('closing')) {
      if (!panel.contains(e.target) && !launcher.contains(e.target)) togglePanel(false);
    }
  });

  // Escape to close, return focus to launcher
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open') && !panel.classList.contains('closing')) {
      togglePanel(false);
      launcher.focus();
    }
  });

  // ═══════════════════════════════════════════════
  // 6. DISCOVERY PROMPTS & FOLLOW-UP CHIPS
  // ═══════════════════════════════════════════════
  messages.addEventListener('click', (e) => {
    // Discovery question prompts
    const discoverQ = e.target.closest('.moses-discover-q');
    if (discoverQ) {
      const query = discoverQ.getAttribute('data-query');
      if (query) sendQuery(query);
      return;
    }
    // Follow-up chips (architecture ready for Phase 9A.3+)
    const followup = e.target.closest('.moses-followup-chip');
    if (followup) {
      const query = followup.getAttribute('data-query');
      if (query) sendQuery(query);
      return;
    }
    // Handle internal section links
    const sectionLink = e.target.closest('.moses-section-link');
    if (sectionLink) {
      e.preventDefault();
      const sectionId = sectionLink.getAttribute('data-section');
      if (sectionId && PORTFOLIO_SECTIONS.includes(sectionId)) {
        const target = document.getElementById(sectionId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      }
    }
  });

  // ═══════════════════════════════════════════════
  // 7. FORM SUBMISSION
  // ═══════════════════════════════════════════════
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) sendQuery(text);
  });

  // ═══════════════════════════════════════════════
  // 8. SEND QUERY
  // ═══════════════════════════════════════════════
  async function sendQuery(userText) {
    appendMsg(escapeHtml(userText), 'user');
    conversationHistory.push({ role: 'user', content: userText });
    input.value = '';

    setStatus('thinking');
    const indicator = appendMsg(
      '<div class="moses-thinking"><span></span><span></span><span></span></div>',
      'bot', 'moses-thinking-msg'
    );

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory })
      });

      const data = await res.json();
      if (indicator) indicator.remove();

      if (data.success && data.response) {
        conversationHistory.push({ role: 'assistant', content: data.response });
        setStatus('executing');
        await typewriteResponse(data.response);
        setStatus('ready');
      } else {
        setStatus('ready');
        appendMsg(`<p style="color:#92400E;"><em>${escapeHtml(data.error || 'Unable to connect to backend.')}</em></p>`, 'bot');
      }
    } catch (err) {
      if (indicator) indicator.remove();
      setStatus('ready');
      appendMsg(`<p style="color:#92400E;"><em>Unable to reach backend. Please verify server is running.</em></p>`, 'bot');
    }
  }

  // ═══════════════════════════════════════════════
  // 9. TYPEWRITER
  // ═══════════════════════════════════════════════
  async function typewriteResponse(rawText) {
    const html = formatResponse(rawText);
    const el = document.createElement('div');
    el.className = 'moses-msg bot';
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;

    const tokens = [];
    const re = /(<[^>]+>|[^<]+)/g;
    let m;
    while ((m = re.exec(html)) !== null) tokens.push(m[0]);

    let built = '';
    const cursor = '<span class="moses-cursor"></span>';

    for (const tok of tokens) {
      if (tok.startsWith('<')) {
        built += tok;
        el.innerHTML = built + cursor;
      } else {
        for (let i = 0; i < tok.length; i++) {
          built += tok[i];
          el.innerHTML = built + cursor;
          const ch = tok[i];
          let delay = 30;
          if ('.?!:'.includes(ch)) delay = 130;
          else if (',;'.includes(ch)) delay = 70;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    el.innerHTML = built;
  }

  // ═══════════════════════════════════════════════
  // 10. FORMAT RESPONSE (Markdown → HTML + Section Links)
  // ═══════════════════════════════════════════════
  function formatInlineMarkdown(str) {
    if (!str) return '';
    // Bold (**text** or __text__)
    str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    str = str.replace(/__(.*?)__/g, '<strong>$1</strong>');
    // Italic (*text* or _text_)
    str = str.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    str = str.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Inline code (`code`)
    str = str.replace(/`([^`]+)`/g, '<code>$1</code>');
    return str;
  }

  function formatResponse(text) {
    if (!text) return '';
    let h = escapeHtml(text);

    // Internal portfolio section links: #sectionId → clickable link
    // Matches #sectionId as a standalone word boundary reference
    h = h.replace(/#(hero|about|skills|projects|experience|research|contact)\b/gi, (match, id) => {
      const sectionId = id.toLowerCase();
      if (!PORTFOLIO_SECTIONS.includes(sectionId)) return match;
      const label = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
      return `<a href="#${sectionId}" class="moses-section-link" data-section="${sectionId}">${label}</a>`;
    });

    // Markdown-style [Label](#section) links
    h = h.replace(/\[(.*?)\]\(#(hero|about|skills|projects|experience|research|contact)\)/gi, (match, label, id) => {
      const sectionId = id.toLowerCase();
      if (!PORTFOLIO_SECTIONS.includes(sectionId)) return match;
      return `<a href="#${sectionId}" class="moses-section-link" data-section="${sectionId}">${label}</a>`;
    });

    // Line-by-line bullet list, numbered list, and paragraph parsing
    const lines = h.split(/\n/);
    let out = '';
    let inUl = false;
    let inOl = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (inUl) { out += '</ul>'; inUl = false; }
        if (inOl) { out += '</ol>'; inOl = false; }
        continue;
      }

      const bulletMatch = line.match(/^[-*]\s+(.*)/);
      const numMatch = line.match(/^\d+\.\s+(.*)/);

      if (bulletMatch) {
        if (inOl) { out += '</ol>'; inOl = false; }
        if (!inUl) { out += '<ul>'; inUl = true; }
        out += `<li>${formatInlineMarkdown(bulletMatch[1])}</li>`;
      } else if (numMatch) {
        if (inUl) { out += '</ul>'; inUl = false; }
        if (!inOl) { out += '<ol>'; inOl = true; }
        out += `<li>${formatInlineMarkdown(numMatch[1])}</li>`;
      } else {
        if (inUl) { out += '</ul>'; inUl = false; }
        if (inOl) { out += '</ol>'; inOl = false; }
        out += `<p>${formatInlineMarkdown(line)}</p>`;
      }
    }

    if (inUl) out += '</ul>';
    if (inOl) out += '</ol>';

    return out;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ═══════════════════════════════════════════════
  // 11. APPEND MESSAGE HELPER
  // ═══════════════════════════════════════════════
  function appendMsg(content, type, extraClass = '') {
    const el = document.createElement('div');
    el.className = `moses-msg ${type} ${extraClass}`.trim();
    el.innerHTML = content;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  // ═══════════════════════════════════════════════
  // 12. PERMANENT UNLOCK CONTROLLER (LAST SECTION: #contact TRIGGER)
  // ═══════════════════════════════════════════════
  const assistantContainer = document.getElementById('moses-local-assistant');
  let hasUnlockedAssistant = false;

  // ─── Smooth Fade-In Oblate Entry ───────────────────────────────
  function triggerArcLaunch() {
    if (!assistantContainer) return;

    assistantContainer.classList.add('launching');
    assistantContainer.addEventListener('animationend', () => {
      assistantContainer.classList.remove('launching');
      assistantContainer.classList.add('launched');
      // After ball lands, show intro bubbles after a short settle pause
      setTimeout(playIntroBubbles, 800);
    }, { once: true });
  }

  // ─── Intro Speech Bubble Sequence ──────────────────────────────
  let currentIntroBubble = null;

  function showIntroBubble(text, holdMs, onDone) {
    if (currentIntroBubble) {
      currentIntroBubble.remove();
      currentIntroBubble = null;
    }
    const bubble = document.createElement('div');
    bubble.className = 'moses-intro-bubble';
    bubble.textContent = text;
    // Insert before launcher so it stacks above it in the flex column
    const launcherEl = assistantContainer.querySelector('.moses-launcher');
    assistantContainer.insertBefore(bubble, launcherEl);

    // Clicking the speech bubble opens the assistant
    bubble.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel(true);
    });

    void bubble.offsetWidth; // force reflow before animation
    bubble.classList.add('show');
    currentIntroBubble = bubble;

    if (holdMs > 0) {
      setTimeout(() => {
        if (currentIntroBubble === bubble) {
          bubble.classList.remove('show');
          bubble.classList.add('hide');
          bubble.addEventListener('animationend', () => {
            if (currentIntroBubble === bubble) currentIntroBubble = null;
            bubble.remove();
            if (onDone) onDone();
          }, { once: true });
        }
      }, holdMs);
    }
  }

  function playIntroBubbles() {
    // First message: introduce (no star emoji, disappears after 3 seconds)
    showIntroBubble('Hello, I am here to help', 3000, () => {
      // Pause between messages
      setTimeout(() => {
        // Second message: stays visible permanently (holdMs = 0)
        showIntroBubble('Just ask me', 0, null);
      }, 500);
    });
  }

  function checkScrollVisibility() {
    if (!assistantContainer || hasUnlockedAssistant) return;
    
    // Check if user has scrolled to the absolute bottom of the page
    const scrollBottom = window.scrollY + window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const isAtEnd = (docHeight - scrollBottom) <= 35;

    if (isAtEnd) {
      hasUnlockedAssistant = true;
      window.removeEventListener('scroll', handleScrollVisibility);
      // Wait 7 seconds after hitting the end of the page before beginning entry
      setTimeout(() => {
        triggerArcLaunch();
      }, 7000);
    }
  }

  let scrollTicking = false;
  function handleScrollVisibility() {
    if (!scrollTicking) {
      window.requestAnimationFrame(() => {
        checkScrollVisibility();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }

  window.addEventListener('scroll', handleScrollVisibility, { passive: true });

  // Initial check on load
  checkScrollVisibility();

  // ═══════════════════════════════════════════════
  // MIRA INTELLIGENCE ANIMATED NEURAL HEADER CANVAS
  // ═══════════════════════════════════════════════
  (function initMiraHeaderNeuralCanvas() {
    const canvas = document.getElementById('miraHeaderCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles = [];
    let isTyping = false;
    let isThinkingState = false;
    let sphereAngle = 0;
    let typingTimer = null;

    window.miraSetThinkingState = function(thinking) {
      isThinkingState = thinking;
    };

    function resizeCanvas() {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth || 420;
      height = parent.clientHeight || 70;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const PARTICLE_COUNT = 34;
    const MAX_DIST = 75;

    class Particle {
      constructor(id) {
        this.id = id;
        this.reset();
      }

      reset() {
        this.x = Math.random() * (width || 400);
        this.y = Math.random() * (height || 70);
        this.vx = (Math.random() - 0.5) * 0.45;
        this.vy = (Math.random() - 0.5) * 0.45;
        this.radius = Math.random() * 1.5 + 1.0;
        this.baseAlpha = Math.random() * 0.4 + 0.45;
        this.alpha = this.baseAlpha;
        const colors = ['#FFFFFF', '#D4A017', '#818CF8', '#F472B6', '#E2E8F0'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        if (isThinkingState) {
          // AI THINKING: Form a tight neural ball and revolve fast
          sphereAngle += 0.005;
          const centerX = width / 2;
          const centerY = height / 2;

          const ringRadius = 22 + (this.id % 5) * 6.5;
          const particleAngle = sphereAngle * 18 + (this.id * (Math.PI * 2 / PARTICLE_COUNT));

          const targetX = centerX + Math.cos(particleAngle) * ringRadius;
          const targetY = centerY + Math.sin(particleAngle) * (ringRadius * 0.65);

          this.x += (targetX - this.x) * 0.25;
          this.y += (targetY - this.y) * 0.25;
          this.alpha = 0.95;
        } else if (isTyping) {
          // KEYBOARD TYPING: Gravitate towards center point (width/2, height/2)
          const targetX = width / 2;
          const targetY = height / 2;
          const dx = targetX - this.x;
          const dy = targetY - this.y;
          const dist = Math.hypot(dx, dy);

          if (dist > 12) {
            this.vx += (dx / dist) * 0.12;
            this.vy += (dy / dist) * 0.12;
            this.vx *= 0.88;
            this.vy *= 0.88;
          } else {
            this.vx = -dy * 0.05;
            this.vy = dx * 0.05;
          }
          this.alpha = Math.min(1.0, this.baseAlpha + 0.4);
        } else {
          // IDLE / DISPERSED: Ambient drift & gentle bounce
          this.vx *= 0.98;
          this.vy *= 0.98;
          if (Math.abs(this.vx) < 0.15) this.vx += (Math.random() - 0.5) * 0.1;
          if (Math.abs(this.vy) < 0.15) this.vy += (Math.random() - 0.5) * 0.1;

          this.alpha = this.baseAlpha;

          if (this.x < 0 || this.x > width) this.vx *= -1;
          if (this.y < 0 || this.y > height) this.vy *= -1;
        }

        this.x += this.vx;
        this.y += this.vy;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle(i));
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();

        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);
          const maxDist = isThinkingState ? 60 : (isTyping ? 95 : MAX_DIST);

          if (dist < maxDist) {
            const lineAlpha = (1 - dist / maxDist) * (isThinkingState ? 0.65 : (isTyping ? 0.45 : 0.24));
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = isThinkingState ? 'rgba(255, 215, 0, ' + lineAlpha + ')' : (isTyping ? 'rgba(212, 160, 23, ' + lineAlpha + ')' : 'rgba(255, 255, 255, ' + lineAlpha + ')');
            ctx.lineWidth = isThinkingState ? 1.4 : (isTyping ? 1.2 : 0.8);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    }

    animate();

    const inputEl = document.getElementById('mosesInput');
    if (inputEl) {
      inputEl.addEventListener('input', () => {
        isTyping = true;
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          isTyping = false;
        }, 850);
      });
    }
  })();
})();
