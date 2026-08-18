// 加载烘焙产物。渲染层不重算高度场，只消费资产。

import { decodeHeights } from '@gbn/shared/world'
import type { Heightfield, WorldSpec } from '@gbn/shared/world'

export interface LoadedWorld {
  spec: WorldSpec
  heights: Float32Array
  regions: Uint8Array
  owners: Uint8Array
  hf: Heightfield
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`加载失败 ${url}: ${res.status}`)
  return res.arrayBuffer()
}

export async function loadWorld(baseUrl = '/world'): Promise<LoadedWorld> {
  const specRes = await fetch(`${baseUrl}/world-spec.json`)
  if (!specRes.ok) throw new Error(`加载 world-spec.json 失败: ${specRes.status}`)
  const spec: WorldSpec = await specRes.json()

  const [hBuf, rBuf, oBuf] = await Promise.all([
    fetchBuffer(`${baseUrl}/heightmap.bin`),
    fetchBuffer(`${baseUrl}/regions.bin`),
    fetchBuffer(`${baseUrl}/owners.bin`),
  ])

  const heights = decodeHeights(new Uint16Array(hBuf), spec.min, spec.max)
  const hf: Heightfield = {
    res: spec.res,
    sizeX: spec.sizeX,
    sizeZ: spec.sizeZ,
    data: heights,
    min: spec.min,
    max: spec.max,
  }

  return { spec, heights, regions: new Uint8Array(rBuf), owners: new Uint8Array(oBuf), hf }
}
