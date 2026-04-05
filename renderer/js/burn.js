/**
 * Burn & Ash Dispersal Effect — "阅后即焚"
 *
 * Text ignites character-by-character, left to right, line by line.
 * Each character burns white → orange → ember, then drifts upward
 * as grey ash with wind turbulence.
 * Pacing is deliberately slow and contemplative.
 */

class BurnEffect {
  constructor(overlayCanvas) {
    this.canvas = overlayCanvas;
    this.ctx = overlayCanvas.getContext('2d');
    this.particles = [];
    this.running = false;
    this.animId = null;
  }

  ignite(editor, onComplete) {
    if (this.running) return;
    this.running = true;

    const rect = editor.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const style = getComputedStyle(editor);
    const scrollTop = editor.scrollTop;

    // ── Size overlay canvas ─────────────────────────────────────────────
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ── Render text onto offscreen canvas ────────────────────────────────
    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d');
    offscreen.width = rect.width * dpr;
    offscreen.height = rect.height * dpr;
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    offCtx.font = style.font || `${style.fontSize} ${style.fontFamily}`;
    offCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    offCtx.textBaseline = 'top';

    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const maxWidth = rect.width - paddingLeft - paddingRight;
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.8;

    const paragraphs = editor.value.split('\n');
    let cursorY = paddingTop - scrollTop;
    let lineIndex = 0;
    const lineMap = [];

    for (const para of paragraphs) {
      if (para === '') {
        lineMap.push({ yStart: cursorY, yEnd: cursorY + lineHeight, lineIdx: lineIndex });
        cursorY += lineHeight;
        lineIndex++;
        continue;
      }
      const wrappedLines = this._wrapText(offCtx, para, maxWidth);
      for (const line of wrappedLines) {
        if (cursorY + lineHeight > 0 && cursorY < rect.height) {
          offCtx.fillText(line, paddingLeft, cursorY);
        }
        lineMap.push({ yStart: cursorY, yEnd: cursorY + lineHeight, lineIdx: lineIndex });
        cursorY += lineHeight;
        lineIndex++;
      }
    }

    // ── Sample pixels → particles ───────────────────────────────────────
    const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imageData.data;
    const step = Math.max(2, Math.floor(3 / dpr));

    this.particles = [];

    // ── Timing: very slow, deliberate left-to-right, line-by-line ───────
    // Each line waits ~100 frames after the previous line starts.
    // Within a line, left-most chars start first, right-most ~60 frames later.
    const LINE_DELAY   = 100;      // frames between start of consecutive lines
    const LINE_SPREAD  = 60;       // frames spread across one line (left→right)
    const JITTER       = 12;       // random jitter per particle

    for (let y = 0; y < offscreen.height; y += step) {
      for (let x = 0; x < offscreen.width; x += step) {
        const idx = (y * offscreen.width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > 30) {
          const px = x / dpr;
          const py = y / dpr;

          // Which line?
          let thisLine = 0;
          for (const lm of lineMap) {
            if (py >= lm.yStart && py < lm.yEnd) {
              thisLine = lm.lineIdx;
              break;
            }
          }

          // Left-to-right position within line (0→1)
          const xNorm = Math.max(0, Math.min(1, (px - paddingLeft) / maxWidth));

          const delay = thisLine * LINE_DELAY
                      + xNorm * LINE_SPREAD
                      + Math.random() * JITTER;

          this.particles.push({
            x: rect.left + px,
            y: rect.top + py,
            origAlpha: alpha / 255,
            // Ash drift velocity (slow)
            vx: (Math.random() - 0.5) * 0.4,
            vy: -Math.random() * 0.8 - 0.2,
            size: Math.random() * 2.5 + 1,
            // Life & decay (slow)
            life: 1.0,
            decay: Math.random() * 0.004 + 0.002,
            delay: delay,
            phase: 'waiting',
            // Burn phase duration (slow)
            burnFrames: Math.random() * 30 + 25,
            burnTimer: 0,
            // Turbulence
            turbFreq: Math.random() * 0.02 + 0.01,
            turbAmp: Math.random() * 1.5 + 0.5,
            turbOffset: Math.random() * 100,
            windSens: Math.random() * 0.3 + 0.1,
          });
        }
      }
    }

    editor.style.visibility = 'hidden';

    this._tick = 0;
    this._onComplete = () => {
      this.running = false;
      editor.value = '';
      editor.style.visibility = 'visible';
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (onComplete) onComplete();
    };
    this._animate();
  }

  _wrapText(ctx, text, maxWidth) {
    const lines = [];
    let currentLine = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const testLine = currentLine + char;
      if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
  }

  _animate() {
    this._tick++;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    this.ctx.clearRect(0, 0, w, h);

    let alive = 0;
    const wind = Math.sin(this._tick * 0.012) * 0.5;

    for (const p of this.particles) {
      // ── Waiting: static text ──────────────────────────────────────
      if (p.phase === 'waiting') {
        p.delay--;
        if (p.delay <= 0) p.phase = 'burning';
        this.ctx.fillStyle = `rgba(255, 255, 255, ${p.origAlpha})`;
        this.ctx.fillRect(p.x, p.y, p.size, p.size);
        alive++;
        continue;
      }

      // ── Burning: white → orange → ember ───────────────────────────
      if (p.phase === 'burning') {
        p.burnTimer++;
        const t = p.burnTimer / p.burnFrames;   // 0→1

        const r = 255;
        const g = Math.floor(255 - t * 180);
        const b = Math.floor(200 - t * 200);
        const a = p.origAlpha * (1 - t * 0.15);

        // Slight upward drift + jitter during burn
        p.y -= 0.1;
        p.x += (Math.random() - 0.5) * 0.2;

        // Ember glow
        this.ctx.shadowColor = `rgba(255, ${g}, 0, ${0.5 * (1 - t)})`;
        this.ctx.shadowBlur = 3 + t * 3;
        this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        this.ctx.fillRect(p.x, p.y, p.size, p.size);
        this.ctx.shadowBlur = 0;
        this.ctx.shadowColor = 'transparent';

        if (t >= 1) p.phase = 'ash';
        alive++;
        continue;
      }

      // ── Ash: grey particles drifting upward with wind ─────────────
      if (p.phase === 'ash') {
        p.life -= p.decay;
        if (p.life <= 0) {
          p.phase = 'dead';
          continue;
        }

        const turb = Math.sin((this._tick + p.turbOffset) * p.turbFreq) * p.turbAmp;
        p.vx += wind * p.windSens * 0.04 + turb * 0.015;
        p.vy -= 0.015;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.996;
        p.vy *= 0.998;

        const ashProgress = 1 - p.life;
        const grey = Math.floor(80 + ashProgress * 60);
        const alpha = p.life * 0.6;
        const size = p.size * (0.4 + p.life * 0.6);

        this.ctx.fillStyle = `rgba(${grey}, ${grey - 10}, ${grey - 20}, ${alpha})`;
        this.ctx.fillRect(p.x, p.y, size, size);
        alive++;
      }
    }

    if (alive > 0) {
      this.animId = requestAnimationFrame(() => this._animate());
    } else {
      this._onComplete();
    }
  }

  cancel() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.running = false;
    this.particles = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

export { BurnEffect };
