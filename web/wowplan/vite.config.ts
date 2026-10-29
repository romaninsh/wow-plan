import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { skillZips } from "./skill-zip.mjs";

export default defineConfig({
  plugins: [react(), skillZips()],
  test: { environment: "jsdom", setupFiles: ["test/setup.ts"] },
});
