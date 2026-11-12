/** Module types the Cloudflare Vite plugin imports natively. */

declare module "*.wasm" {
	const module: WebAssembly.Module;
	export default module;
}

declare module "*.bin" {
	const data: ArrayBuffer;
	export default data;
}
