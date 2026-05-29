/**
 * Root-vitest config. Vi har inget separat dashboard-vitest-projekt
 * — root-vitest plockar upp alla .test.ts under repo:t (default-glob),
 * inklusive dashboard/. Här fixar vi bara `@/*`-alias så att Next.js-
 * koden i dashboard/ kan importeras från test-filer på samma sätt
 * som under `next build`.
 */
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'dashboard'),
    },
  },
});
