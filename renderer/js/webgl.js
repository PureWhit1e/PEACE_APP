/**
 * WebGL renderer — manages shader compilation, multi-pass rendering,
 * and uniform updates. Phase 2 will populate the actual shaders.
 */

class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!this.gl) {
      console.error('WebGL not supported');
      return;
    }

    this.programs = {};      // { 'rain': program, 'sea': program }
    this.framebuffers = {};  // For multi-pass (rain shader)
    this.textures = {};
    this.activeMode = 'rain';
    this.startTime = Date.now();
    this.uniforms = {};      // Cached uniform locations

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Compile a vertex + fragment shader pair, return a WebGL program.
   */
  compileShader(vertSrc, fragSrc) {
    const gl = this.gl;

    const vert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vert, vertSrc);
    gl.compileShader(vert);
    if (!gl.getShaderInfoLog(vert) === '') {
      const log = gl.getShaderInfoLog(vert);
      if (log) console.warn('Vertex shader:', log);
    }

    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frag, fragSrc);
    gl.compileShader(frag);
    if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(frag));
      return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  }

  /**
   * Register a shader program under a mode name.
   */
  registerMode(name, vertSrc, fragSrc) {
    const program = this.compileShader(vertSrc, fragSrc);
    if (program) {
      this.programs[name] = program;
      this.uniforms[name] = {};
    }
    return program;
  }

  /**
   * Cache and return a uniform location.
   */
  getUniform(mode, name) {
    if (!this.uniforms[mode][name]) {
      this.uniforms[mode][name] = this.gl.getUniformLocation(
        this.programs[mode],
        name,
      );
    }
    return this.uniforms[mode][name];
  }

  /**
   * Set the active background mode.
   */
  setMode(mode) {
    if (this.programs[mode]) {
      this.activeMode = mode;
    }
  }

  /**
   * Main render loop — called every frame via requestAnimationFrame.
   * Phase 2+ will expand this with multi-pass logic for rain.
   */
  render() {
    const gl = this.gl;
    const program = this.programs[this.activeMode];
    if (!program) return;

    gl.useProgram(program);

    // Standard Shadertoy-style uniforms
    const time = (Date.now() - this.startTime) / 1000.0;
    const timeLoc = this.getUniform(this.activeMode, 'iTime');
    const resLoc = this.getUniform(this.activeMode, 'iResolution');

    if (timeLoc) gl.uniform1f(timeLoc, time);
    if (resLoc) gl.uniform3f(resLoc, this.canvas.width, this.canvas.height, 1.0);

    // Fullscreen triangle (no geometry buffer needed)
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Start the animation loop.
   */
  start() {
    const loop = () => {
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// Export for use in app.js
window.WebGLRenderer = WebGLRenderer;
