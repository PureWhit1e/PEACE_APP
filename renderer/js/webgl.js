/**
 * WebGL Renderer — multi-pass pipeline for Shadertoy-style shaders.
 *
 * Supports:
 * - Single-pass shaders (Seascape)
 * - Multi-pass shaders with framebuffers (Rain/Heartfelt: BufferA → Image)
 * - Texture loading for iChannel inputs
 * - Standard Shadertoy uniforms: iTime, iResolution, iMouse, iFrame
 * - Custom uniforms per mode
 */

class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!this.gl) {
      console.error('WebGL2 not supported, falling back to WebGL1');
      this.gl = canvas.getContext('webgl');
    }
    if (!this.gl) {
      console.error('WebGL not available');
      return;
    }

    this.modes = {};           // { name: ModeConfig }
    this.activeMode = null;
    this.startTime = Date.now();
    this.frameCount = 0;
    this.mouse = [0, 0, 0, 0]; // iMouse: xy = current, zw = click

    this._resize();
    window.addEventListener('resize', () => this._resize());

    // Mouse tracking for iMouse
    canvas.addEventListener('mousemove', (e) => {
      this.mouse[0] = e.clientX * (window.devicePixelRatio || 1);
      this.mouse[1] = (window.innerHeight - e.clientY) * (window.devicePixelRatio || 1);
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse[2] = e.clientX * (window.devicePixelRatio || 1);
      this.mouse[3] = (window.innerHeight - e.clientY) * (window.devicePixelRatio || 1);
    });
    canvas.addEventListener('mouseup', () => {
      this.mouse[2] = 0;
      this.mouse[3] = 0;
    });
  }

  // ── Resize ──────────────────────────────────────────────────────────────
  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    // Rebuild framebuffers at new resolution
    this._rebuildFramebuffers();
  }

  // ── Shader Compilation ──────────────────────────────────────────────────
  _compileShader(type, src) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  _createProgram(vertSrc, fragSrc) {
    const gl = this.gl;
    const vert = this._compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this._compileShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) return null;

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

  // ── Fullscreen Triangle Vertex Shader (shared) ──────────────────────────
  static get VERT_FULLSCREEN() {
    return `#version 300 es
    void main() {
      vec2 pos = vec2(
        float((gl_VertexID & 1) << 2) - 1.0,
        float((gl_VertexID & 2) << 1) - 1.0
      );
      gl_Position = vec4(pos, 0.0, 1.0);
    }`;
  }

  // ── Framebuffer Management ──────────────────────────────────────────────
  _createFBO(width, height) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    const tex = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F || gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT || gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { fbo, texture: tex, width, height };
  }

  _rebuildFramebuffers() {
    const gl = this.gl;
    if (!gl) return;

    for (const name in this.modes) {
      const mode = this.modes[name];
      if (mode.passes && mode.passes.length > 1) {
        // Rebuild intermediate FBOs (all passes except last render to FBO)
        for (let i = 0; i < mode.passes.length - 1; i++) {
          if (mode.passes[i].fboData) {
            gl.deleteTexture(mode.passes[i].fboData.texture);
            gl.deleteFramebuffer(mode.passes[i].fboData.fbo);
          }
          mode.passes[i].fboData = this._createFBO(this.canvas.width, this.canvas.height);
        }
      }
    }
  }

  // ── Texture Loading ─────────────────────────────────────────────────────
  /**
   * Load a texture from URL or data URL.
   * @param {string} url - image URL or base64 data URL
   * @param {boolean} mipmap - generate mipmaps (required for textureLod)
   * @returns {WebGLTexture}
   */
  loadTexture(url, mipmap = false) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // 1x1 dark placeholder while loading
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 20, 255]));

    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (mipmap) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    img.src = url;
    return tex;
  }

  /**
   * Update an existing texture with a new image (e.g. user-uploaded background).
   */
  updateTexture(tex, url, mipmap = false) {
    const gl = this.gl;
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (mipmap) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      }
    };
    img.src = url;
  }

  // ── Register a Mode ─────────────────────────────────────────────────────
  /**
   * Register a shader mode.
   *
   * For single-pass:
   *   registerMode('sea', { fragSrc: '...' })
   *
   * For multi-pass:
   *   registerMode('rain', {
   *     passes: [
   *       { fragSrc: '...bufferA...', inputs: { iChannel0: 'self' } },
   *       { fragSrc: '...image...', inputs: { iChannel0: 0, iChannel1: texObj } },
   *     ]
   *   })
   */
  registerMode(name, config) {
    const gl = this.gl;
    const vertSrc = config.vertSrc || WebGLRenderer.VERT_FULLSCREEN;

    if (config.fragSrc) {
      // Single-pass mode
      const program = this._createProgram(vertSrc, config.fragSrc);
      if (!program) return;
      this.modes[name] = {
        passes: [{ program, uniforms: {}, inputs: config.inputs || {} }],
        customUniforms: config.customUniforms || {},
      };
    } else if (config.passes) {
      // Multi-pass mode
      const passes = config.passes.map((passConfig) => {
        const program = this._createProgram(vertSrc, passConfig.fragSrc);
        return {
          program,
          uniforms: {},
          inputs: passConfig.inputs || {},
          fboData: null, // created in _rebuildFramebuffers
        };
      });
      this.modes[name] = { passes, customUniforms: config.customUniforms || {} };
      this._rebuildFramebuffers();
    }
  }

  // ── Set Active Mode ─────────────────────────────────────────────────────
  setMode(name) {
    if (this.modes[name]) {
      this.activeMode = name;
    }
  }

  // ── Dynamic Uniform Update ──────────────────────────────────────────────
  /**
   * Set a custom uniform value for a mode at runtime.
   * @param {string} modeName - the registered mode name
   * @param {string} uniformName - GLSL uniform name (e.g. 'uRainAmount')
   * @param {number|number[]} value - float or vec (array)
   */
  setUniform(modeName, uniformName, value) {
    const mode = this.modes[modeName];
    if (!mode) return;
    mode.customUniforms[uniformName] = value;
  }

  // ── Get Uniform Location (cached) ──────────────────────────────────────
  _getUniform(pass, name) {
    if (!pass.uniforms[name]) {
      pass.uniforms[name] = this.gl.getUniformLocation(pass.program, name);
    }
    return pass.uniforms[name];
  }

  // ── Set Standard Shadertoy Uniforms ────────────────────────────────────
  _setStandardUniforms(pass, time) {
    const gl = this.gl;
    const loc = (n) => this._getUniform(pass, n);

    const t = loc('iTime');
    if (t) gl.uniform1f(t, time);

    const r = loc('iResolution');
    if (r) gl.uniform3f(r, this.canvas.width, this.canvas.height, 1.0);

    const m = loc('iMouse');
    if (m) gl.uniform4f(m, ...this.mouse);

    const f = loc('iFrame');
    if (f) gl.uniform1i(f, this.frameCount);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  render() {
    const gl = this.gl;
    const mode = this.modes[this.activeMode];
    if (!mode) return;

    const time = (Date.now() - this.startTime) / 1000.0;

    for (let i = 0; i < mode.passes.length; i++) {
      const pass = mode.passes[i];
      if (!pass.program) continue;

      const isLast = i === mode.passes.length - 1;

      // Bind FBO (or screen for last pass)
      if (!isLast && pass.fboData) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, pass.fboData.fbo);
        gl.viewport(0, 0, pass.fboData.width, pass.fboData.height);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      }

      gl.useProgram(pass.program);
      this._setStandardUniforms(pass, time);

      // Bind texture inputs
      let texUnit = 0;
      for (const channelName in pass.inputs) {
        const input = pass.inputs[channelName];
        const loc = this._getUniform(pass, channelName);
        if (!loc) continue;

        let tex = null;
        if (input === 'self' && pass.fboData) {
          // Self-feedback (buffer reads its own previous output)
          tex = pass.fboData.texture;
        } else if (typeof input === 'number') {
          // Reference to another pass's output
          const srcPass = mode.passes[input];
          if (srcPass && srcPass.fboData) tex = srcPass.fboData.texture;
        } else if (input instanceof WebGLTexture) {
          tex = input;
        }

        if (tex) {
          gl.activeTexture(gl.TEXTURE0 + texUnit);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.uniform1i(loc, texUnit);
          texUnit++;
        }
      }

      // Set custom uniforms
      for (const uName in mode.customUniforms) {
        const uLoc = this._getUniform(pass, uName);
        const uVal = mode.customUniforms[uName];
        if (uLoc && typeof uVal === 'number') {
          gl.uniform1f(uLoc, uVal);
        }
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    this.frameCount++;
  }

  // ── Animation Loop ──────────────────────────────────────────────────────
  start() {
    const loop = () => {
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

export { WebGLRenderer };
