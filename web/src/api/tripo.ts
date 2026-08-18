// Tripo 前端客户端。只跟本地服务端说话，永不直连 Tripo（key 在服务端）。

export interface TripoTask {
  task_id: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled'
  progress?: number
  output?: {
    pbr_model?: string
    model?: string
    rendered_image?: string
  }
}

interface Envelope<T> {
  ok: boolean
  data?: T
  error?: string
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await res.json().catch(() => null) as Envelope<T> | null
  if (!res.ok || !body?.ok || body.data === undefined) {
    throw new Error(body?.error ?? `请求失败 (${res.status})`)
  }
  return body.data
}

export const createLandmarkTask = (b: { prompt: string; seedKey?: string }) =>
  req<{ task_id: string }>('/api/tripo/landmark', { method: 'POST', body: JSON.stringify(b) })

export const createTextureTask = (b: { prompt: string; seedKey?: string }) =>
  req<{ task_id: string }>('/api/tripo/texture', { method: 'POST', body: JSON.stringify(b) })

export const getTask = (id: string) =>
  req<TripoTask>(`/api/tripo/task/${encodeURIComponent(id)}`)

export const getBalance = () =>
  req<{ balance?: number; frozen?: number }>('/api/tripo/balance')

export const getHealth = () =>
  fetch('/api/health').then(r => r.json() as Promise<{ ok: boolean; tripoKey: boolean }>)

/**
 * 轮询任务直到终态。返回一个取消函数（组件卸载时调用，避免泄漏）。
 */
export function pollTask(id: string, handlers: {
  onUpdate?: (t: TripoTask) => void
  onDone: (t: TripoTask) => void
  onError: (e: Error) => void
  intervalMs?: number
}): () => void {
  let cancelled = false
  const interval = handlers.intervalMs ?? 3000

  const tick = async () => {
    if (cancelled) return
    try {
      const t = await getTask(id)
      if (cancelled) return
      handlers.onUpdate?.(t)
      if (t.status === 'success' || t.status === 'failed' || t.status === 'cancelled') {
        handlers.onDone(t)
        return
      }
      setTimeout(tick, interval)
    } catch (e) {
      if (!cancelled) handlers.onError(e instanceof Error ? e : new Error('轮询失败'))
    }
  }

  void tick()
  return () => { cancelled = true }
}
