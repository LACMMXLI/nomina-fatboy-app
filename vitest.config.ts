import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: { reporter: ["text", "html"], include: ["src/lib/**/*.ts", "src/server/payroll.ts"] },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
