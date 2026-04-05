/**
 * Zen Timer — circular ring countdown with customizable duration.
 * - Click ring to start/pause (play/pause icon switch)
 * - Double-click or right-click ring to reset
 * - +/- buttons adjust time by 5 min increments
 * - If subtracting would go ≤ 0, triggers completion pulse
 * - SVG ring progressively depletes as time runs down
 * - Glows softly when time is up
 */

class Pomodoro {
  constructor(displayEl, containerEl, groupEl, defaultMinutes = 5) {
    this.display = displayEl;
    this.container = containerEl;   // the #pomodoro ring div
    this.group = groupEl;           // the #pomodoro-group wrapper
    this.defaultSeconds = defaultMinutes * 60;
    this.remaining = this.defaultSeconds;
    this.running = false;
    this.intervalId = null;

    this.iconPlay = document.getElementById('icon-play');
    this.iconPause = document.getElementById('icon-pause');
    this.ringProgress = document.getElementById('ring-progress');

    // SVG circle circumference: 2 * π * r (r=35)
    this.circumference = 2 * Math.PI * 35; // ≈ 219.91

    this._bindEvents();
    this._render();
    this._updateIcon();
    this._updateRing();
  }

  _bindEvents() {
    this.container.addEventListener('click', () => {
      if (this.remaining <= 0) {
        this.reset();
        return;
      }
      this.running ? this.pause() : this.start();
    });

    this.container.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.reset();
    });

    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.reset();
    });
  }

  setDuration(minutes) {
    this.defaultSeconds = Math.max(1, Math.floor(minutes)) * 60;
    this.reset();
  }

  /**
   * Adjust remaining time by `deltaSec` seconds.
   * If the result would be ≤ 0, immediately trigger completion.
   * Also updates the total duration to keep the ring proportional.
   */
  adjustTime(deltaSec) {
    const newRemaining = this.remaining + deltaSec;

    if (newRemaining <= 0) {
      // Trigger completion immediately
      this.remaining = 0;
      this.defaultSeconds = Math.max(this.defaultSeconds, 1);
      this._render();
      this._updateRing();
      if (this.running) this.pause();
      this._onComplete();
      return;
    }

    this.remaining = newRemaining;
    // Also shift the total so the ring stays proportional
    this.defaultSeconds += deltaSec;
    if (this.defaultSeconds < 1) this.defaultSeconds = newRemaining;

    this._render();
    this._updateRing();
  }

  start() {
    if (this.running || this.remaining <= 0) return;
    this.running = true;
    this.group.classList.remove('glowing');
    this.group.classList.add('running');
    this._updateIcon();

    this.intervalId = setInterval(() => {
      this.remaining--;
      this._render();
      this._updateRing();

      if (this.remaining <= 0) {
        this.pause();
        this._onComplete();
      }
    }, 1000);
  }

  pause() {
    this.running = false;
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.group.classList.remove('running');
    this._updateIcon();
  }

  reset() {
    this.pause();
    this.remaining = this.defaultSeconds;
    this.group.classList.remove('glowing');
    this.group.classList.remove('running');
    this._render();
    this._updateIcon();
    this._updateRing();
  }

  _onComplete() {
    this.group.classList.add('glowing');
    this._updateIcon();
  }

  _updateIcon() {
    if (this.iconPlay && this.iconPause) {
      if (this.running) {
        this.iconPlay.style.display = 'none';
        this.iconPause.style.display = '';
      } else {
        this.iconPlay.style.display = '';
        this.iconPause.style.display = 'none';
      }
    }
  }

  /**
   * Update SVG ring dashoffset to reflect remaining time.
   * Full ring = full time remaining, empty ring = 00:00.
   */
  _updateRing() {
    if (!this.ringProgress) return;
    const progress = this.defaultSeconds > 0
      ? this.remaining / this.defaultSeconds
      : 0;
    const offset = this.circumference * (1 - progress);
    this.ringProgress.setAttribute('stroke-dashoffset', offset);
  }

  _render() {
    const m = Math.floor(this.remaining / 60);
    const s = this.remaining % 60;
    this.display.textContent =
      String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
}

export { Pomodoro };
