/**
 * Peace App — main renderer entry point.
 * Wires together WebGL, UI controls, Pomodoro, and Electron IPC.
 */

(function () {
  'use strict';

  // ── DOM refs ────────────────────────────────────────────────────────────
  const canvas      = document.getElementById('bg-canvas');
  const topTrigger  = document.getElementById('top-trigger');
  const topMenu     = document.getElementById('top-menu');
  const editor      = document.getElementById('editor');
  const btnSave     = document.getElementById('btn-save');
  const btnRelease  = document.getElementById('btn-release');
  const timerDisplay = document.getElementById('timer-display');
  const sliderVolume  = document.getElementById('slider-volume');
  const sliderEffects = document.getElementById('slider-effects');
  const glassContainer = document.getElementById('glass-container');

  // ── WebGL ───────────────────────────────────────────────────────────────
  const renderer = new WebGLRenderer(canvas);

  // Placeholder: a simple gradient shader to verify the pipeline works.
  // Will be replaced with Seascape & Heartfelt in Phase 3.
  const VERT_FULLSCREEN = `
    #version 300 es
    void main() {
      // Fullscreen triangle trick: 3 vertices cover the screen
      vec2 pos = vec2(
        float((gl_VertexID & 1) << 2) - 1.0,
        float((gl_VertexID & 2) << 1) - 1.0
      );
      gl_Position = vec4(pos, 0.0, 1.0);
    }
  `;

  const FRAG_PLACEHOLDER = `
    #version 300 es
    precision highp float;
    uniform float iTime;
    uniform vec3 iResolution;
    out vec4 fragColor;

    void main() {
      vec2 uv = gl_FragCoord.xy / iResolution.xy;
      // Dark atmospheric gradient — placeholder until real shaders
      vec3 col = mix(
        vec3(0.02, 0.02, 0.06),
        vec3(0.08, 0.06, 0.14),
        uv.y
      );
      // Subtle time-based shimmer
      col += 0.01 * sin(iTime * 0.5 + uv.x * 6.0);
      fragColor = vec4(col, 1.0);
    }
  `;

  renderer.registerMode('rain', VERT_FULLSCREEN, FRAG_PLACEHOLDER);
  renderer.registerMode('sea', VERT_FULLSCREEN, FRAG_PLACEHOLDER);
  renderer.setMode('rain');
  renderer.start();

  // ── Pomodoro ────────────────────────────────────────────────────────────
  const pomodoro = new Pomodoro(timerDisplay, 25);

  // ── Top Menu (hover 2s to reveal) ──────────────────────────────────────
  let menuHoverTimer = null;

  topTrigger.addEventListener('mouseenter', () => {
    menuHoverTimer = setTimeout(() => {
      topMenu.classList.add('visible');
    }, 2000);
  });

  topTrigger.addEventListener('mouseleave', () => {
    clearTimeout(menuHoverTimer);
  });

  topMenu.addEventListener('mouseleave', () => {
    topMenu.classList.remove('visible');
  });

  // Keep menu open when moving from trigger to menu
  topMenu.addEventListener('mouseenter', () => {
    clearTimeout(menuHoverTimer);
  });

  // Mode switching
  document.querySelectorAll('.menu-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      renderer.setMode(mode);

      // Update active button style
      document.querySelectorAll('.menu-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // TODO Phase 5: Switch audio source
    });
  });

  // Set initial active button
  document.querySelector('[data-mode="rain"]').classList.add('active');

  // ── Save ────────────────────────────────────────────────────────────────
  btnSave.addEventListener('click', async () => {
    const content = editor.value;
    if (!content.trim()) return;

    if (window.peace) {
      const result = await window.peace.saveFile(content);
      if (result.success) {
        // Subtle visual feedback — briefly dim the button
        btnSave.style.color = 'rgba(120, 255, 180, 0.8)';
        setTimeout(() => { btnSave.style.color = ''; }, 800);
      }
    }
  });

  // ── Release (burn after reading) ────────────────────────────────────────
  btnRelease.addEventListener('click', () => {
    if (!editor.value.trim()) return;

    editor.classList.add('releasing');
    editor.addEventListener('animationend', () => {
      editor.value = '';
      editor.classList.remove('releasing');
      editor.style.opacity = '1';
      editor.style.filter = '';
    }, { once: true });
  });

  // ── Effects Slider → Glass transparency/blur ────────────────────────────
  sliderEffects.addEventListener('input', () => {
    const val = sliderEffects.value / 100; // 0..1
    // Map: 0 = nearly transparent (alpha 0.02, blur 2px)
    //       1 = strong frosted (alpha 0.18, blur 24px)
    const alpha = 0.02 + val * 0.16;
    const blur = 2 + val * 22;
    glassContainer.style.setProperty('--glass-alpha', alpha);
    glassContainer.style.setProperty('--glass-blur', blur + 'px');
  });

  // ── Volume Slider → Audio ───────────────────────────────────────────────
  sliderVolume.addEventListener('input', () => {
    const vol = sliderVolume.value / 100;
    const audioRain = document.getElementById('audio-rain');
    const audioSea = document.getElementById('audio-sea');
    if (audioRain) audioRain.volume = vol;
    if (audioSea) audioSea.volume = vol;
  });

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // Escape to quit
    if (e.key === 'Escape') {
      if (window.peace) window.peace.quitApp();
    }
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      btnSave.click();
    }
  });

})();
