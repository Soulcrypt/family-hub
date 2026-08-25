import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
    exclude: ["node_modules", ".next", "tests/e2e"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
