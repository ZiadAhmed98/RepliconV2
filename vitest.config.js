import { defineConfig } from 'vitest/config';

// Standalone config (does not load vite.config.js, so the React plugin isn't
// pulled into these Node-side unit tests).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
