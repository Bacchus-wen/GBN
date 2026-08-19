// Tripo 前端客户端。只跟本地服务端说话，永不直连 Tripo（key 在服务端）。

export interface TripoTask {
  task_id: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled'
  progress?: number
  output?: {
    /** v3 的字段名。v2 用的是 pbr_model / model，两套都留着以防端点回退 */
    model_url?: string
    rendered_image_url?: string
    generated_image_url?: string
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

/**
 * 把远端资产下载入库，换成稳定的本地地址。
 * Tripo 的模型 URL 带签名且约 24 小时过期，直接存进数据第二天就是死链。
 * key 传任务 id：签名会随过期时间变，用 URL 做去重键隔天就会重复下载。
 */
/** 从任务结果里取模型地址。v3 用 model_url，v2 用 pbr_model / model。 */
export const modelUrlOf = (t: TripoTask): string | undefined =>
  t.output?.model_url ?? t.output?.pbr_model ?? t.output?.model

/** 取预览图地址，同样兼容两套字段名 */
export const previewUrlOf = (t: TripoTask): string | undefined =>
  t.output?.rendered_image_url ?? t.output?.rendered_image ?? t.output?.generated_image_url

export const ingestAsset = (b: { url: string; key?: string }) =>
  req<{ url: string; id: string; bytes: number }>('/api/assets/ingest', {
    method: 'POST', body: JSON.stringify(b),
  })

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
