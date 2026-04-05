/**
 * Peace App — main renderer entry point (ES module).
 * Cyber Zen spec: all UI ghost by default, fade-in on hover.
 * TipTap block editor, WebGL backgrounds, auto-save, Vibe Mixer.
 */

import { WebGLRenderer } from './webgl.js';
import { BurnEffect } from './burn.js';
import { Pomodoro } from './pomodoro.js';
import { createEditor, exportHTML, exportMarkdown, toolbarActions } from './editor.js';
import defaultBgUrl from '../../BG/default.jpg?url';
import rainAmbientUrl from '../../music/rain_ambient.mp3?url';
import seaAmbientUrl from '../../music/sea_ambient_mp3.mp3?url';

// ── DOM refs ────────────────────────────────────────────────────────────
const canvas         = document.getElementById('bg-canvas');
const burnCanvas     = document.getElementById('burn-canvas');
const topTrigger     = document.getElementById('top-trigger');
const topMenu        = document.getElementById('top-menu');
const editorEl       = document.getElementById('editor');
const btnSave        = document.getElementById('btn-save');
const saveFormat     = document.getElementById('save-format');
const btnRelease     = document.getElementById('btn-release');
const timerDisplay   = document.getElementById('timer-display');
const pomodoroEl     = document.getElementById('pomodoro');
const sliderBlur     = document.getElementById('slider-blur');
const sliderVolume   = document.getElementById('slider-volume');
const glassContainer = document.getElementById('glass-container');
const tbFont         = document.getElementById('tb-font');
const tbSize         = document.getElementById('tb-size');
const tbColorTrigger = document.getElementById('tb-color-trigger');
const tbColorBar     = document.getElementById('tb-color-bar');
const tbColorPalette = document.getElementById('tb-color-palette');
const vibeTrigger    = document.getElementById('vibe-trigger');
const vibeMixer      = document.getElementById('vibe-mixer');
const blurValue      = document.getElementById('blur-value');
const volumeValue    = document.getElementById('volume-value');

// ── LocalStorage keys ───────────────────────────────────────────────────
const LS_KEY_CONTENT = 'peace_editor_content';
const LS_KEY_FONT    = 'peace_font';
const LS_KEY_SIZE    = 'peace_size';
const LS_KEY_MODE    = 'peace_mode';
const LS_KEY_BLUR    = 'peace_blur';
const LS_KEY_VOLUME  = 'peace_volume';

// ── WebGL ───────────────────────────────────────────────────────────────
const renderer = new WebGLRenderer(canvas);

const FRAG_PLACEHOLDER = `#version 300 es
  precision highp float;
  uniform float iTime;
  uniform vec3 iResolution;
  out vec4 fragColor;
  void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec3 col = mix(vec3(0.02, 0.02, 0.06), vec3(0.08, 0.06, 0.14), uv.y);
    col += 0.008 * sin(iTime * 0.4 + uv.x * 5.0);
    fragColor = vec4(col, 1.0);
  }`;

// Rain background texture
const rainBgTexture = renderer.loadTexture(defaultBgUrl, true);

renderer.registerMode('rain', { fragSrc: FRAG_PLACEHOLDER });
renderer.registerMode('sea',  { fragSrc: FRAG_PLACEHOLDER });

// ── Rain / Sea Control Panel DOM refs ───────────────────────────────────
const rainCtrlToggle = document.getElementById('rain-ctrl-toggle');
const rainCtrlPanel  = document.getElementById('rain-ctrl-panel');
const ctrlRain       = document.getElementById('ctrl-rain');
const ctrlFog        = document.getElementById('ctrl-fog');
const ctrlRefract    = document.getElementById('ctrl-refract');
const ctrlRainVal    = document.getElementById('ctrl-rain-val');
const ctrlFogVal     = document.getElementById('ctrl-fog-val');
const ctrlRefractVal = document.getElementById('ctrl-refract-val');
const btnBgUpload    = document.getElementById('btn-bg-upload');

