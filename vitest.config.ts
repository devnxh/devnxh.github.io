import { defineConfig } from 'vitest/config';

// The Obsidian pipeline is plain TypeScript with no Astro runtime, so the tests
// run in Node without loading the Astro config.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
