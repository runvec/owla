import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import "dotenv/config";
export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"], testTimeout: 30000, hookTimeout: 30000, fileParallelism: false },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});