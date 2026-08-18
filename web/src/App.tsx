import { useEffect, useState } from 'react'
import { WorldCanvas } from './world/WorldCanvas'
import { loadWorld } from './world/loadWorld'
import type { LoadedWorld } from './world/loadWorld'

export default function App() {
  const [world, setWorld] = useState<LoadedWorld | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { loadWorld().then(setWorld).catch(e => setErr(String(e))) }, [])
  if (err) return <div style={{ padding: 24, color: '#f66' }}>{err}</div>
  if (!world) return <div style={{ padding: 24 }}>加载世界…</div>
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <WorldCanvas world={world} onPick={(pt, n) => console.log('落点', pt, '法线', n)} />
    </div>
  )
}
