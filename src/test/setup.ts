/// <reference types="node" />
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { initializeWasm, isWasmInitialized } from '@automerge/automerge/slim'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('@automerge/automerge/automerge.wasm')

if (!isWasmInitialized()) {
  await initializeWasm(readFileSync(wasmPath))
}
