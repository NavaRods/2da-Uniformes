import { defineConfig } from "vitest/config";

// Pruebas de firestore.rules contra el emulador (necesita Java).
// Se corren con: npm run test:rules
export default defineConfig({
  test: {
    environment: "node",
    include: ["rules-tests/**/*.test.js"],
    // Un solo archivo a la vez: comparten el mismo emulador.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
