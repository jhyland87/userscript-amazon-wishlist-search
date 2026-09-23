import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so the userscript (vite-plugin-monkey) build
// pipeline doesn't run during tests — these tests operate on the already-built
// artifact and on the GitHub release, not on the bundler output.
export default defineConfig({
  resolve: {
    alias: [
      // The GM client reads userscript-manager globals at import time; swap in
      // an in-memory fake under Node.
      {
        find: /^vite-plugin-monkey\/dist\/client$/,
        replacement: fileURLToPath(new URL('./test/gm-stub.ts', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
