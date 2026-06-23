import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Next.js's bundler special-cases "server-only" at build time; the real
      // package throws unconditionally when actually executed, which vitest
      // would otherwise do for any test that transitively imports a
      // server-only-marked module. See test/shims/server-only.ts.
      "server-only": path.resolve(__dirname, "test/shims/server-only.ts"),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
