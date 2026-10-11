import { initializeWasm, isWasmInitialized } from '@automerge/automerge/slim'
import wasmUrl from '@automerge/automerge/automerge.wasm?url'

export async function loadAutomerge(): Promise<void> {
  if (isWasmInitialized()) return
  await initializeWasm(wasmUrl)
}
