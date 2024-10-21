import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/hook.ts", "src/exports/*.ts"],
  format: "esm",
  target: "node20",
  outDir: "dist",
  clean: true,
  dts: true,
  splitting: true,
  sourcemap: true,
  define: {
    "import.meta.vitest": "undefined",
  },
});