const seaCtrlToggle  = document.getElementById('sea-ctrl-toggle');
const seaCtrlPanel   = document.getElementById('sea-ctrl-panel');
const ctrlWaves      = document.getElementById('ctrl-waves');
const ctrlRotate     = document.getElementById('ctrl-rotate');
const ctrlHorizon    = document.getElementById('ctrl-horizon');
const ctrlWavesVal   = document.getElementById('ctrl-waves-val');
const ctrlRotateVal  = document.getElementById('ctrl-rotate-val');
const ctrlHorizonVal = document.getElementById('ctrl-horizon-val');

// Async-load real shaders
(async function loadShaders() {
  try {
    const [rainRes, seaRes] = await Promise.all([
      fetch('shaders/rain.frag.glsl'),
      fetch('shaders/seascape.frag.glsl'),
    ]);

    if (seaRes.ok) {
      const seaSrc = await seaRes.text();
      renderer.registerMode('sea', {
        fragSrc: seaSrc,
        customUniforms: {
          uWaveHeight: ctrlWaves.value / 100,
          uRotateSpeed: ctrlRotate.value / 100,
          uHorizon: ctrlHorizon.value / 100,
        },
      });
    }

    if (rainRes.ok) {
      const rainSrc = await rainRes.text();
      renderer.registerMode('rain', {
        fragSrc: rainSrc,
        inputs: { iChannel0: rainBgTexture },
        customUniforms: {
          uRainAmount: ctrlRain.value / 100,
          uFogAmount: ctrlFog.value / 100,
          uRefraction: ctrlRefract.value / 100,
        },
      });
    }
  } catch (e) {
    console.warn('Failed to load shaders:', e);
  }
})();

// ── TipTap Editor ───────────────────────────────────────────────────────
const savedContent = localStorage.getItem(LS_KEY_CONTENT);
let editorContent = '';
if (savedContent) {
  try {
    editorContent = savedContent;
  } catch { editorContent = ''; }
}

const editor = createEditor(editorEl, {
  content: editorContent,
  placeholder: 'Begin writing...',
  onUpdate: ({ editor: ed }) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(LS_KEY_CONTENT, ed.getHTML());
    }, 300);
  },
});

let saveTimer = null;

// ── Toolbar Wiring ──────────────────────────────────────────────────────
document.querySelectorAll('#editor-toolbar .tb-btn').forEach((btn) => {
  const action = btn.dataset.action;
  if (!action) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const fn = toolbarActions[action];
    if (typeof fn === 'function') {
      fn(editor);
    }
  });
});

// Update toolbar active states on editor changes
editor.on('transaction', () => {
  document.querySelectorAll('#editor-toolbar .tb-btn').forEach((btn) => {
    const action = btn.dataset.action;
    if (!action) return;
    let isActive = false;
    if (action === 'bold') isActive = editor.isActive('bold');
    else if (action === 'italic') isActive = editor.isActive('italic');
    else if (action === 'heading1') isActive = editor.isActive('heading', { level: 1 });
    else if (action === 'heading2') isActive = editor.isActive('heading', { level: 2 });
    else if (action === 'heading3') isActive = editor.isActive('heading', { level: 3 });
    else if (action === 'taskList') isActive = editor.isActive('taskList');
    btn.classList.toggle('is-active', isActive);
  });
});

// ── Burn Effect ─────────────────────────────────────────────────────────
const burnEffect = new BurnEffect(burnCanvas);

// ── Pomodoro ────────────────────────────────────────────────────────────
const pomodoroGroup = document.getElementById('pomodoro-group');
const timerMinus    = document.getElementById('timer-minus');
const timerPlus     = document.getElementById('timer-plus');
const pomodoro = new Pomodoro(timerDisplay, pomodoroEl, pomodoroGroup, 5);

