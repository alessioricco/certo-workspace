import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const levelsDir = resolve(__dirname, 'levels');

// Levels are data read at runtime by URL, so they are copied next to the build output.
const copyLevels: Plugin = {
  name: 'copy-levels',
  apply: 'build',
  closeBundle() {
    cpSync(levelsDir, resolve(__dirname, 'dist', 'levels'), { recursive: true });
  },
};

export default defineConfig({
  plugins: [copyLevels],
  // Three.js with its glTF loader is about 680 kB minified, so the default 500 kB warning is noise.
  build: { chunkSizeWarningLimit: 750 },
});
