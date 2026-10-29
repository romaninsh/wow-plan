import type { Plugin } from "vite";

/** Emits agent-skills/<name>.zip for every folder under `publicDir`/agent-skills/. */
export function skillZips(publicDir?: string): Plugin;