timerMinus.addEventListener('click', (e) => {
  e.stopPropagation();
  pomodoro.adjustTime(-5 * 60);
});
timerPlus.addEventListener('click', (e) => {
  e.stopPropagation();
  pomodoro.adjustTime(+5 * 60);
});

// ═══════════════════════════════════════════════════════════════════════
// Restore saved state
// ═══════════════════════════════════════════════════════════════════════
const savedMode = localStorage.getItem(LS_KEY_MODE) || 'rain';
renderer.setMode(savedMode);
renderer.start();

// Restore font
const FONT_SIZE_MAP = { small: 27, medium: 33, large: 40 };
const proseMirrorEl = () => editorEl.querySelector('.ProseMirror');

const savedFont = localStorage.getItem(LS_KEY_FONT);
if (savedFont && tbFont) {
  tbFont.value = savedFont;
  // Apply font after ProseMirror is ready
  requestAnimationFrame(() => {
    const pm = proseMirrorEl();
    if (pm) pm.style.fontFamily = savedFont;
  });
}

const savedSize = localStorage.getItem(LS_KEY_SIZE) || 'small';
if (tbSize) tbSize.value = savedSize;
requestAnimationFrame(() => {
  const pm = proseMirrorEl();
  if (pm) pm.style.fontSize = FONT_SIZE_MAP[savedSize] + 'px';
});

// Restore blur (default 20)
const savedBlur = localStorage.getItem(LS_KEY_BLUR);
const initBlur = savedBlur !== null ? savedBlur : '20';
sliderBlur.value = initBlur;
blurValue.textContent = initBlur;
_applyBlur(initBlur / 100);

// Restore volume
const savedVolume = localStorage.getItem(LS_KEY_VOLUME);
if (savedVolume !== null) {
  sliderVolume.value = savedVolume;
  volumeValue.textContent = savedVolume;
} else {
  volumeValue.textContent = sliderVolume.value;
}

// Set active mode button
document.querySelectorAll('.menu-btn').forEach((b) => {
  b.classList.toggle('active', b.dataset.mode === savedMode);
});

// ═══════════════════════════════════════════════════════════════════════
// Top Menu — hover top 50px to reveal
// ═══════════════════════════════════════════════════════════════════════
let menuHoverTimer = null;

topTrigger.addEventListener('mouseenter', () => {
  menuHoverTimer = setTimeout(() => topMenu.classList.add('visible'), 600);
});

topTrigger.addEventListener('mouseleave', () => {
  clearTimeout(menuHoverTimer);
  setTimeout(() => {
    if (!topMenu.matches(':hover') && !topTrigger.matches(':hover'))
      topMenu.classList.remove('visible');
  }, 200);
});

topMenu.addEventListener('mouseleave', () => {
  setTimeout(() => {
    if (!topMenu.matches(':hover') && !topTrigger.matches(':hover'))
      topMenu.classList.remove('visible');
  }, 150);
});

// Mode switching
document.querySelectorAll('.menu-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (!mode) return;
    renderer.setMode(mode);
    localStorage.setItem(LS_KEY_MODE, mode);
    document.querySelectorAll('.menu-btn[data-mode]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    _updateCtrlVisibility();
    _crossfadeTo(mode);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Vibe Mixer — bottom edge hover
// ═══════════════════════════════════════════════════════════════════════
let vibeHoverTimer = null;

vibeTrigger.addEventListener('mouseenter', () => {
  vibeHoverTimer = setTimeout(() => vibeMixer.classList.add('visible'), 400);
});

vibeTrigger.addEventListener('mouseleave', () => {
  clearTimeout(vibeHoverTimer);
  setTimeout(() => {
    if (!vibeMixer.matches(':hover') && !vibeTrigger.matches(':hover'))
      vibeMixer.classList.remove('visible');
  }, 200);
});

vibeMixer.addEventListener('mouseleave', () => {
  setTimeout(() => {
    if (!vibeMixer.matches(':hover') && !vibeTrigger.matches(':hover'))
      vibeMixer.classList.remove('visible');
  }, 150);
});

// ═══════════════════════════════════════════════════════════════════════
// Toolbar Font / Size / Color
// ═══════════════════════════════════════════════════════════════════════

// Font family dropdown
tbFont?.addEventListener('change', () => {
  const pm = proseMirrorEl();
  if (pm) pm.style.fontFamily = tbFont.value;
  localStorage.setItem(LS_KEY_FONT, tbFont.value);
});

// Font size dropdown
tbSize?.addEventListener('change', () => {
  const size = FONT_SIZE_MAP[tbSize.value];
  if (size) {
    const pm = proseMirrorEl();
    if (pm) pm.style.fontSize = size + 'px';
    localStorage.setItem(LS_KEY_SIZE, tbSize.value);
  }
});

// Color picker — toggle palette
let colorPaletteOpen = false;

tbColorTrigger?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  colorPaletteOpen = !colorPaletteOpen;
  tbColorPalette.classList.toggle('visible', colorPaletteOpen);
});

