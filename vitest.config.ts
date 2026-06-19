import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so the userscript (vite-plugin-monkey) build
// pipeline doesn't run during tests — these tests operate on the already-built
// artifact and on the GitHub release, not on the bundler output.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
