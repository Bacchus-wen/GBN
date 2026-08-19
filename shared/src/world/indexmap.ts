// 索引图采样。烘焙产物里的 regions.bin / owners.bin 是 res×res 的 Uint8 索引，
// 每个像素存的是「该点属于第几个区域」。与高度场不同，索引不能插值——
// 半个国家和半个国家插值出来不是任何国家，所以这里用最近邻。

export interface IndexMapView {
  data: Uint8Array
  res: number
  sizeX: number
  sizeZ: number
}

/**
 * 按世界坐标取索引，越界夹取到边缘。
 * 采样规则与 heightfield 的 toGrid 保持一致（同一套归一化映射），
 * 只是最后取整而非双线性插值。
 */
export function sampleIndex(map: IndexMapView, x: number, z: number): number {
  const { data, res, sizeX, sizeZ } = map
  const gx = ((x + sizeX / 2) / sizeX) * (res - 1)
  const gz = ((z + sizeZ / 2) / sizeZ) * (res - 1)
  const ix = Math.min(res - 1, Math.max(0, Math.round(gx)))
  const iz = Math.min(res - 1, Math.max(0, Math.round(gz)))
  return data[iz * res + ix]
}
