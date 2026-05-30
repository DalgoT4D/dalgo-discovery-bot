import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['dotenv/config'],
    coverage: { reporter: ['text', 'html'] },
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    // Run test files one at a time. These are integration tests against a single
    // shared Postgres with global state (eval_cases.enabled toggling, the
    // dalgo_eval_runs queue + global claim), so parallel files race. Trades
    // full-run speed for correctness; revisit with per-worker DB isolation if needed.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
