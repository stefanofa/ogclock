import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/worker/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "ogclock",
		compatibilityDate: "2026-10-19",
		entrypoint,
		observability: { enabled: true },
		/**
		 * Vite's client build (index.html, hashed /assets/*, public/) is the asset set. Paths
		 * without an asset fall through to the Worker. "/" would match index.html, so the Worker
		 * runs first there and personalises the shell it reads back through ASSETS.
		 */
		assets: { runWorkerFirst: ["/"] },
		env: { ASSETS: bindings.assets() },
	},
});
