/**
 * Pomodoro timer with customizable duration.
 * - Click to start/pause
 * - Double-click to reset
 * - Glows softly when time is up
 */

class Pomodoro {
  constructor(displayEl, defaultMinutes = 25) {
    this.display = displayEl;
    this.defaultSeconds = defaultMinutes * 60;
    this.remaining = this.defaultSeconds;
    this.running = false;
    this.intervalId = null;

    this._bindEvents();
    this._render();
  }

  _bindEvents() {
    // Single click: start / pause
    this.display.addEventListener('click', () => {
      if (this.remaining <= 0) {
        this.reset();
        return;
      }
      this.running ? this.pause() : this.start();
    });

    // Double click: reset
    this.display.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.reset();
    });

    // Right click: reset
    this.display.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.reset();
    });
  }

  /**
   * Set a custom duration (in minutes).
   */
  setDuration(minutes) {
    this.defaultSeconds = Math.max(1, Math.floor(minutes)) * 60;
    this.reset();
  }

  start() {
    if (this.running || this.remaining <= 0) return;
    this.running = true;
    this.display.classList.remove('glowing');

    this.intervalId = setInterval(() => {
      this.remaining--;
      this._render();

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
  }

  reset() {
    this.pause();
    this.remaining = this.defaultSeconds;
    this.display.classList.remove('glowing');
    this._render();
  }

  _onComplete() {
    this.display.classList.add('glowing');
  }

  _render() {
    const m = Math.floor(this.remaining / 60);
    const s = this.remaining % 60;
    this.display.textContent =
      String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
}

window.Pomodoro = Pomodoro;
