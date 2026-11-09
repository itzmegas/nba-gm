import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    // Prototype checks use node:test; their standalone commands are in tests/README.md.
    exclude: [...configDefaults.exclude, "docs/NBA-Franchise-Management-Redesign/tests/**"],
  },
});
