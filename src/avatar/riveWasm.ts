/**
 * Where the Rive runtime is fetched from.
 *
 * `@rive-app/canvas` defaults to unpkg.com with a jsdelivr fallback: measured, mounting a Rive
 * avatar issued a live request for 2 MB of WebAssembly to a third party. Offline it simply failed,
 * which made imported vector avatars the one part of the application that needed a network.
 *
 * The binary is copied out of node_modules by `scripts/sync-rive-wasm.mjs` and precached with the
 * rest of the shell.
 */
export const RIVE_WASM_URL = `${import.meta.env.BASE_URL}rive/rive.wasm`;
