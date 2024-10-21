import { defineConfig } from "vite";
import comptime from "unplugin-comptime/vite";

export default defineConfig({
  plugins: [comptime()],
});
