// 生成资产入库。
//
// Tripo 返回的模型 URL 带 CloudFront 签名与过期时间（实测约 24 小时），
// GPT-Image 返回的也是第三方图床地址。直接把这些 URL 存进数据当作永久引用，
// 第二天整个世界的模型就会集体 404。所以拿到就下载落盘，对外只暴露稳定的本地地址。

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { HttpError } from './tripo.js'

const ASSET_DIR = resolve(process.cwd(), '.assets')

/** 只接受这几种，避免把任意远端内容落到磁盘上 */
const ALLOWED_EXT = new Set(['.glb', '.gltf', '.png', '.jpg', '.jpeg', '.webp'])

/** 单个资产的体积上限，防止异常响应撑爆磁盘 */
const MAX_BYTES = 64 * 1024 * 1024

export interface StoredAsset {
  /** 稳定的本地地址，前端直接用 */
  url: string
  id: string
  bytes: number
}

function extOf(remoteUrl: string): string {
  // 签名 URL 带一长串 query，取 pathname 才能拿到真扩展名
  const path = new URL(remoteUrl).pathname
  const ext = extname(path).toLowerCase()
  return ext || '.glb'
}

/**
 * 下载远端资产并落盘，重复调用只下载一次。
 *
 * @param key 稳定的去重键，优先传任务 id。不传就退回用 URL 做键，但签名 URL
 *   的签名会随过期时间变化，同一个模型隔天再取就是另一个键，会重复下载并
 *   留下孤儿文件——所以调用方应当尽量传 key。
 */
export async function ingest(remoteUrl: string, key?: string): Promise<StoredAsset> {
  let ext: string
  try {
    ext = extOf(remoteUrl)
  } catch {
    throw new HttpError(400, '资产地址不是合法 URL')
  }
  if (!ALLOWED_EXT.has(ext)) {
    throw new HttpError(400, `不支持的资产类型：${ext}`)
  }

  const id = createHash('sha256').update(key ?? remoteUrl).digest('hex').slice(0, 32) + ext
  const file = join(ASSET_DIR, id)

  if (existsSync(file)) {
    const buf = await readFile(file)
    return { url: `/api/assets/${id}`, id, bytes: buf.byteLength }
  }

  const res = await fetch(remoteUrl)
  if (!res.ok) throw new HttpError(502, `下载资产失败 (${res.status})`)

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength > MAX_BYTES) {
    throw new HttpError(413, `资产过大：${(buf.byteLength / 1048576).toFixed(1)}MB`)
  }

  await mkdir(ASSET_DIR, { recursive: true })
  await writeFile(file, buf)
  return { url: `/api/assets/${id}`, id, bytes: buf.byteLength }
}

const MIME: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

/** 读回已入库的资产。id 必须是入库时生成的形式，避免路径穿越。 */
export async function readAsset(id: string): Promise<{ body: Buffer; type: string }> {
  if (!/^[0-9a-f]{32}\.[a-z]+$/.test(id)) throw new HttpError(400, '非法资产 id')

  const ext = extname(id)
  const file = join(ASSET_DIR, id)
  if (!existsSync(file)) throw new HttpError(404, '资产不存在')

  return { body: await readFile(file), type: MIME[ext] ?? 'application/octet-stream' }
}
