// 几何与领土逻辑断言。这三块是从 2D 原型迁移时最容易出错的地方。
import { describe, expect, it } from 'vitest'
import {
  MAP_H, MAP_W, OWNER_MAP, TERRAIN, TERRAIN_MAP, buildCells, cellKey, nationByGlyph,
} from './data.js'
import { center, edgeNeighbors, neighbors } from './hex.js'
import { borderSegments, resourcesOf, territoryOf, validateClaim } from './territory.js'

describe('ASCII 图', () => {
  it('两张图尺寸一致且为 16×10', () => {
    expect(OWNER_MAP).toHaveLength(MAP_H)
    expect(TERRAIN_MAP).toHaveLength(MAP_H)
    OWNER_MAP.forEach(r => expect(r).toHaveLength(MAP_W))
    TERRAIN_MAP.forEach(r => expect(r).toHaveLength(MAP_W))
  })

  it('每个陆地格的地形字符都合法', () => {
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        if (OWNER_MAP[r][c] === '.') continue
        expect(TERRAIN, `(${c},${r})`).toHaveProperty(TERRAIN_MAP[r][c])
      }
    }
  })

  it('每个归属字符都能对上国家（或 * 无主）', () => {
    for (let r = 0; r < MAP_H; r++) {
      for (let c = 0; c < MAP_W; c++) {
        const g = OWNER_MAP[r][c]
        if (g === '.' || g === '*') continue
        expect(nationByGlyph(g), `glyph ${g} at (${c},${r})`).toBeDefined()
      }
    }
  })
})

describe('neighbors (odd-q)', () => {
  it('恒为六方向', () => {
    expect(neighbors(4, 4)).toHaveLength(6)
    expect(neighbors(5, 4)).toHaveLength(6)
  })

  it('邻接是对称的 —— A 是 B 的邻居则 B 也是 A 的邻居', () => {
    for (let c = 1; c < MAP_W - 1; c++) {
      for (let r = 1; r < MAP_H - 1; r++) {
        for (const [nc, nr] of neighbors(c, r)) {
          const back = neighbors(nc, nr).some(([bc, br]) => bc === c && br === r)
          expect(back, `(${c},${r}) <-> (${nc},${nr})`).toBe(true)
        }
      }
    }
  })

  it('偶列与奇列的斜向偏移不同（odd-q 的关键特征）', () => {
    expect(neighbors(4, 4)).toEqual(expect.arrayContaining([[3, 3], [3, 4]]))
    expect(neighbors(5, 4)).toEqual(expect.arrayContaining([[4, 4], [4, 5]]))
  })

  it('六个邻居互不重复', () => {
    for (const col of [4, 5]) {
      const ks = neighbors(col, 4).map(([c, r]) => cellKey(c, r))
      expect(new Set(ks).size).toBe(6)
    }
  })
})

describe('edgeNeighbors', () => {
  it('与 neighbors 是同一组格子，只是顺序绑定到边', () => {
    for (const [col, row] of [[4, 4], [5, 4], [7, 2]] as [number, number][]) {
      const a = new Set(neighbors(col, row).map(([c, r]) => cellKey(c, r)))
      const b = new Set(edgeNeighbors(col, row).map(([c, r]) => cellKey(c, r)))
      expect(b).toEqual(a)
    }
  })
})

describe('center', () => {
  it('奇数列向下偏移半步', () => {
    const even = center(4, 4)
    const odd = center(5, 4)
    expect(odd.y - even.y).toBeCloseTo(Math.sqrt(3) * 11 / 2, 5)
  })

  it('列步进为 1.5R', () => {
    expect(center(1, 0).x - center(0, 0).x).toBeCloseTo(16.5, 5)
  })
})

