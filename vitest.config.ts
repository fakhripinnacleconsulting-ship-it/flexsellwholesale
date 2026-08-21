import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Two projects, split by environment.
 *
 * Almost every suite here is server-side and runs in `node`. Exactly one — the React
 * component test — needs `jsdom`, and it used to declare that with a
 * `@vitest-environment jsdom` docblock inside a run configured for `node`.
 *
 * That made the runner tear down and rebuild an environment for a single file in the middle
 * of a pool otherwise busy importing mongoose models, and on a loaded machine that worker
 * could miss its response window entirely:
 *
 *     Error: [vitest-pool-runner]: Timeout waiting for worker to respond
 *     Test Files  25 passed (25)     ← 26 on disk; the jsdom file never reported
 *
 * A green summary that silently ran one file fewer is worse than a red one. Splitting by
 * project gives each environment its own pool, set up once, so there is no mid-run switch to
 * lose a worker to.
 *
 * The rule is by file extension: `.test.tsx` renders components and gets a DOM,
 * `.test.ts` does not. Adding a component test needs no configuration.
 */

const alias = { "@": path.resolve(__dirname, "./src") };

/** Shared by both projects. `projects` do not inherit root-level `test` options. */
const shared = {
  globals: true,
  env: {
    JWT_SECRET: "test-jwt-secret-key-signature-validation-10-10",
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          ...shared,
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          ...shared,
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
        },
      },
    ],
  },
  resolve: { alias },
});
