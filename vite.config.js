import { defineConfig } from 'vite';
import path from 'path';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';

// Plugin to copy BG/ and music/ into dist/renderer after build
function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist/renderer');
      // Copy BG folder
      const bgSrc = path.resolve(__dirname, 'BG');
      const bgDst = path.resolve(distDir, '..', 'BG');
      try {
        mkdirSync(bgDst, { recursive: true });
        for (const f of readdirSync(bgSrc)) {
          copyFileSync(path.join(bgSrc, f), path.join(bgDst, f));
        }
      } catch {}
      // Copy music folder
      const musSrc = path.resolve(__dirname, 'music');
      const musDst = path.resolve(distDir, '..', 'music');
      try {
        mkdirSync(musDst, { recursive: true });
        for (const f of readdirSync(musSrc)) {
          copyFileSync(path.join(musSrc, f), path.join(musDst, f));
        }
      } catch {}
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname, 'renderer'),
  base: './',
  plugins: [copyAssetsPlugin()],
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'renderer/index.html'),
    },
  },
  server: {
    port: 5173,
    // Allow serving files from parent dir (BG/, music/)
    fs: {
      allow: [path.resolve(__dirname)],
    },
  },
});
