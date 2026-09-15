import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mismo alias que tsconfig ("@/*" → "./src/*"); vitest no lee tsconfig.
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" solo es un no-op bajo la condition "react-server" que
      // arma Next; en Vitest (Node puro) su export default hace throw
      // siempre. Ver test/server-only-stub.ts.
      "server-only": path.resolve(import.meta.dirname, "test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