// Close palette on outside click
document.addEventListener('click', (e) => {
  if (colorPaletteOpen && !tbColorPalette?.contains(e.target) && e.target !== tbColorTrigger && !tbColorTrigger?.contains(e.target)) {
    colorPaletteOpen = false;
    tbColorPalette?.classList.remove('visible');
  }
});

// Color swatch clicks
tbColorPalette?.querySelectorAll('.color-swatch').forEach((swatch) => {
  swatch.addEventListener('click', (e) => {
    e.stopPropagation();
    const color = swatch.dataset.color;

    // Update active state
    tbColorPalette.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');

    // Apply color or unset
    if (color) {
      editor.chain().focus().setColor(color).run();
      tbColorBar.style.background = color;
    } else {
      editor.chain().focus().unsetColor().run();
      tbColorBar.style.background = 'rgba(255, 255, 255, 0.9)';
    }

    // Close palette
    colorPaletteOpen = false;
    tbColorPalette.classList.remove('visible');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Save (Export HTML / Markdown)
// ═══════════════════════════════════════════════════════════════════════
btnSave.addEventListener('click', async () => {
  const format = saveFormat.value; // 'html' or 'md'
  let content;

  if (format === 'md') {
    content = exportMarkdown(editor);
  } else {
    content = exportHTML(editor);
  }

  if (!content.trim()) return;

  if (window.peace) {
    const result = await window.peace.saveFile(content, format);
    if (result.success) {
      btnSave.style.color = 'rgba(120, 255, 180, 0.7)';
      setTimeout(() => { btnSave.style.color = ''; }, 800);
    }
  } else {
    // Web fallback: download via blob
    const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `peace-writing.${format === 'md' ? 'md' : 'html'}`;
    a.click();
    URL.revokeObjectURL(a.href);
    btnSave.style.color = 'rgba(120, 255, 180, 0.7)';
    setTimeout(() => { btnSave.style.color = ''; }, 800);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Release (burn after reading) — adapted for TipTap
// ═══════════════════════════════════════════════════════════════════════
btnRelease.addEventListener('click', () => {
  const html = editor.getHTML();
  if (!html || html === '<p></p>' || burnEffect.running) return;

  // For TipTap, we burn the ProseMirror element directly
  // The burn effect works with the visual position of text
  const pm = proseMirrorEl();
  if (!pm) return;

  // Create a temporary textarea-like approach: capture the text content
  // and simulate burning on an overlay
  const textContent = editor.getText();
  if (!textContent.trim()) return;

  // Use a temporary hidden textarea for burn effect compatibility
  const tempTextarea = document.createElement('textarea');
  tempTextarea.value = textContent;
  tempTextarea.style.cssText = pm.style.cssText;
  tempTextarea.style.position = 'absolute';
  tempTextarea.style.top = '0';
  tempTextarea.style.left = '0';
  tempTextarea.style.width = '100%';
  tempTextarea.style.height = '100%';
  tempTextarea.style.background = 'transparent';
  tempTextarea.style.border = 'none';
  tempTextarea.style.outline = 'none';
  tempTextarea.style.color = getComputedStyle(pm).color;
  tempTextarea.style.fontFamily = getComputedStyle(pm).fontFamily;
  tempTextarea.style.fontSize = getComputedStyle(pm).fontSize;
  tempTextarea.style.lineHeight = getComputedStyle(pm).lineHeight;
  tempTextarea.style.padding = getComputedStyle(pm).padding;
  tempTextarea.style.overflow = 'hidden';
  tempTextarea.style.resize = 'none';
  tempTextarea.readOnly = true;

  // Hide ProseMirror, show temp textarea in same position
  const editorRect = editorEl.getBoundingClientRect();
  editorEl.style.position = 'relative';
  editorEl.appendChild(tempTextarea);
  pm.style.visibility = 'hidden';

  burnEffect.ignite(tempTextarea, () => {
    // Clear editor content after burn
    editor.commands.clearContent();
    localStorage.removeItem(LS_KEY_CONTENT);
    pm.style.visibility = 'visible';
    if (tempTextarea.parentNode) tempTextarea.remove();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Blur Slider → Glass transparency / blur
// ═══════════════════════════════════════════════════════════════════════
function _applyBlur(val) {
  const alpha = val * 0.18;
  const blur = val * 24;
  const borderAlpha = val * 0.08;
  glassContainer.style.setProperty('--glass-alpha', alpha);
  glassContainer.style.setProperty('--glass-blur', blur + 'px');
  glassContainer.style.borderColor = `rgba(255, 255, 255, ${borderAlpha})`;
}

sliderBlur.addEventListener('input', () => {
  const val = sliderBlur.value / 100;
  _applyBlur(val);
  blurValue.textContent = sliderBlur.value;
  localStorage.setItem(LS_KEY_BLUR, sliderBlur.value);
});

// ═══════════════════════════════════════════════════════════════════════
// Audio — ambient white noise with smooth crossfade
// ═══════════════════════════════════════════════════════════════════════
const audioRain = document.getElementById('audio-rain');
const audioSea  = document.getElementById('audio-sea');
const FADE_MS   = 1500;
const FADE_STEP = 30;
let targetVolume = sliderVolume.value / 100;
let audioUnlocked = false;

const audioMap = { rain: audioRain, sea: audioSea };
let activeAudio = null;
let fadeInterval = null;

audioRain.src = rainAmbientUrl;
audioSea.src = seaAmbientUrl;
audioRain.load();
audioSea.load();

function _crossfadeTo(mode) {
  const next = audioMap[mode];
  if (!next || next === activeAudio) return;
  if (!audioUnlocked) return;

  const prev = activeAudio;
  activeAudio = next;

  next.volume = 0;
  next.currentTime = next.currentTime || 0;
  next.play().catch(() => {});

  const steps = FADE_MS / FADE_STEP;
  const fadeOutStep = prev ? (prev.volume / steps) : 0;
  const fadeInStep  = targetVolume / steps;
  let tick = 0;

  clearInterval(fadeInterval);
  fadeInterval = setInterval(() => {
    tick++;
    if (prev) prev.volume = Math.max(0, prev.volume - fadeOutStep);
    next.volume = Math.min(targetVolume, next.volume + fadeInStep);

    if (tick >= steps) {
      clearInterval(fadeInterval);
      fadeInterval = null;
      if (prev) { prev.pause(); prev.volume = 0; }
      next.volume = targetVolume;
    }
  }, FADE_STEP);
}

sliderVolume.addEventListener('input', () => {
  targetVolume = sliderVolume.value / 100;
  if (activeAudio) activeAudio.volume = targetVolume;
  volumeValue.textContent = sliderVolume.value;
  localStorage.setItem(LS_KEY_VOLUME, sliderVolume.value);
});

// Start ambient on first user interaction
function _tryAutoplay() {
  audioUnlocked = true;
  _crossfadeTo(renderer.activeMode);
  document.removeEventListener('click', _tryAutoplay);
  document.removeEventListener('keydown', _tryAutoplay);
}
document.addEventListener('click', _tryAutoplay);
document.addEventListener('keydown', _tryAutoplay);

// ═══════════════════════════════════════════════════════════════════════
// Window controls (frameless)
// ═══════════════════════════════════════════════════════════════════════
document.getElementById('win-minimize')?.addEventListener('click', () => {
  if (window.peace) window.peace.windowMinimize();
});
document.getElementById('win-maximize')?.addEventListener('click', () => {
  if (window.peace) window.peace.windowMaximize();
});
document.getElementById('win-close')?.addEventListener('click', () => {
  if (window.peace) window.peace.windowClose();
});

// ═══════════════════════════════════════════════════════════════════════
// Rain / Sea Control Panels
// ═══════════════════════════════════════════════════════════════════════
let rainCtrlOpen = false;
let seaCtrlOpen = false;

function _updateCtrlVisibility() {
  const mode = renderer.activeMode;
  const isRain = mode === 'rain';
  const isSea  = mode === 'sea';

  rainCtrlToggle.classList.toggle('hidden', !isRain);
  if (!isRain) {
    rainCtrlPanel.classList.remove('visible');
    rainCtrlToggle.classList.remove('active');
    rainCtrlOpen = false;
  }

  seaCtrlToggle.classList.toggle('hidden', !isSea);
  if (!isSea) {
    seaCtrlPanel.classList.remove('visible');
    seaCtrlToggle.classList.remove('active');
    seaCtrlOpen = false;
  }
}

rainCtrlToggle.addEventListener('click', () => {
  rainCtrlOpen = !rainCtrlOpen;
  rainCtrlPanel.classList.toggle('visible', rainCtrlOpen);
  rainCtrlToggle.classList.toggle('active', rainCtrlOpen);
});

seaCtrlToggle.addEventListener('click', () => {
  seaCtrlOpen = !seaCtrlOpen;
  seaCtrlPanel.classList.toggle('visible', seaCtrlOpen);
  seaCtrlToggle.classList.toggle('active', seaCtrlOpen);
});

document.addEventListener('click', (e) => {
  if (rainCtrlOpen && !rainCtrlPanel.contains(e.target) && e.target !== rainCtrlToggle && !rainCtrlToggle.contains(e.target)) {
    rainCtrlOpen = false;
    rainCtrlPanel.classList.remove('visible');
    rainCtrlToggle.classList.remove('active');
  }
  if (seaCtrlOpen && !seaCtrlPanel.contains(e.target) && e.target !== seaCtrlToggle && !seaCtrlToggle.contains(e.target)) {
    seaCtrlOpen = false;
    seaCtrlPanel.classList.remove('visible');
    seaCtrlToggle.classList.remove('active');
  }
});

// Slider → shader uniform
ctrlRain.addEventListener('input', () => {
  ctrlRainVal.textContent = ctrlRain.value;
  renderer.setUniform('rain', 'uRainAmount', ctrlRain.value / 100);
});
ctrlFog.addEventListener('input', () => {
  ctrlFogVal.textContent = ctrlFog.value;
  renderer.setUniform('rain', 'uFogAmount', ctrlFog.value / 100);
});
ctrlRefract.addEventListener('input', () => {
  ctrlRefractVal.textContent = ctrlRefract.value;
  renderer.setUniform('rain', 'uRefraction', ctrlRefract.value / 100);
});
ctrlWaves.addEventListener('input', () => {
  ctrlWavesVal.textContent = ctrlWaves.value;
  renderer.setUniform('sea', 'uWaveHeight', ctrlWaves.value / 100);
});
ctrlRotate.addEventListener('input', () => {
  ctrlRotateVal.textContent = ctrlRotate.value;
  renderer.setUniform('sea', 'uRotateSpeed', ctrlRotate.value / 100);
});
ctrlHorizon.addEventListener('input', () => {
  ctrlHorizonVal.textContent = ctrlHorizon.value;
  renderer.setUniform('sea', 'uHorizon', ctrlHorizon.value / 100);
});

// ═══════════════════════════════════════════════════════════════════════
// Background upload with crop preview
// ═══════════════════════════════════════════════════════════════════════
const previewOverlay = document.getElementById('bg-preview-overlay');
const previewImg     = document.getElementById('bg-preview-img');
const previewCancel  = document.getElementById('bg-preview-cancel');
const previewConfirm = document.getElementById('bg-preview-confirm');
const cropContainer  = document.getElementById('crop-container');
const cropRect       = document.getElementById('crop-rect');
const cropInfo       = document.getElementById('crop-info');
const dimTop         = document.getElementById('crop-dim-top');
const dimBottom      = document.getElementById('crop-dim-bottom');
const dimLeft        = document.getElementById('crop-dim-left');
const dimRight       = document.getElementById('crop-dim-right');

const OUTPUT_W = 2560, OUTPUT_H = 1440;
const ASPECT   = OUTPUT_W / OUTPUT_H;

let pendingImg = null;
let crop = { x: 0, y: 0, w: 0, h: 0 };
let dragState = null;

function _updateDims() {
  const cw = cropContainer.offsetWidth;
  const ch = cropContainer.offsetHeight;
  dimTop.style.cssText    = `top:0; left:0; width:${cw}px; height:${crop.y}px;`;
  dimBottom.style.cssText = `top:${crop.y + crop.h}px; left:0; width:${cw}px; height:${ch - crop.y - crop.h}px;`;
  dimLeft.style.cssText   = `top:${crop.y}px; left:0; width:${crop.x}px; height:${crop.h}px;`;
  dimRight.style.cssText  = `top:${crop.y}px; left:${crop.x + crop.w}px; width:${cw - crop.x - crop.w}px; height:${crop.h}px;`;
  cropRect.style.left   = crop.x + 'px';
  cropRect.style.top    = crop.y + 'px';
  cropRect.style.width  = crop.w + 'px';
  cropRect.style.height = crop.h + 'px';
  if (pendingImg) {
    const scaleX = pendingImg.naturalWidth / cropContainer.offsetWidth;
    const scaleY = pendingImg.naturalHeight / cropContainer.offsetHeight;
    const srcW = Math.round(crop.w * scaleX);
    const srcH = Math.round(crop.h * scaleY);
    cropInfo.textContent = `Crop: ${srcW}×${srcH}  →  Output: ${OUTPUT_W}×${OUTPUT_H}`;
  }
}

function _initCrop() {
  const cw = cropContainer.offsetWidth;
  const ch = cropContainer.offsetHeight;
  let rw = cw, rh = cw / ASPECT;
  if (rh > ch) { rh = ch; rw = ch * ASPECT; }
  rw *= 0.9; rh *= 0.9;
  crop.w = Math.round(rw);
  crop.h = Math.round(rh);
  crop.x = Math.round((cw - crop.w) / 2);
  crop.y = Math.round((ch - crop.h) / 2);
  _updateDims();
}

function _clampCrop() {
  const cw = cropContainer.offsetWidth;
  const ch = cropContainer.offsetHeight;
  crop.w = Math.max(60, Math.min(cw, crop.w));
  crop.h = Math.round(crop.w / ASPECT);
  if (crop.h > ch) { crop.h = ch; crop.w = Math.round(crop.h * ASPECT); }
  crop.x = Math.max(0, Math.min(cw - crop.w, crop.x));
  crop.y = Math.max(0, Math.min(ch - crop.h, crop.y));
}

cropRect.addEventListener('mousedown', (e) => {
  if (e.target.classList.contains('crop-handle')) return;
  e.preventDefault();
  dragState = { type: 'move', startX: e.clientX, startY: e.clientY, origCrop: { ...crop } };
});

cropContainer.querySelectorAll('.crop-handle').forEach((h) => {
  h.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragState = { type: 'resize', handle: h.dataset.handle,
                  startX: e.clientX, startY: e.clientY, origCrop: { ...crop } };
  });
});

document.addEventListener('mousemove', (e) => {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  const oc = dragState.origCrop;

  if (dragState.type === 'move') {
    crop.x = oc.x + dx;
    crop.y = oc.y + dy;
    crop.w = oc.w;
    crop.h = oc.h;
    _clampCrop();
  } else if (dragState.type === 'resize') {
    const h = dragState.handle;
    if (h === 'br') {
      crop.w = Math.max(60, oc.w + dx);
      crop.h = Math.round(crop.w / ASPECT);
      crop.x = oc.x; crop.y = oc.y;
    } else if (h === 'bl') {
      crop.w = Math.max(60, oc.w - dx);
      crop.h = Math.round(crop.w / ASPECT);
      crop.x = oc.x + oc.w - crop.w;
      crop.y = oc.y;
    } else if (h === 'tr') {
      crop.w = Math.max(60, oc.w + dx);
      crop.h = Math.round(crop.w / ASPECT);
      crop.x = oc.x;
      crop.y = oc.y + oc.h - crop.h;
    } else if (h === 'tl') {
      crop.w = Math.max(60, oc.w - dx);
      crop.h = Math.round(crop.w / ASPECT);
      crop.x = oc.x + oc.w - crop.w;
      crop.y = oc.y + oc.h - crop.h;
    }
    _clampCrop();
  }
  _updateDims();
});

document.addEventListener('mouseup', () => { dragState = null; });

btnBgUpload.addEventListener('click', async () => {
  if (!window.peace) return;
  const result = await window.peace.pickImage();
  if (result.success && result.dataUrl) {
    const img = new Image();
    img.onload = () => {
      pendingImg = img;
      previewImg.src = result.dataUrl;
      previewOverlay.classList.remove('bg-preview-hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => _initCrop()));
    };
    img.src = result.dataUrl;
  }
});

previewConfirm.addEventListener('click', () => {
  if (!pendingImg) return;
  const scaleX = pendingImg.naturalWidth / cropContainer.offsetWidth;
  const scaleY = pendingImg.naturalHeight / cropContainer.offsetHeight;
  const sx = Math.round(crop.x * scaleX);
  const sy = Math.round(crop.y * scaleY);
  const sw = Math.round(crop.w * scaleX);
  const sh = Math.round(crop.h * scaleY);

  const offscreen = document.createElement('canvas');
  offscreen.width  = OUTPUT_W;
  offscreen.height = OUTPUT_H;
  const ctx = offscreen.getContext('2d');
  ctx.drawImage(pendingImg, sx, sy, sw, sh, 0, 0, OUTPUT_W, OUTPUT_H);
  const croppedUrl = offscreen.toDataURL('image/jpeg', 0.92);

  renderer.updateTexture(rainBgTexture, croppedUrl, true);
  btnBgUpload.style.color = 'rgba(120, 255, 180, 0.7)';
  btnBgUpload.textContent = 'Updated!';
  setTimeout(() => {
    btnBgUpload.style.color = '';
    btnBgUpload.textContent = 'Upload BG';
  }, 1200);

  pendingImg = null;
  previewOverlay.classList.add('bg-preview-hidden');
});

previewCancel.addEventListener('click', () => {
  pendingImg = null;
  previewOverlay.classList.add('bg-preview-hidden');
});

// Initial visibility
_updateCtrlVisibility();

// ═══════════════════════════════════════════════════════════════════════
// Keyboard shortcuts
// ═══════════════════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (window.peace) window.peace.quitApp();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    btnSave.click();
  }
});
