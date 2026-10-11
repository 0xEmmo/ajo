/**
 * The slim build leaves loading the wasm to us, so the browser can fetch it as a
 * normal cached file (the service worker precaches it) instead of inlining a
 * megabyte of base64 into the bundle.
 */
export * as A from '@automerge/automerge/slim'
export type { Doc, Heads } from '@automerge/automerge/slim'
