# Peace App — Development Handoff Report

## What is Peace

Peace is an immersive, distraction-free writing desktop app built with **Electron + Vite + TipTap + WebGL**. It features dynamic weather shader backgrounds (rain/seascape), a frosted-glass Notion-like block editor, ambient audio crossfade, a burn-after-reading particle effect, and a pomodoro timer. All UI follows a "Cyber Zen ghost" design: near-invisible at rest, elegant fade-in on hover.

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop shell | Electron 33 (frameless window, IPC, preload bridge) |
| Build tool | Vite 6 (root: `renderer/`, output: `dist/renderer/`) |
| Editor | TipTap 2.11 (ProseMirror-based block editor) |
| Backgrounds | WebGL2 / GLSL 300 es — Heartfelt rain shader + Seascape shader |
| Audio | HTML5 `<audio>` with JS crossfade (1.5s fade between rain/sea) |
| Burn effect | Canvas 2D particle system (fire/ash, left-to-right per-line dissolving) |
| Packaging | electron-builder (NSIS .exe for Windows) |
| Export | HTML or Markdown (turndown) |

## Project Structure

```
peace_app/
├── main.js            # Electron main process (dev: Vite at :5173, prod: dist/renderer/)
├── preload.js         # contextBridge: saveFile, pickImage, pickVideo, window controls
├── vite.config.js     # Vite config + copyAssetsPlugin for BG/ & music/
├── package.json       # All deps listed, scripts: dev / build:web / build
├── BG/                # Background images (default.jpg used for rain shader)
├── music/             # rain_ambient.mp3, sea_ambient_mp3.mp3
└── renderer/
    ├── index.html     # Single HTML — all layers, toolbar, audio tags, module script
    ├── css/main.css   # Full Cyber Zen ghost UI + TipTap/ProseMirror styles
    ├── js/
    │   ├── app.js     # Main entry (ES module) — wires everything together
    │   ├── editor.js  # TipTap setup: StarterKit, ResizableImage, VideoBlock, Color, TaskList, export
    │   ├── webgl.js   # WebGLRenderer class: multi-pass pipeline, texture management
    │   ├── pomodoro.js # Zen Timer: SVG ring countdown, +/-5min adjust
    │   └── burn.js    # BurnEffect: fire/ash left-to-right dissolving canvas particles
    └── shaders/
        ├── rain.frag.glsl      # Heartfelt rain (3 uniforms: uRainAmount, uFogAmount, uRefraction)
        └── seascape.frag.glsl  # TDM Seascape (3 uniforms: uWaveHeight, uRotateSpeed, uHorizon)
```

## Features Implemented

1. **WebGL rain shader** — ported from Shadertoy Heartfelt, with custom uniforms for rain amount, fog, refraction. User-uploadable background image with 16:9 crop tool (2560x1440 output). Default: `BG/default.jpg`.
2. **WebGL seascape shader** — ported from Shadertoy, with wave height, rotation speed, horizon controls. No mouse-driven camera.
3. **TipTap block editor** — paragraphs, headings (H1-H3), bold, italic, resizable images (drag handles), video blocks, task lists, horizontal rules. Placeholder text.
4. **Ghost toolbar** — font family (Klee/Serif/Sans/Mono), font size (小/中/大), color picker (12-color palette via TipTap Color extension), H1-H3, B, I, task list, divider, image, video buttons.
5. **Export** — HTML (full standalone page) or Markdown (via turndown). Format selector next to Save button.
6. **Ambient audio** — `rain_ambient.mp3` for rain mode, `sea_ambient_mp3.mp3` for sea mode. Smooth 1.5s crossfade on mode switch. Volume slider in bottom Vibe Mixer panel.
7. **Burn after reading** — fire/ash particle effect, sequential left-to-right per-line dissolving. Clears editor content and localStorage after burn.
8. **Pomodoro timer** — SVG ring countdown, default 5 min, +/- 5min buttons, glow on completion.
9. **Frosted glass container** — blur + alpha controlled by slider. CSS custom properties.
10. **Frameless window** — custom titlebar, drag region on bg-canvas, window controls (min/max/close).
11. **LocalStorage auto-save** — debounced 300ms, saves editor HTML content + font/size/mode/blur/volume prefs.
12. **Dual deployment** — `npm run build:web` for Vercel (static), `npm run build` for Electron .exe.

## Completed Migration (most recent session)

The app was migrated from a plain textarea + IIFE scripts to:
- **Vite** build system (ES modules, HMR in dev)
- **TipTap** block editor replacing textarea
- All JS files converted to ES modules (`export`/`import`)
- Font/size picker moved from standalone panel into editor toolbar
- Color picker added (TipTap TextStyle + Color extensions)

## Known Issue to Debug

### Default background image (`BG/default.jpg`) not displaying in rain mode

**What should happen:** Rain shader uses `BG/default.jpg` as `iChannel0` texture — raindrops refract through this background image.

**What actually happens:** Background does not appear (likely just dark gradient or no texture).

**Where to look:**
- `renderer/js/app.js` line ~60: `renderer.loadTexture('../BG/default.jpg', true)` — this `../BG/` path is relative to the renderer/ folder. In Vite dev mode, the dev server root is `renderer/`, so `../BG/` means going one level up to `peace_app/BG/`.
- `vite.config.js` has `server.fs.allow: [path.resolve(__dirname)]` which should allow serving the parent directory. **Verify this is actually working** — check browser console for 403/404 errors on the texture fetch.
- The `loadTexture` method in `webgl.js` creates an `Image()` object and sets `img.src = url`. If Vite rewrites or blocks the path, the image won't load.
- Possible fix approaches:
  1. Move `BG/` into `renderer/` so it's within Vite's root (simplest)
  2. Symlink `renderer/BG -> ../BG`
  3. Use Vite's `publicDir` option pointing to the parent
  4. In the build plugin, also copy BG into `dist/renderer/BG/` and use a relative path without `../`

### Ambient audio (rain/sea) not playing

**What should happen:** On first user interaction, `rain_ambient.mp3` plays and loops. Switching to sea mode crossfades to `sea_ambient_mp3.mp3`.

**What actually happens:** No audio plays.

**Where to look:**
- `renderer/index.html` lines ~201-202: `<audio src="../music/rain_ambient.mp3">` — same `../` path issue as the background image.
- `renderer/js/app.js` lines ~334-340: `audioRain = document.getElementById('audio-rain')` and `audioSea = document.getElementById('audio-sea')`. Check if these elements exist and if their `src` resolved correctly.
- Check browser console for failed audio loads (404/403).
- Same fix approaches as above — either move `music/` into `renderer/` or fix the serving config.

### Recommended debugging steps:
1. Run `npm run dev`, open DevTools (uncomment `mainWindow.webContents.openDevTools()` in `main.js`)
2. Check Console for 404/403 errors on `../BG/default.jpg` and `../music/*.mp3`
3. Check Network tab — are these resources being requested and blocked?
4. If Vite's `fs.allow` isn't working, the simplest fix is to create symlinks or move the assets into the `renderer/` folder

## How to Run

```bash
# Install dependencies (must run first)
npm install

# Development (Vite HMR + Electron)
npm run dev

# Build for web (Vercel deployment)
npm run build:web
# Output: dist/renderer/

# Build .exe
npm run build
# Output: release/
```

## User Preferences

- **Always discuss the plan before major changes** — the user wants to review before you start coding
- **Step-by-step workflow** — analyze requirements → confirm plan → develop → test
- Chinese is the primary communication language with the user
