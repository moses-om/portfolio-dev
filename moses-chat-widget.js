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

    /* ─── SPACELIKE SIDE-ENTRY, REST HOLD & FLUID CONTINUOUS DROP (5.2s) ───
         Act 1 (0→18%):   Glides into view from right edge near mid-screen (~0.95s)
         Act 2 (18→38%):  Longer patient rest hold at right edge before drop (~1.05s)
         Act 3 (38→80%):  ONE SINGLE CONTINUOUS SLOW DESCENT — zero stops, pure fluid momentum (~2.2s)
         Act 4 (80→100%): Cushioned dynamic bounce, soft compression & settled rest (~1.0s)
    ─────────────────────────────────────────────────── */
    @keyframes mosesSideDropEntry {
      /* Act 1: Glides gently into view from right */
      0% {
        opacity: 0;
        transform: translate3d(80px, -45vh, 0) scale(0.7);
        filter: brightness(1.4);
        animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
      }
      18% {
        opacity: 1;
        transform: translate3d(0, -45vh, 0) scale(1.0);
        filter: brightness(1.06);
        animation-timing-function: linear;
      }

      /* Act 2: Longer Patient Rest Hold before descent */
      38% {
        opacity: 1;
        transform: translate3d(0, -45vh, 0) scale(1.0);
        filter: brightness(1.06);
        /* Single continuous smooth S-curve ease-in-out for the entire drop */
        animation-timing-function: cubic-bezier(0.38, 0, 0.22, 1);
      }

      /* Act 3: ONE SINGLE UNINTERRUPTED SMOOTH DESCENT DIRECT TO DOCK */
      80% {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1.0);
        filter: brightness(1.0);
        animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
      }

      /* Act 4: Cushioned Dynamic Landing Bounce & Settle */
      88% {
        opacity: 1;
        transform: translate3d(0, -11px, 0) scale(1.05);
        filter: brightness(1.08);
        animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
      }
      94% {
        opacity: 1;
        transform: translate3d(0, 2.5px, 0) scale(0.975);
        filter: brightness(1.0);
        animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
      }
      100% {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1.0);
        filter: brightness(1.0);
      }
    }

    #moses-local-assistant.launching {
      animation: mosesSideDropEntry 5.2s forwards;
      pointer-events: none;
    }

    #moses-local-assistant.launched {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
      pointer-events: auto;
    }

    /* Expanding Quantum Arrival Shockwave */
    .moses-warp-ring {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: 2px solid #FBBF24;
      pointer-events: none;
      opacity: 0;
      z-index: 0;
      will-change: transform, opacity;
    }

    #moses-local-assistant.launching .moses-warp-ring {
      animation: mosesWarpRingExpand 1.2s cubic-bezier(0.1, 0.8, 0.2, 1) 4.15s forwards;
    }

    @keyframes mosesWarpRingExpand {
      0% {
        transform: scale(0.35);
        opacity: 0.95;
        border-color: #FDE68A;
        box-shadow: 0 0 16px rgba(251, 191, 36, 0.8);
      }
      50% {
        opacity: 0.5;
        border-color: #D4A017;
        box-shadow: 0 0 24px rgba(212, 160, 23, 0.4);
      }
      100% {
        transform: scale(2.6);
        opacity: 0;
        border-color: rgba(212, 160, 23, 0);
        box-shadow: none;
      }
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
        0 10px 28px rgba(3, 7, 18, 0.55),
        0 2px 10px rgba(212, 160, 23, 0.18),
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
      animation: mosesLauncherIdle 4s ease-in-out infinite;
      will-change: transform;
    }

    @keyframes mosesLauncherIdle {
      0%, 100% {
        transform: translate3d(0, 0, 0) scale(1);
      }
      50% {
        transform: translate3d(0, -3px, 0) scale(1.02);
      }
    }

    /* When Chat Panel is Open -> Freeze Background Launcher Loops for Zero Overhead */
    #moses-local-assistant.panel-open .moses-launcher {
      animation-play-state: paused !important;
    }
    #moses-local-assistant.panel-open .moses-launcher-core {
      animation-play-state: paused !important;
    }
    #moses-local-assistant.panel-open .moses-launcher-particle {
      animation-play-state: paused !important;
    }

    .moses-launcher:hover {
      transform: translate3d(0, -4px, 0) scale(1.05);
      border-color: rgba(255, 215, 0, 0.75);
      box-shadow:
        0 16px 36px rgba(3, 7, 18, 0.68),
        0 4px 16px rgba(212, 160, 23, 0.30),
        inset 0 1.5px 1px rgba(255, 255, 255, 0.45);
    }

    .moses-launcher:active {
      transform: translate3d(0, -1px, 0) scale(0.96);
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
        0 6px 18px rgba(0, 0, 0, 0.45);
      transition: transform 0.22s cubic-bezier(0.25, 1, 0.5, 1);
      animation: mosesSpaceOrbFloat 4.8s ease-in-out infinite;
      will-change: transform;
      overflow: hidden;
    }

    @keyframes mosesSpaceOrbFloat {
      0%, 100% {
        transform: translate3d(0, 0, 0) scale(1);
      }
      50% {
        transform: translate3d(0, -2px, 0) scale(1.018);
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



    /* ─── 3D WHITE SPHERICAL SATELLITE BALL (EXACT SAME 3D SHADING AS GOLDEN BALL) ─── */
    .moses-moon-system {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 4;
      opacity: 0;
      transform: scale(0.5);
      transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* Appears smoothly 1.5s after golden Earth ball has settled */
    #moses-local-assistant.orbits-active .moses-moon-system {
      opacity: 1;
      transform: scale(1);
    }

    /* Positioned at center of golden Earth, translated dynamically via zero-G physics loop */
    .moses-moon-static {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 14px;
      height: 14px;
      margin-top: -7px;
      margin-left: -7px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 35% 22%, rgba(255, 255, 255, 1) 0%, rgba(241, 245, 249, 0.85) 24%, transparent 55%),
        radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.65) 0%, transparent 65%),
        radial-gradient(circle at 74% 78%, rgba(148, 163, 184, 0.55) 0%, transparent 55%),
        radial-gradient(circle at 50% 50%, #FFFFFF 0%, #E2E8F0 60%, #94A3B8 100%);
      box-shadow:
        inset 0 1.5px 2.5px rgba(255, 255, 255, 0.95),
        inset 0 -3px 6px rgba(15, 23, 42, 0.75),
        0 3px 8px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      transform: translate3d(20px, -20px, 0);
      will-change: transform;
    }

    .moses-moon-static::before {
      content: '';
      position: absolute;
      inset: 8%;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 22%, rgba(255, 255, 255, 0.75), transparent 45%);
      opacity: 0.95;
      pointer-events: none;
    }

    /* ─── CLICK INTERACTION: SPACELIKE ELASTIC PULSE & CELESTIAL RESPONSE ─── */
    /* ─── CLICK INTERACTION: SPACELIKE ELASTIC PULSE ─── */
    .moses-launcher.bouncing {
      animation: mosesLauncherPulse 0.38s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    .moses-launcher.bouncing .moses-launcher-core {
      animation: mosesCorePulse 0.38s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    @keyframes mosesLauncherPulse {
      0% {
        transform: scale(1);
      }
      35% {
        transform: scale(0.93);
      }
      65% {
        transform: scale(1.05);
      }
      100% {
        transform: scale(1);
      }
    }

    @keyframes mosesCorePulse {
      0% {
        transform: scale(1);
        filter: brightness(1);
      }
      35% {
        transform: scale(0.88);
        filter: brightness(1.22);
      }
      65% {
        transform: scale(1.07);
        filter: brightness(1.30) drop-shadow(0 0 12px rgba(255, 215, 0, 0.45));
      }
      100% {
        transform: scale(1);
        filter: brightness(1);
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



    /* ─── ASSISTANT PANEL (PREMIUM WHITE & MAROON WITH OBSIDIAN HUD) ─── */
    .moses-panel {
      width: 430px;
      max-width: calc(100vw - 32px);
      height: 650px;
      max-height: calc(100vh - 90px);
      background: #FFFFFF;
      border-radius: 22px;
      border: 1.5px solid rgba(107, 26, 42, 0.18);
      box-shadow:
        0 32px 85px rgba(5, 11, 26, 0.28),
        0 12px 30px rgba(107, 26, 42, 0.12),
        0 0 0 1px rgba(212, 160, 23, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      display: none;
      transform-origin: bottom right;
      transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.42s ease;
      will-change: transform, opacity, filter, box-shadow;
    }

    .moses-panel.open {
      display: flex;
      animation: mosesPanelDisplaceOpen 0.42s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .moses-panel.closing {
      display: flex !important;
      animation: mosesPanelDisplaceClose 0.22s cubic-bezier(0.4, 0, 1, 1) forwards;
      pointer-events: none;
    }

    @keyframes mosesPanelDisplaceOpen {
      0% {
        opacity: 0;
        transform: translate3d(0, 18px, 0) scale(0.93);
        filter: blur(5px) brightness(1.04);
      }
      50% {
        filter: blur(0px) brightness(1.02);
      }
      100% {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
        filter: blur(0px) brightness(1);
      }
    }

    @keyframes mosesPanelDisplaceClose {
      0% {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
        filter: blur(0px);
      }
      100% {
        opacity: 0;
        transform: translate3d(0, 16px, 0) scale(0.95);
        filter: blur(4px);
      }
    }

    /* ─── HEADER (EXPANDED 3D NEURAL SPHERE CHAMBER) ─── */
    .moses-header {
      background: linear-gradient(135deg, #070E1E 0%, #0D1B3E 45%, #2B0715 80%, #070E1E 100%);
      background-size: 260% 260%;
      animation: miraHeaderGradientFlow 14s ease-in-out infinite;
      padding: 22px 18px 18px;
      min-height: 110px;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      border-bottom: 1.5px solid rgba(212, 160, 23, 0.25);
      box-sizing: border-box;
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
      opacity: 0.95;
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
      pointer-events: none;
    }

    .moses-header-title {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #FFFFFF;
      text-align: center;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
      line-height: 1.2;
    }

    .moses-header-dpoe {
      font-family: 'DM Mono', monospace;
      font-size: 0.67rem;
      background: rgba(107, 26, 42, 0.22);
      color: #FEE2E2;
      border: 1px solid rgba(212, 160, 23, 0.25);
      padding: 1.5px 8px;
      border-radius: 10px;
      letter-spacing: 0.03em;
      font-weight: 500;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }

    .moses-header-meta {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-weight: 400;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
    }

    .moses-status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .moses-status-dot {
      width: 6px;
      height: 6px;
      background: #10B981;
      border-radius: 50%;
      display: inline-block;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }

    .moses-status-dot.thinking {
      background: #D4A017;
      box-shadow: 0 0 10px rgba(212, 160, 23, 0.95);
      animation: mosesStatusPulse 1.2s infinite ease-in-out;
    }

    .moses-status-dot.executing {
      background: #38BDF8;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.95);
      animation: mosesStatusPulse 0.7s infinite ease-in-out;
    }

    @keyframes mosesStatusPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(0.8); }
    }

    .moses-close-btn {
      position: absolute;
      top: 14px;
      right: 14px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.85);
      width: 30px;
      height: 30px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.88rem;
      transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
      outline: none;
      flex-shrink: 0;
      z-index: 100;
      pointer-events: auto;
    }

    .moses-close-btn:hover {
      background: rgba(212, 160, 23, 0.25);
      border-color: rgba(212, 160, 23, 0.7);
      color: #FFFFFF;
      transform: scale(1.08);
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

    /* ─── MESSAGES AREA (WHITE & MAROON LUXURY CHAMBER) ─── */
    .moses-messages {
      flex: 1;
      padding: 20px 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: #FAFAFA;
    }

    .moses-messages::-webkit-scrollbar { width: 5px; }
    .moses-messages::-webkit-scrollbar-track { background: transparent; }
    .moses-messages::-webkit-scrollbar-thumb { background: rgba(107, 26, 42, 0.18); border-radius: 4px; }
    .moses-messages::-webkit-scrollbar-thumb:hover { background: rgba(107, 26, 42, 0.4); }

    /* ─── MESSAGE BUBBLES ─── */
    .moses-msg {
      max-width: 90%;
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

    .moses-msg.bot.moses-thinking-msg {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
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

    .moses-msg.bot strong { color: #6B1A2A; font-weight: 600; }

    .moses-msg.bot code {
      background: rgba(107, 26, 42, 0.06);
      color: #6B1A2A;
      border: 1px solid rgba(107, 26, 42, 0.14);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'DM Mono', ui-monospace, monospace;
      font-size: 0.84em;
    }

    /* ─── INTERACTIVE SECTION BUTTON PILLS (NO HASHTAGS, NO URL PREVIEW) ─── */
    .moses-section-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      color: #6B1A2A !important;
      font-family: inherit !important;
      font-weight: 500 !important;
      font-size: 0.86em !important;
      text-decoration: none !important;
      background: rgba(107, 26, 42, 0.04) !important;
      border: 1px solid rgba(107, 26, 42, 0.16) !important;
      padding: 2px 9px !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      line-height: 1.4 !important;
      transition: background 0.22s ease, color 0.22s ease, border-color 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
      vertical-align: baseline;
      margin: 0 3px;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      box-sizing: border-box;
    }

    .moses-section-link:hover {
      background: rgba(107, 26, 42, 0.09) !important;
      color: #521320 !important;
      border-color: rgba(107, 26, 42, 0.32) !important;
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(107, 26, 42, 0.12);
    }

    .moses-section-link:active {
      transform: translateY(0);
    }

    /* Prevent double-border box if nested inside code tag */
    .moses-msg.bot code:has(.moses-section-link),
    .moses-msg.bot code .moses-section-link {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
    }

    .moses-ext-link {
      color: #172B54;
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }

    .moses-ext-link:hover {
      color: #6B1A2A;
    }

    .moses-msg.user {
      background: linear-gradient(135deg, #0D1B3E 0%, #172B54 100%);
      color: #FFFFFF;
      align-self: flex-end;
      padding: 10px 15px;
      border-radius: 16px 16px 4px 16px;
      border: 1px solid rgba(212, 160, 23, 0.35);
      box-shadow: 0 3px 12px rgba(13, 27, 62, 0.18);
    }

    /* ─── WELCOME STATE ─── */
    .moses-welcome {
      align-self: stretch;
      text-align: left;
      padding: 0 !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      transition: opacity 0.35s ease;
    }

    .moses-welcome.dimmed {
      opacity: 0.22 !important;
    }

    .moses-welcome-heading {
      font-size: 1.18rem;
      font-weight: 600;
      color: #0D1B3E;
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }

    .moses-welcome-body {
      font-size: 0.85rem;
      color: #57534E;
      line-height: 1.5;
      margin: 0 0 16px 0;
    }

    /* ─── DISCOVERY SECTION ─── */
    .moses-discover-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6B1A2A;
      margin: 0 0 8px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* ─── DISCOVERY QUESTION PROMPTS (CLEAN FLAT CASCADING HOVER) ─── */
    .moses-discover-questions {
      display: flex;
      flex-direction: column;
      gap: 3px;
      transition: opacity 0.35s ease;
    }

    .moses-discover-q {
      background: transparent;
      border: none;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
      color: #292524;
      font-family: 'Outfit', sans-serif;
      font-size: 0.815rem;
      font-weight: 400;
      padding: 8px 4px;
      margin: 0;
      border-radius: 0;
      cursor: pointer;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                  background 0.22s ease,
                  color 0.22s ease,
                  padding-left 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
      box-sizing: border-box;
      position: relative;
    }

    .moses-discover-q:last-child {
      border-bottom: none;
    }

    .moses-discover-q:hover {
      background: rgba(107, 26, 42, 0.03);
      color: #6B1A2A;
      font-weight: 500;
      transform: translateX(8px);
      padding-left: 10px;
    }

    .moses-discover-q:focus-visible {
      outline: 2px solid #D4A017;
      outline-offset: 2px;
      border-radius: 4px;
    }

    .moses-discover-q .moses-q-arrow {
      flex-shrink: 0;
      width: 14px;
      height: 14px;
      stroke: #8C1D40;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: stroke 0.22s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .moses-discover-q:hover .moses-q-arrow {
      stroke: #6B1A2A;
      transform: translateX(4px) scale(1.15);
      filter: drop-shadow(0 0 3px rgba(107, 26, 42, 0.3));
    }

    /* ─── FOLLOW-UP CHIPS (Phase 9A.3+) ─── */
    .moses-followups {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }

    .moses-followup-chip {
      background: #FFFFFF;
      border: 1px solid rgba(107, 26, 42, 0.2);
      color: #44403C;
      font-family: 'Outfit', sans-serif;
      font-size: 0.76rem;
      font-weight: 400;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .moses-followup-chip:hover {
      background: #6B1A2A;
      border-color: #6B1A2A;
      color: #FFFFFF;
      box-shadow: 0 2px 8px rgba(107, 26, 42, 0.25);
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

    /* ─── MODERN MINIMALIST LIGHT MAROON THINKING LINES ─── */
    .moses-thinking {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 9px 26px;
      background: rgba(107, 26, 42, 0.04) !important;
      border: 1px solid rgba(107, 26, 42, 0.12) !important;
      border-radius: 20px;
      box-shadow: 0 2px 8px rgba(107, 26, 42, 0.04) !important;
    }

    .moses-thinking-lines {
      display: inline-flex;
      align-items: center;
      gap: 5.5px;
      height: 18px;
    }

    .moses-thinking-line {
      width: 1.5px;
      border-radius: 999px;
      background: rgba(107, 26, 42, 0.45);
      animation: mosesMaroonLineHarmonic 1.0s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
    }

    .moses-thinking-line:nth-child(1) { animation-delay: 0.0s; height: 7px; }
    .moses-thinking-line:nth-child(2) { animation-delay: 0.15s; height: 13px; background: rgba(107, 26, 42, 0.7); }
    .moses-thinking-line:nth-child(3) { animation-delay: 0.3s; height: 18px; background: rgba(107, 26, 42, 0.9); }
    .moses-thinking-line:nth-child(4) { animation-delay: 0.45s; height: 14px; background: rgba(107, 26, 42, 0.75); }
    .moses-thinking-line:nth-child(5) { animation-delay: 0.6s; height: 8px; background: rgba(107, 26, 42, 0.5); }

    @keyframes mosesMaroonLineHarmonic {
      0% { transform: scaleY(0.45); opacity: 0.35; background: rgba(107, 26, 42, 0.3); }
      100% { transform: scaleY(1.15); opacity: 1; background: rgba(107, 26, 42, 0.88); box-shadow: 0 0 5px rgba(107, 26, 42, 0.2); }
    }

    /* ─── TYPEWRITER CURSOR (INLINE WITH WORDS) ─── */
    .moses-cursor {
      display: inline-block;
      width: 2px;
      height: 1.15em;
      background: #6B1A2A;
      box-shadow: 0 0 4px rgba(107, 26, 42, 0.5);
      margin-left: 2px;
      vertical-align: -0.15em;
      border-radius: 1px;
      animation: mosesCursorBlink 0.65s infinite ease-in-out;
    }

    @keyframes mosesCursorBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    /* ─── INTERNAL PORTFOLIO NAVIGATION LINKS ─── */
    .moses-section-link {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: #6B1A2A;
      background: rgba(107, 26, 42, 0.06);
      border: 1px solid rgba(107, 26, 42, 0.2);
      border-radius: 6px;
      padding: 1px 7px;
      font-family: 'DM Mono', monospace;
      font-size: 0.82em;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .moses-section-link:hover {
      background: rgba(107, 26, 42, 0.12);
      border-color: #6B1A2A;
      color: #4A0F1C;
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(107, 26, 42, 0.15);
    }

    .moses-section-link:focus-visible {
      outline: 2px solid #D4A017;
      outline-offset: 2px;
      border-radius: 4px;
    }

    /* ─── COMPOSER AREA (COMMAND CONSOLE) ─── */
    .moses-composer-wrap {
      background: #FFFFFF;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      padding: 10px 14px 14px;
      transition: border-color 0.3s ease, box-shadow 0.3s ease;
    }

    .moses-composer-wrap.active-typing {
      border-top-color: rgba(107, 26, 42, 0.35);
      box-shadow: inset 0 1px 8px rgba(107, 26, 42, 0.05);
    }

    .moses-composer-hint {
      font-size: 0.74rem;
      font-family: 'DM Mono', monospace;
      font-weight: 500;
      color: #78716C;
      text-align: center;
      padding: 0;
      margin-bottom: 6px;
      letter-spacing: 0.02em;
    }

    .moses-grounded-note {
      font-family: 'Outfit', sans-serif;
      font-size: 0.82rem;
      color: #57534E;
      text-align: center;
      margin-top: 32px;
      margin-bottom: 6px;
      padding: 10px 10px 0;
      border-top: 1px dashed rgba(0, 0, 0, 0.08);
      line-height: 1.45;
    }

    /* ─── TYPEWRITER ANIMATION ─── */
    .moses-welcome-typewriter {
      font-size: 0.88rem;
      font-weight: 500;
      color: #6B1A2A;
      margin-top: 2px;
      margin-bottom: 8px;
      min-height: 1.4em;
      display: inline-flex;
      align-items: center;
      gap: 1px;
    }

    .moses-typewriter-cursor {
      display: inline-block;
      width: 2px;
      height: 1.1em;
      background-color: #6B1A2A;
      margin-left: 2px;
      animation: mosesCursorBlink 0.75s infinite;
      vertical-align: middle;
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
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: #FBFBFB;
      border-radius: 12px;
      padding: 10px 14px;
      font-family: 'Outfit', sans-serif;
      font-size: 0.875rem;
      outline: none;
      color: #1C1917;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }

    .moses-composer-input::placeholder {
      color: #A8A29E;
      font-weight: 400;
    }

    .moses-composer-input:focus {
      background: #FFFFFF;
      border-color: #6B1A2A;
      box-shadow: 0 0 0 3px rgba(107, 26, 42, 0.1), 0 0 12px rgba(107, 26, 42, 0.1);
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
      background: linear-gradient(135deg, #6B1A2A 0%, #8C1D40 100%);
      color: #FFFFFF;
      border: 1px solid rgba(255, 255, 255, 0.2);
      width: 38px;
      height: 38px;
      border-radius: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      flex-shrink: 0;
      box-shadow: 0 2px 10px rgba(107, 26, 42, 0.25);
      font-weight: bold;
    }

    .moses-send-btn:hover {
      background: linear-gradient(135deg, #8C1D40 0%, #A3204C 100%);
      color: #FFFFFF;
      transform: translateY(-1px) scale(1.05);
      box-shadow: 0 4px 14px rgba(107, 26, 42, 0.35);
    }

    .moses-send-btn:active {
      transform: translateY(0) scale(0.96);
      box-shadow: 0 2px 6px rgba(107, 26, 42, 0.2);
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
      stroke-width: 2.2;
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
        border-radius: 16px;
      }
      .moses-messages { padding: 16px 12px; }
      .moses-discover-q { font-size: 0.78rem; padding: 9px 12px; }
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
      .moses-quantum-bar,
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
          <div class="moses-header-title">MIRA Intelligence</div>
          <div class="moses-header-dpoe">Decoupled Portfolio Orchestration Engine (DPOE)</div>
          <div class="moses-header-meta">
            <span class="moses-status-indicator">
              <span class="moses-status-dot" id="mosesStatusDot"></span>
              <span id="mosesStatusText">Ready</span>
            </span>
            <span>&nbsp;&nbsp;·&nbsp;&nbsp;Conversational Portfolio Guide</span>
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
    <div style="position: relative; display: flex; align-items: center; justify-content: center;">
      <!-- Expanding Quantum Arrival Shockwave Ring -->
      <span class="moses-warp-ring" aria-hidden="true"></span>

      <button class="moses-launcher" id="mosesLauncher" aria-label="Open MIRA Intelligence Assistant" title="MIRA Intelligence">
        <!-- 3D White Spherical Satellite Ball (Static Establishment) -->
        <span class="moses-moon-system" aria-hidden="true">
          <span class="moses-moon-static"></span>
        </span>

        <!-- 3D Spherical Core (Golden Earth) -->
        <span class="moses-launcher-core" aria-hidden="true"></span>
      </button>
    </div>
  `;
  document.body.appendChild(wrapper);

  // ═══════════════════════════════════════════════
  // 3. ELEMENT REFERENCES
  // ═══════════════════════════════════════════════
  const panel = document.getElementById('mosesPanel');
  const launcher = document.getElementById('mosesLauncher');
  const closeBtn = document.getElementById('mosesCloseBtn');
  const messages = document.getElementById('mosesMessages');
  const form = document.getElementById('mosesForm');
  const input = document.getElementById('mosesInput');
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
      if (window.miraSetThinkingState) window.miraSetThinkingState('thinking');
    } else if (state === 'executing') {
      statusDot.className = 'moses-status-dot executing';
      statusTxt.textContent = 'Executing\u2026';
      if (window.miraSetThinkingState) window.miraSetThinkingState('executing');
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
      wrapper.classList.add('panel-open');
      panel.classList.remove('closing');
      panel.classList.add('open');
      if (window.miraResizeCanvas) window.miraResizeCanvas();
      input.focus();
    } else {
      if (!isOpen) return;
      transitioning = true;
      wrapper.classList.remove('panel-open');
      panel.classList.add('closing');
      setTimeout(() => {
        panel.classList.remove('open', 'closing');
        transitioning = false;
      }, 220);
    }
  }

  // 🧲 Zero-G Celestial Moon Physics (Stays where mouse leaves it, 0% Idle GPU/CPU)
  const coreEl = launcher ? launcher.querySelector('.moses-launcher-core') : null;
  const moonEl = launcher ? launcher.querySelector('.moses-moon-static') : null;
  const MAGNETIC_RADIUS = 340;
  const ORBIT_RADIUS = 27; // Constant natural orbital distance around golden Earth

  let currentMoonX = 20;
  let currentMoonY = -20;
  let targetMoonX = 20;
  let targetMoonY = -20;
  let isPhysicsLoopRunning = false;

  function wakePhysicsLoop() {
    if (!isPhysicsLoopRunning) {
      isPhysicsLoopRunning = true;
      requestAnimationFrame(updateMoonPhysics);
    }
  }

  document.addEventListener('mousemove', (e) => {
    if (!launcher || wrapper.classList.contains('panel-open') || launcher.classList.contains('bouncing')) return;
    const rect = launcher.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > 0 && dist < MAGNETIC_RADIUS) {
      const angle = Math.atan2(dy, dx);
      const pull = Math.pow(1 - dist / MAGNETIC_RADIUS, 1.1);

      // Target position along the orbit circle
      targetMoonX = Math.cos(angle) * ORBIT_RADIUS;
      targetMoonY = Math.sin(angle) * ORBIT_RADIUS;

      // Golden Earth core gently shifts slightly towards cursor
      const corePullX = (dx / dist) * pull * 6;
      const corePullY = (dy / dist) * pull * 6;
      if (coreEl) {
        coreEl.style.transform = `translate3d(${corePullX.toFixed(2)}px, ${corePullY.toFixed(2)}px, 0)`;
      }

      wakePhysicsLoop();
    } else {
      // When mouse leaves the tracking zone, golden core gently returns to center,
      // but the Moon stays precisely wherever it was left!
      if (coreEl && coreEl.style.transform) {
        coreEl.style.transform = '';
      }
    }
  }, { passive: true });

  // 🌌 Ultra-Optimized Zero-G Physics Loop (Self-Sleeping on Rest for 0% GPU/CPU Usage)
  function updateMoonPhysics() {
    if (!moonEl || wrapper.classList.contains('panel-open')) {
      isPhysicsLoopRunning = false;
      return;
    }

    // Smooth organic damping lerp
    currentMoonX += (targetMoonX - currentMoonX) * 0.085;
    currentMoonY += (targetMoonY - currentMoonY) * 0.085;

    moonEl.style.transform = `translate3d(${currentMoonX.toFixed(2)}px, ${currentMoonY.toFixed(2)}px, 0)`;

    // Check if Moon has smoothly settled at its final stationary spot
    const deltaToTarget = Math.hypot(targetMoonX - currentMoonX, targetMoonY - currentMoonY);
    if (deltaToTarget < 0.05) {
      // Settled perfectly: lock coordinates and sleep the RAF loop (0% GPU/CPU usage!)
      currentMoonX = targetMoonX;
      currentMoonY = targetMoonY;
      moonEl.style.transform = `translate3d(${currentMoonX.toFixed(2)}px, ${currentMoonY.toFixed(2)}px, 0)`;
      isPhysicsLoopRunning = false;
      return;
    }

    requestAnimationFrame(updateMoonPhysics);
  }

  // 💫 Smooth 3D Spring Bounce Click Interaction
  launcher.addEventListener('click', (e) => {
    e.stopPropagation();
    if (launcher.classList.contains('bouncing')) return;
    const isOpen = panel.classList.contains('open') && !panel.classList.contains('closing');

    // Trigger spring bounce animation
    launcher.classList.add('bouncing');
    launcher.addEventListener('animationend', () => {
      launcher.classList.remove('bouncing');
    }, { once: true });

    togglePanel(!isOpen);
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel(false);
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      togglePanel(false);
    }
  });

  // Close when clicking outside the assistant panel
  document.addEventListener('click', (e) => {
    if (!panel || !panel.classList.contains('open') || panel.classList.contains('closing')) return;
    if (!wrapper.contains(e.target)) {
      togglePanel(false);
    }
  });

  // ═══════════════════════════════════════════════
  // 6. SUGGESTION BUTTONS
  // ═══════════════════════════════════════════════
  wrapper.addEventListener('click', (e) => {
    const btn = e.target.closest('.moses-discover-q');
    if (btn) {
      const q = btn.getAttribute('data-query');
      if (q) {
        input.value = q;
        handleSend();
      }
    }
  });

  // ═══════════════════════════════════════════════
  // 7. FORM SUBMISSION & AGENT STREAMING
  // ═══════════════════════════════════════════════
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSend();
  });

  function insertCursorInMarkdown(html) {
    if (!html) return '<span class="moses-cursor"></span>';
    // If html ends with a block closing tag, insert cursor right before it so it sits inline with the last word
    if (html.endsWith('</p>')) {
      return html.slice(0, -4) + '<span class="moses-cursor"></span></p>';
    }
    if (html.endsWith('</li>')) {
      return html.slice(0, -5) + '<span class="moses-cursor"></span></li>';
    }
    if (html.endsWith('</div>')) {
      return html.slice(0, -6) + '<span class="moses-cursor"></span></div>';
    }
    return html + '<span class="moses-cursor"></span>';
  }

  function createTypewriterStream(targetEl, onDone) {
    let buffer = '';
    let currentLength = 0;
    let isFinished = false;
    let isTicking = false;

    function tick() {
      if (currentLength < buffer.length) {
        const remaining = buffer.length - currentLength;
        // Progressive character and word revelation matching intro speech bubbles (24-26ms)
        let step = 1;
        if (remaining > 160) step = 4;
        else if (remaining > 80) step = 3;
        else if (remaining > 30) step = 2;
        else step = 1;

        currentLength = Math.min(buffer.length, currentLength + step);
        const activeSlice = buffer.substring(0, currentLength);
        targetEl.innerHTML = insertCursorInMarkdown(formatMarkdown(activeSlice));
        messages.scrollTop = messages.scrollHeight;
      }

      if (currentLength >= buffer.length && isFinished) {
        targetEl.innerHTML = formatMarkdown(buffer);
        messages.scrollTop = messages.scrollHeight;
        isTicking = false;
        if (onDone) onDone(buffer);
      } else {
        setTimeout(tick, 24);
      }
    }

    return {
      write(chunk) {
        buffer += chunk;
        if (!isTicking) {
          isTicking = true;
          tick();
        }
      },
      setAll(text) {
        buffer = text;
        if (!isTicking) {
          isTicking = true;
          tick();
        }
      },
      end() {
        isFinished = true;
        if (!isTicking) {
          isTicking = true;
          tick();
        }
      }
    };
  }

  function handleSend() {
    const text = input.value.trim();
    if (!text) return;

    // Dim welcome card on first message
    const welcome = document.querySelector('.moses-welcome');
    if (welcome) welcome.classList.add('dimmed');

    // Append User Message
    appendMsg(escapeHtml(text), 'user');
    input.value = '';
    setStatus('thinking');

    // Show Widened Modern Minimalist Light Maroon Thinking Lines (No text label)
    const thinkingEl = appendMsg(`
      <div class="moses-thinking">
        <div class="moses-thinking-lines">
          <span class="moses-thinking-line"></span>
          <span class="moses-thinking-line"></span>
          <span class="moses-thinking-line"></span>
          <span class="moses-thinking-line"></span>
          <span class="moses-thinking-line"></span>
        </div>
      </div>
    `, 'bot', 'moses-thinking-msg');

    // Build Request Payload
    const payload = {
      message: text,
      history: conversationHistory.slice(-8)
    };

    // Call Backend Streaming / Query Endpoint
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contentType = res.headers.get('content-type') || '';

        // Handle SSE Stream
        if (contentType.includes('text/event-stream')) {
          if (thinkingEl) thinkingEl.remove();
          setStatus('executing');

          const botMsgEl = appendMsg('', 'bot');
          const streamWriter = createTypewriterStream(botMsgEl, (finalText) => {
            conversationHistory.push({ role: 'user', content: text });
            conversationHistory.push({ role: 'assistant', content: finalText });
            setStatus('ready');
          });

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let streamDone = false;

          while (!streamDone) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.replace('data: ', '').trim();
                if (dataStr === '[DONE]') {
                  streamDone = true;
                  break;
                }
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.delta) {
                    streamWriter.write(parsed.delta);
                  }
                } catch (err) {
                  streamWriter.write(dataStr);
                }
              }
            }
          }

          streamWriter.end();
        } else {
          // Standard JSON response fallback with typewriter animation
          const data = await res.json();
          if (thinkingEl) thinkingEl.remove();
          setStatus('executing');
          const reply = data.reply || data.response || "I'm sorry, I couldn't process that request.";
          const botMsgEl = appendMsg('', 'bot');
          const streamWriter = createTypewriterStream(botMsgEl, (finalText) => {
            conversationHistory.push({ role: 'user', content: text });
            conversationHistory.push({ role: 'assistant', content: finalText });
            setStatus('ready');
          });
          streamWriter.setAll(reply);
          streamWriter.end();
        }
      })
      .catch((err) => {
        console.warn('MIRA chat fallback error:', err);
        if (thinkingEl) thinkingEl.remove();
        appendMsg('I apologize, but I encountered a temporary connection issue. Please feel free to ask again or reach out directly to Moses via the contact section below.', 'bot');
        setStatus('ready');
      });
  }

  // ═══════════════════════════════════════════════
  // 8. VOICE / MIC TOGGLE (PLACEHOLDER)
  // ═══════════════════════════════════════════════
  // Reserved for Phase 9B Web Speech API integration

  // ═══════════════════════════════════════════════
  // 9. INTERNAL SECTION SCROLL INTERCEPTOR
  // ═══════════════════════════════════════════════
  wrapper.addEventListener('click', (e) => {
    const link = e.target.closest('.moses-section-link');
    if (link) {
      e.preventDefault();
      const rawSec = link.getAttribute('data-section') || link.getAttribute('href') || '';
      const targetId = rawSec.replace(/^#+/, '').trim().toLowerCase();
      if (targetId) {
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  });

  // ═══════════════════════════════════════════════
  // 10. MARKDOWN FORMATTER HELPER
  // ═══════════════════════════════════════════════
  const KNOWN_PORTFOLIO_SECTIONS = {
    'projects': 'Projects',
    'project': 'Projects',
    'skills': 'Skills',
    'skill': 'Skills',
    'about': 'About',
    'experience': 'Experience',
    'research': 'Research',
    'contact': 'Contact',
    'education': 'Education',
    'certifications': 'Certifications'
  };

  function formatInlineMarkdown(text) {
    if (!text) return '';
    let out = text;

    // 1. Handle markdown section links first: [Text](#section) -> interactive button pill (no URL preview)
    out = out.replace(/\[([^\]]+)\]\((#[^)]+)\)/g, (match, label, href) => {
      const secId = href.replace(/^#+/, '').trim().toLowerCase();
      const displayLabel = label.replace(/^#+/, '').trim();
      return `<button type="button" class="moses-section-link" data-section="${secId}">${displayLabel}</button>`;
    });

    // 2. Handle external web links: [Text](https://...)
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
      return `<a href="${href.trim()}" target="_blank" rel="noopener noreferrer" class="moses-ext-link">${label}</a>`;
    });

    // 3. Handle standalone hashtags: "#projects" -> clickable interactive button "Projects" (no hashtag, no URL preview)
    out = out.replace(/#([a-zA-Z0-9_-]+)/g, (match, rawSec) => {
      const lower = rawSec.toLowerCase();
      const title = KNOWN_PORTFOLIO_SECTIONS[lower] || (rawSec.charAt(0).toUpperCase() + rawSec.slice(1));
      return `<button type="button" class="moses-section-link" data-section="${lower}">${title}</button>`;
    });

    // 4. Bold, Italic, Inline Code
    out = out
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, (match, codeContent) => {
        if (codeContent.includes('moses-section-link')) return codeContent;
        return `<code class="moses-code">${codeContent}</code>`;
      });

    // 5. Clean up any residual double-border box if code tag wrapped the button
    out = out.replace(/<code[^>]*>\s*(<button[^>]+class="moses-section-link"[^>]*>.*?<\/button>)\s*<\/code>/gi, '$1');

    return out;
  }

  function formatMarkdown(text) {
    if (!text) return '';
    const lines = text.split('\n');
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

  // ─── Spacelike Side-Entry, Rest Hold & Fluid Drop (5.2s) ─────
  function triggerArcLaunch() {
    if (!assistantContainer || hasUnlockedAssistant === 'launched') return;
    hasUnlockedAssistant = 'launched';

    assistantContainer.classList.remove('launching');
    assistantContainer.classList.add('launching');

    // Matches 5.2s spacelike side-entry, rest hold & continuous fluid drop
    setTimeout(() => {
      assistantContainer.classList.remove('launching');
      assistantContainer.classList.add('launched');

      // Wait 1.5s after golden ball has settled before revealing 4 orbits & 4 spherical balls
      setTimeout(() => {
        assistantContainer.classList.add('orbits-active');
      }, 1500);

      // After ball lands, show welcome speech bubble
      setTimeout(playIntroBubbles, 350);
    }, 5200);
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

    const spanText = document.createElement('span');
    spanText.className = 'moses-intro-typewriter-text';
    const cursorEl = document.createElement('span');
    cursorEl.className = 'moses-typewriter-cursor';

    bubble.appendChild(spanText);
    bubble.appendChild(cursorEl);

    // Insert before launcher container so it stacks cleanly above it
    const launcherParent = assistantContainer.querySelector('.moses-launcher').parentElement;
    assistantContainer.insertBefore(bubble, launcherParent);

    // Clicking the speech bubble opens the assistant
    bubble.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel(true);
    });

    void bubble.offsetWidth; // force reflow before animation
    bubble.classList.add('show');
    currentIntroBubble = bubble;

    let charI = 0;
    function typeIntroChar() {
      if (currentIntroBubble !== bubble) return;
      if (charI <= text.length) {
        spanText.textContent = text.substring(0, charI);
        charI++;
        setTimeout(typeIntroChar, 26);
      } else {
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
        } else if (onDone) {
          onDone();
        }
      }
    }

    typeIntroChar();
  }

  function playIntroBubbles() {
    showIntroBubble('Hello! I am MIRA Intelligence.', 2400, () => {
      setTimeout(() => {
        showIntroBubble("Moses' Portfolio Intelligence Assistant.", 2100, () => {
          setTimeout(() => {
            showIntroBubble("Always here to help", 0, null);
          }, 600);
        });
      }, 250);
    });
  }

  function checkScrollVisibility() {
    if (!assistantContainer || hasUnlockedAssistant) return;

    const scrollBottom = window.scrollY + window.innerHeight;
    const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const contactSection = document.getElementById('contact');
    const footer = document.querySelector('footer');

    let nearBottom = (docHeight - scrollBottom) <= 350;

    if (!nearBottom && contactSection) {
      const rect = contactSection.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.75) {
        nearBottom = true;
      }
    }

    if (!nearBottom && footer) {
      const fRect = footer.getBoundingClientRect();
      if (fRect.top <= window.innerHeight) {
        nearBottom = true;
      }
    }

    if (nearBottom) {
      hasUnlockedAssistant = true;
      window.removeEventListener('scroll', handleScrollVisibility);
      // Wait 7 seconds after user reaches bottom/contact area before launching
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

  // IntersectionObserver for 100% reliable trigger on modern browsers
  if ('IntersectionObserver' in window) {
    const unlockObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasUnlockedAssistant) {
          hasUnlockedAssistant = true;
          unlockObserver.disconnect();
          window.removeEventListener('scroll', handleScrollVisibility);
          // Wait 7 seconds after user reaches bottom/contact area before launching
          setTimeout(() => {
            triggerArcLaunch();
          }, 7000);
        }
      });
    }, { threshold: 0.15 });

    const contactEl = document.getElementById('contact');
    const footerEl = document.querySelector('footer');
    if (contactEl) unlockObserver.observe(contactEl);
    if (footerEl) unlockObserver.observe(footerEl);
  }

  // Initial check on load
  checkScrollVisibility();

  // ═══════════════════════════════════════════════
  // MIRA INTELLIGENCE 3D FIBONACCI SPHERE & HERO NEURAL BACKGROUND
  // ═══════════════════════════════════════════════
  (function initMiraHeaderNeuralCanvas() {
    const canvas = document.getElementById('miraHeaderCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 430, H = 110;
    let t = 0;
    let isTyping = false;
    let typingGlowAmount = 0.0;
    let currentSpeedFactor = 1.0;
    let currentState = false; // 'thinking' | 'executing' | false

    const N_SPHERE = 26; // 3D Fibonacci sphere nodes
    const N_BG = 24;     // Ambient background hero neural nodes
    const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
    const GOLDEN_ANGLE = Math.PI * 2 * (1 - 1 / GOLDEN_RATIO);
    const MAX_SPHERE_CONN_3D = 0.92;
    const BG_CONN_DIST = 72;

    const MAROON = [107, 26, 42];
    const MAROON_BRIGHT = [168, 38, 76];
    const GOLD = [212, 160, 23];
    const CYAN = [56, 189, 248];
    const NAVY = [13, 27, 62];
    const AMBER_GLOW = [245, 158, 11];

    function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`; }

    function lerpColor(c1, c2, ratio) {
      const r = Math.max(0, Math.min(1, ratio));
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * r),
        Math.round(c1[1] + (c2[1] - c1[1]) * r),
        Math.round(c1[2] + (c2[2] - c1[2]) * r)
      ];
    }

    window.miraSetThinkingState = function (state) { currentState = state; };
    window.miraSetTyping = function (val) { isTyping = val; };

    function resizeCanvas() {
      const parent = canvas.parentElement;
      W = (parent && parent.clientWidth) || 430;
      H = (parent && parent.clientHeight) || 110;
      if (W < 50) W = 430;
      if (H < 20) H = 110;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    window.miraResizeCanvas = resizeCanvas;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 1. Generate 3D nodes on unit sphere using Fibonacci spiral
    const sphereNodes = [];
    for (let i = 0; i < N_SPHERE; i++) {
      const y = 1 - (i / (N_SPHERE - 1)) * 2; // -1 to 1
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = GOLDEN_ANGLE * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      const isMaroon = i % 2 === 0;

      sphereNodes.push({
        origX: x, origY: y, origZ: z,
        x: 0, y: 0, z: 0,
        projX: 0, projY: 0, scale: 1, depth: 0,
        r: 2.4,
        color: isMaroon ? MAROON_BRIGHT : GOLD,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.8 + Math.random() * 0.6
      });
    }

    // Build static 3D neighbor edge list for the sphere
    const sphereEdges = [];
    for (let i = 0; i < N_SPHERE; i++) {
      for (let j = i + 1; j < N_SPHERE; j++) {
        const dx = sphereNodes[i].origX - sphereNodes[j].origX;
        const dy = sphereNodes[i].origY - sphereNodes[j].origY;
        const dz = sphereNodes[i].origZ - sphereNodes[j].origZ;
        const d3 = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d3 < MAX_SPHERE_CONN_3D) {
          sphereEdges.push({ a: sphereNodes[i], b: sphereNodes[j], d3 });
        }
      }
    }

    // 2. Generate ambient background hero neural nodes
    const bgNodes = [];
    for (let i = 0; i < N_BG; i++) {
      const isMaroon = Math.random() > 0.45;
      bgNodes.push({
        x: Math.random() * (W || 430),
        y: Math.random() * (H || 110),
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        baseVx: (Math.random() - 0.5) * 0.18,
        baseVy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.3 + 0.9,
        color: isMaroon ? MAROON : NAVY,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.5 + Math.random() * 0.5
      });
    }

    // Pulses
    const spherePulses = [];
    function spawnSpherePulse() {
      if (spherePulses.length > 10 || sphereEdges.length === 0) return;
      const e = sphereEdges[(Math.random() * sphereEdges.length) | 0];
      spherePulses.push({
        edge: e,
        t: 0,
        speed: 0.014 + Math.random() * 0.014,
        color: Math.random() > 0.5 ? GOLD : CYAN
      });
    }

    let rotY = 0;
    let rotX = 0.22;

    function draw() {
      // Dynamic gradual morph & release decay for typing glow (smooth over ~2 seconds)
      if (isTyping) {
        typingGlowAmount += (1.0 - typingGlowAmount) * 0.09;
      } else {
        typingGlowAmount += (0.0 - typingGlowAmount) * 0.024;
      }

      // Calibrated target speeds: Typing = 1.65x, Executing = 1.35x, Thinking = 1.30x, Default Rest = 1.0x
      let desiredSpeed = 1.0 + typingGlowAmount * 0.65;
      if (currentState === 'executing') desiredSpeed = 1.35;
      else if (currentState === 'thinking') desiredSpeed = 1.30;

      // Smooth dynamic damping interpolation
      currentSpeedFactor += (desiredSpeed - currentSpeedFactor) * 0.048;

      // Serene, reduced speed at rest
      t += 0.013 * currentSpeedFactor;
      rotY += 0.0070 * currentSpeedFactor;
      rotX = 0.22 + Math.sin(t * 0.40) * 0.08;

      ctx.clearRect(0, 0, W, H);

      const baseSphereR = Math.min(W * 0.22, H * 0.38, 42);
      const cx = W / 2;
      const cy = H / 2;
      const focalLength = 170;

      // Determine state color accents & smooth brightness interpolation
      let stateColor = null;
      let brightnessBoost = 1.0 + typingGlowAmount * 0.38;
      if (currentState === 'executing') {
        stateColor = CYAN;
        brightnessBoost = 1.40;
      } else if (currentState === 'thinking') {
        stateColor = GOLD;
        brightnessBoost = 1.32;
      }

      // ──────────────────────────────────────────────
      // A. DRAW BACKGROUND HERO NEURALS (ORGANIC DRIFT & DYNAMIC GLOW MORPH)
      // ──────────────────────────────────────────────
      for (let i = 0; i < bgNodes.length; i++) {
        const bn = bgNodes[i];

        // Soft magnetic breathing pull toward center sphere when typing
        if (typingGlowAmount > 0.05) {
          const dx = cx - bn.x;
          const dy = cy - bn.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 25) {
            bn.vx += dx * (0.00014 * typingGlowAmount);
            bn.vy += dy * (0.00014 * typingGlowAmount);
          }
        } else {
          bn.vx += (bn.baseVx - bn.vx) * 0.02;
          bn.vy += (bn.baseVy - bn.vy) * 0.02;
        }

        // Speed cap
        const curSp = Math.hypot(bn.vx, bn.vy);
        if (curSp > 0.6) {
          bn.vx = (bn.vx / curSp) * 0.6;
          bn.vy = (bn.vy / curSp) * 0.6;
        }

        bn.x += bn.vx * (1.0 + typingGlowAmount * 0.22);
        bn.y += bn.vy * (1.0 + typingGlowAmount * 0.22);

        // Bounds bounce
        if (bn.x < 0) { bn.x = 0; bn.vx = Math.abs(bn.vx); bn.baseVx = Math.abs(bn.baseVx); }
        if (bn.x > W) { bn.x = W; bn.vx = -Math.abs(bn.vx); bn.baseVx = -Math.abs(bn.baseVx); }
        if (bn.y < 0) { bn.y = 0; bn.vy = Math.abs(bn.vy); bn.baseVy = Math.abs(bn.baseVy); }
        if (bn.y > H) { bn.y = H; bn.vy = -Math.abs(bn.vy); bn.baseVy = -Math.abs(bn.baseVy); }

        // Connect nearby background nodes
        for (let j = i + 1; j < bgNodes.length; j++) {
          const b2 = bgNodes[j];
          const d = Math.hypot(bn.x - b2.x, bn.y - b2.y);
          if (d < BG_CONN_DIST) {
            const k = 1 - d / BG_CONN_DIST;
            const alpha = k * 0.22;
            const defaultBgColor = bn.color === MAROON ? MAROON : NAVY;
            const bColor = stateColor || (typingGlowAmount > 0.02 ? lerpColor(defaultBgColor, AMBER_GLOW, typingGlowAmount) : defaultBgColor);
            ctx.strokeStyle = rgba(bColor, alpha);
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(bn.x, bn.y);
            ctx.lineTo(b2.x, b2.y);
            ctx.stroke();
          }
        }

        // Draw background node with smooth color morphing
        const bPulse = 0.75 + 0.25 * Math.sin(t * bn.pulseSpeed + bn.phase);
        const bCol = stateColor || (typingGlowAmount > 0.02 ? lerpColor(bn.color, AMBER_GLOW, typingGlowAmount) : bn.color);
        ctx.fillStyle = rgba(bCol, 0.35 * bPulse);
        ctx.beginPath();
        ctx.arc(bn.x, bn.y, bn.r * bPulse, 0, Math.PI * 2);
        ctx.fill();
      }

      // ──────────────────────────────────────────────
      // B. DRAW 3D FIBONACCI NEURAL SPHERE (SERENE LIVING MORPHOLOGY)
      // ──────────────────────────────────────────────
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      // Rotate all 3D sphere nodes & project with living morphology
      for (let i = 0; i < N_SPHERE; i++) {
        const n = sphereNodes[i];

        // Living 3D harmonic morphology
        const morph = 1.0 + Math.sin(t * 1.3 + n.phase) * 0.08;
        const curR = baseSphereR * morph;

        // Rotation around Y
        const x1 = n.origX * cosY - n.origZ * sinY;
        const z1 = n.origX * sinY + n.origZ * cosY;

        // Rotation around X
        const y1 = n.origY * cosX - z1 * sinX;
        const z2 = n.origY * sinX + z1 * cosX;

        n.x = x1;
        n.y = y1;
        n.z = z2;

        const depthScale = focalLength / (focalLength + z2 * curR * 0.85);
        n.projX = cx + x1 * curR * depthScale;
        n.projY = cy + y1 * curR * depthScale;
        n.scale = depthScale;
        n.depth = (z2 + 1) / 2; // 0 (back) to 1 (front)
      }

      // Draw faint spherical aura behind sphere
      const auraGrad = ctx.createRadialGradient(cx, cy, baseSphereR * 0.2, cx, cy, baseSphereR * 1.4);
      const defaultAuraColor = GOLD;
      const auraColor = stateColor || (typingGlowAmount > 0.02 ? lerpColor(defaultAuraColor, AMBER_GLOW, typingGlowAmount) : defaultAuraColor);
      auraGrad.addColorStop(0, rgba(auraColor, 0.12 * brightnessBoost));
      auraGrad.addColorStop(0.7, rgba(auraColor, 0.04 * brightnessBoost));
      auraGrad.addColorStop(1, rgba(auraColor, 0));
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseSphereR * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Draw 3D Connection lines on the sphere
      ctx.lineCap = 'round';
      for (const e of sphereEdges) {
        const a = e.a, b = e.b;
        const avgDepth = (a.depth + b.depth) / 2;
        const alpha = Math.min(1.0, (Math.pow(avgDepth, 1.6) * 0.62 + 0.10) * brightnessBoost);

        const grad = ctx.createLinearGradient(a.projX, a.projY, b.projX, b.projY);
        const colA = stateColor || (typingGlowAmount > 0.02 ? lerpColor(a.color, AMBER_GLOW, typingGlowAmount) : a.color);
        const colB = stateColor || (typingGlowAmount > 0.02 ? lerpColor(b.color, AMBER_GLOW, typingGlowAmount) : b.color);
        grad.addColorStop(0, rgba(colA, alpha));
        grad.addColorStop(1, rgba(colB, alpha));

        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(0.6, (0.5 + avgDepth * 1.3) * DPR * 0.75);
        ctx.beginPath();
        ctx.moveTo(a.projX, a.projY);
        ctx.lineTo(b.projX, b.projY);
        ctx.stroke();
      }

      // Synaptic Pulses traveling across 3D spherical edges
      if (Math.random() < (0.07 + typingGlowAmount * 0.12)) spawnSpherePulse();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = spherePulses.length - 1; i >= 0; i--) {
        const p = spherePulses[i];
        p.t += p.speed * currentSpeedFactor;
        if (p.t >= 1) { spherePulses.splice(i, 1); continue; }

        const a = p.edge.a, b = p.edge.b;
        const px = a.projX + (b.projX - a.projX) * p.t;
        const py = a.projY + (b.projY - a.projY) * p.t;
        const avgDepth = (a.depth + b.depth) / 2;
        const fade = Math.sin(p.t * Math.PI);
        const pColor = stateColor || (typingGlowAmount > 0.02 ? lerpColor(p.color, AMBER_GLOW, typingGlowAmount) : p.color);
        const pulseR = (4 + avgDepth * 4.5) * p.edge.a.scale;

        const g = ctx.createRadialGradient(px, py, 0, px, py, pulseR);
        g.addColorStop(0, rgba(pColor, 0.52 * fade * avgDepth * brightnessBoost));
        g.addColorStop(1, rgba(pColor, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, pulseR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // Sort sphere nodes by depth (z ascending) for proper 3D rendering
      const sortedSphereNodes = [...sphereNodes].sort((a, b) => a.z - b.z);

      // Draw 3D sphere nodes with smooth color morphing
      for (const n of sortedSphereNodes) {
        const pulse = 0.8 + 0.2 * Math.sin(t * n.pulseSpeed + n.phase);
        const nodeColor = stateColor || (typingGlowAmount > 0.02 ? lerpColor(n.color, AMBER_GLOW, typingGlowAmount) : n.color);
        const nodeR = n.r * n.scale * pulse;
        const haloR = (n.r + 6.0) * n.scale * pulse * (0.5 + n.depth * 0.7);

        // Ambient halo
        const halo = ctx.createRadialGradient(n.projX, n.projY, 0, n.projX, n.projY, haloR);
        halo.addColorStop(0, rgba(nodeColor, Math.min(1.0, 0.52 * n.depth * brightnessBoost)));
        halo.addColorStop(1, rgba(nodeColor, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(n.projX, n.projY, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Node core
        ctx.beginPath();
        ctx.arc(n.projX, n.projY, nodeR, 0, Math.PI * 2);
        ctx.fillStyle = rgba(nodeColor, Math.min(1.0, (0.40 + n.depth * 0.60) * brightnessBoost));
        ctx.fill();

        // Specular highlight for front-facing nodes
        if (n.depth > 0.45) {
          ctx.beginPath();
          ctx.arc(n.projX - nodeR * 0.3, n.projY - nodeR * 0.3, nodeR * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1.0, (n.depth - 0.45) * 1.6 * brightnessBoost)})`;
          ctx.fill();
        }
      }

      requestAnimationFrame(draw);
    }

    draw();
  })();

  const inputEl = document.getElementById('mosesInput');
  const composerWrap = document.querySelector('.moses-composer-wrap');
  let typingTimer = null;
  let lastKeystrokeTime = 0;

  function setTypingVisuals(active) {
    if (composerWrap) {
      if (active) composerWrap.classList.add('active-typing');
      else composerWrap.classList.remove('active-typing');
    }
    const welcomeEl = document.querySelector('.moses-welcome');
    if (welcomeEl) {
      if (active && inputEl && inputEl.value.trim().length > 0) welcomeEl.classList.add('dimmed');
      else welcomeEl.classList.remove('dimmed');
    }
  }

  if (inputEl) {
    inputEl.addEventListener('input', () => {
      const now = performance.now();
      const dt = lastKeystrokeTime > 0 ? (now - lastKeystrokeTime) : 300;
      lastKeystrokeTime = now;

      // Calculate keystroke velocity (gentle subtle luminescence & slight breathing acceleration)
      const velocity = dt > 0 ? Math.min(1.22, Math.max(1.0, 1 + 50 / (dt + 250))) : 1.05;
      if (window.miraSetTypingVelocity) window.miraSetTypingVelocity(velocity);
      if (window.miraSetTyping) window.miraSetTyping(true);

      setTypingVisuals(true);

      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        if (window.miraSetTyping) window.miraSetTyping(false);
        if (window.miraSetTypingVelocity) window.miraSetTypingVelocity(1.0);
        setTypingVisuals(false);
      }, 1100);
    });

    inputEl.addEventListener('focus', () => {
      if (inputEl.value.trim().length > 0) setTypingVisuals(true);
    });

    inputEl.addEventListener('blur', () => {
      if (window.miraSetTyping) window.miraSetTyping(false);
      if (window.miraSetTypingVelocity) window.miraSetTypingVelocity(1.0);
      setTypingVisuals(false);
    });

    if (form) {
      form.addEventListener('submit', () => {
        if (window.miraSetTyping) window.miraSetTyping(false);
        if (window.miraSetTypingVelocity) window.miraSetTypingVelocity(1.0);
        setTypingVisuals(false);
      });
    }
  }
})();
