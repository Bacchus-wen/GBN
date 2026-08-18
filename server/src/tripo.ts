// Tripo v3 客户端。API Key 只存在服务端，前端永不接触。
// 文档：https://developers.tripo3d.ai/en/docs

const BASE = 'https://openapi.tripo3d.ai/v3'

/** 模型版本。v3.1 质量最好。 */
const MODEL = 'v3.1-20260211'

export interface TripoTaskRef { task_id: string }

export interface TripoTask {
  task_id: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled'
  progress?: number
  output?: {
    pbr_model?: string
    model?: string
    rendered_image?: string
    [k: string]: unknown
  }
}

function apiKey(): string {
  const k = process.env.TRIPO_API_KEY?.trim()
  if (!k) throw new HttpError(503, 'TRIPO_API_KEY 未配置，服务端无法调用 Tripo')
  return k
}

/**
 * 本机走代理时（macOS 系统代理 / clash 之类），Node 的 fetch 默认不读系统代理。
 * 设置 HTTPS_PROXY 后 Node 20+ 配合 --use-env-proxy 或 undici 才生效；
 * 这里显式提示，避免「DNS 能解析但 TCP 超时」被误判为 key 问题。
 */
export function proxyHint(): string | null {
  const p = process.env.HTTPS_PROXY ?? process.env.https_proxy
  return p ?? null
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch (e) {
    // 网络层失败（本机代理未透传时最常见）。区分开来，别让它看起来像 key 无效。
    const hint = proxyHint()
      ? `已设置 HTTPS_PROXY=${proxyHint()}，但 Node 需要 --use-env-proxy 才会走它`
      : '若本机使用代理上网，请以 HTTPS_PROXY=http://127.0.0.1:<端口> 启动服务'
    throw new HttpError(502, `无法连接 Tripo（${(e as Error).message}）。${hint}`)
  }

  const body = await res.json().catch(() => null) as
    | { code?: number; data?: T; message?: string; suggestion?: string }
    | null

  if (!res.ok || !body) {
    throw new HttpError(res.status || 502, body?.message ?? `Tripo 请求失败 (${res.status})`)
  }
  // Tripo 统一响应：code 0 为成功
  if (body.code !== 0) {
    const hint = body.suggestion ? `（${body.suggestion}）` : ''
    throw new HttpError(400, `${body.message ?? 'Tripo 返回错误'}${hint}`)
  }
  return body.data as T
}

/** 稳定种子：同一国家的地标每次生成保持一致的几何 */
export function seedFrom(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % 2_147_483_647
}

/**
 * 生成国家地标。参数按 Voxel/Retro 风格与 Web 性能选定：
 * smart_low_poly 出干净的低面拓扑，face_limit 8000 适合网页加载。
 */
export function createLandmark(opts: {
  prompt: string
  seedKey?: string
  negativePrompt?: string
}): Promise<TripoTaskRef> {
  return call<TripoTaskRef>('/generation/text-to-model', {
    method: 'POST',
    body: JSON.stringify({
      prompt: opts.prompt.slice(0, 1024),
      model: MODEL,
      negative_prompt: (opts.negativePrompt ?? 'blurry, low quality, broken mesh, floating parts').slice(0, 255),
      smart_low_poly: true,
      face_limit: 8000,
      texture: true,
      pbr: true,
      texture_quality: 'standard',
      auto_size: true,
      ...(opts.seedKey ? { model_seed: seedFrom(opts.seedKey) } : {}),
    }),
  })
}

/** 生成地形纹理，贴到六棱柱顶面 */
export function createTexture(opts: { prompt: string; seedKey?: string }): Promise<TripoTaskRef> {
  return call<TripoTaskRef>('/generation/text-to-image', {
    method: 'POST',
    body: JSON.stringify({
      prompt: opts.prompt.slice(0, 1024),
      model: MODEL,
      ...(opts.seedKey ? { image_seed: seedFrom(opts.seedKey) } : {}),
    }),
  })
}

export function getTask(id: string): Promise<TripoTask> {
  return call<TripoTask>(`/tasks/${encodeURIComponent(id)}`)
}

export function getBalance(): Promise<{ balance?: number; frozen?: number }> {
  return call('/account/balance')
}

export const hasKey = () => Boolean(process.env.TRIPO_API_KEY)
