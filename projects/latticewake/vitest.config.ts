import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.{ts,mjs}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/render/viewport.ts', 'src/engine/**/*.ts', 'src/math/**/*.ts', 'src/game/**/*.ts', 'src/render/starfield.ts', 'src/input/**/*.ts', 'src/audio/patches.ts', 'src/audio/dispatch.ts', 'src/render/feedback.ts', 'src/platform/storage.ts', 'src/platform/diagnostics.ts', 'src/ui/strings.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
