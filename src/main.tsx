import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/public-sans'
import '@fontsource/spline-sans-mono/400.css'
import '@fontsource/spline-sans-mono/500.css'
import '@fontsource/spline-sans-mono/600.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/controls.css'
import { App } from './app/App'
import { EngineContext } from './app/engineContext'
import { resolveDeviceId } from './app/devices'
import { Boot } from './app/Boot'
import { loadAutomerge } from './crdt/loadWasm'
import { Engine } from './sync/engine'

const root = createRoot(document.getElementById('root')!)
root.render(<Boot />)

async function start() {
  try {
    await loadAutomerge()
    const engine = new Engine({ deviceId: resolveDeviceId(), latencyMs: 650 })
    await engine.init()
    const { fatal } = engine.getState()
    if (fatal) throw new Error(fatal)
    root.render(
      <StrictMode>
        <EngineContext.Provider value={engine}>
          <App />
        </EngineContext.Provider>
      </StrictMode>,
    )
  } catch (err) {
    root.render(<Boot error={err instanceof Error ? err.message : String(err)} />)
  }
}

void start()
