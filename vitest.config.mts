import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    // Le tally exhaustif (63 756 combinaisons) et le procès du plugin dépassaient 5 s sur une machine chargée (CI comprise).
    testTimeout: 60_000,
  },
});