describe('territory', () => {
  const cells = buildCells()

  it('陆地格数量与 ASCII 图非海洋字符数一致', () => {
    const land = OWNER_MAP.join('').split('').filter(ch => ch !== '.').length
    expect(cells.size).toBe(land)
  })

  it('Benchylvania 领土格数与图上 B 的数量一致', () => {
    const bCount = OWNER_MAP.join('').split('').filter(ch => ch === 'B').length
    expect(territoryOf(cells, 'benchylvania')).toHaveLength(bCount)
  })

  it('资源统计总数等于领土格数', () => {
    const terr = territoryOf(cells, 'benchylvania').length
    const res = resourcesOf(cells, 'benchylvania')
    expect(Object.values(res).reduce((a, b) => a + b, 0)).toBe(terr)
  })

  it('无主格 owner 为 null，不计入任何国家', () => {
    const neutral = [...cells.values()].filter(c => c.owner === null)
    expect(neutral.length).toBeGreaterThan(0)
  })
})

describe('borderSegments', () => {
  const cells = buildCells()

  it('单格领土产生 6 条边', () => {
    const one = new Map(cells)
    // 造一个只有一格的国家场景：取 Benchyland 的一格，其余清空
    const solo = new Map<string, any>()
    solo.set(cellKey(9, 8), { col: 9, row: 8, owner: 'benchyland', terrain: 'p' })
    expect(borderSegments(solo, 'benchyland')).toHaveLength(6)
    expect(one.size).toBe(cells.size)   // 未污染原表
  })

  it('相邻两格共享的边不出现在轮廓里', () => {
    const two = new Map<string, any>()
    two.set(cellKey(4, 4), { col: 4, row: 4, owner: 'x', terrain: 'p' })
    two.set(cellKey(4, 5), { col: 4, row: 5, owner: 'x', terrain: 'p' })
    // 两格各 6 边，共享 1 条 → 12 - 2 = 10
    expect(borderSegments(two, 'x')).toHaveLength(10)
  })

  it('真实国家的轮廓边数少于格数×6（说明有内部共享边被剔除）', () => {
    const segs = borderSegments(cells, 'benchylvania')
    const terr = territoryOf(cells, 'benchylvania').length
    expect(segs.length).toBeGreaterThan(0)
    expect(segs.length).toBeLessThan(terr * 6)
  })
})

describe('validateClaim', () => {
  const cells = buildCells()

  it('空选择被拒绝', () => {
    expect(validateClaim(cells, new Set(), 'benchylvania')[0]).toContain('尚未选择')
  })

  it('海域格被拒绝', () => {
    const errs = validateClaim(cells, new Set([cellKey(0, 0)]), 'benchylvania')
    expect(errs.join()).toContain('海域')
  })

  it('他国领土要走争议流程而非认领', () => {
    const pr = territoryOf(cells, 'print-republic')[0]
    const errs = validateClaim(cells, new Set([cellKey(pr.col, pr.row)]), 'benchylvania')
    expect(errs.join()).toContain('争议')
  })

  it('飞地被拒绝', () => {
    // 找一个无主格，且不与 Benchylvania 任何领土相邻
    const own = new Set(territoryOf(cells, 'benchylvania').map(c => cellKey(c.col, c.row)))
    const far = [...cells.values()].find(c =>
      c.owner === null &&
      !neighbors(c.col, c.row).some(([nc, nr]) => own.has(cellKey(nc, nr))))
    expect(far, '测试数据里应存在与 Benchylvania 不相邻的无主格').toBeDefined()
    const errs = validateClaim(cells, new Set([cellKey(far!.col, far!.row)]), 'benchylvania')
    expect(errs.join()).toContain('飞地')
  })

  it('与本国领土相邻的无主格可以认领', () => {
    const own = new Set(territoryOf(cells, 'benchylvania').map(c => cellKey(c.col, c.row)))
    const adj = [...cells.values()].find(c =>
      c.owner === null &&
      neighbors(c.col, c.row).some(([nc, nr]) => own.has(cellKey(nc, nr))))
    expect(adj, '测试数据里应存在与 Benchylvania 相邻的无主格').toBeDefined()
    expect(validateClaim(cells, new Set([cellKey(adj!.col, adj!.row)]), 'benchylvania')).toEqual([])
  })
})
