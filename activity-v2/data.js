// GBN 世界地图 · 数据层
// 地图用两层 ASCII 图authoring：归属层 + 地形层。每行 16 字符，共 10 行。
// 直接改这两张图就能改地图，坐标为 (col, row)，odd-q 偏移六角网格。

export const MAP_W = 16
export const MAP_H = 10

// 归属层：. 海洋   * 无主陆地   其余字母见 NATIONS.glyph
export const OWNER_MAP = [
  '....NNNN........',
  '...NNNNN.OO.....',
  '..PP.*NN..O..AA.',
  '.PPPP...**.BBAAA',
  '.PPPPP..*.BBBBAA',
  '..PP...**.BBBB.A',
  '..CC...*..BBBB..',
  '.CCCC..**.*.....',
  '..CCC...LLL.....',
  '.....*..LLL.....',
]

// 地形层：p 平原  f 森林  m 山地  c 海岸  i 冰原  r 礁岩  v 火山  d 荒漠
export const TERRAIN_MAP = [
  '....iiii........',
  '...iimmi.pp.....',
  '..cp.pmm..p..mm.',
  '.cpff...pf.pmmmf',
  '.cppfm..p.ffmmpf',
  '..cp...pf.pffp.m',
  '..rr...c..pfpp..',
  '.rrcc..pc.f.....',
  '..rcc...vpp.....',
  '.....c..cpp.....',
]

// 地形定义：色调偏移 + 体素高度（高度直接影响地图剪影，AI 改地形会看得见）
export const TERRAIN = {
  p: { key: 'p', name: '平原', height: 10, hue: 0, sat: 0, lum: 0, res: '耗材', icon: '▒' },
  f: { key: 'f', name: '森林', height: 13, hue: 18, sat: 10, lum: -14, res: '木材', icon: '♣' },
  m: { key: 'm', name: '山地', height: 20, hue: -6, sat: -22, lum: 6, res: '矿石', icon: '▲' },
  c: { key: 'c', name: '海岸', height: 5, hue: -24, sat: 4, lum: 12, res: '港口', icon: '≈' },
  i: { key: 'i', name: '冰原', height: 11, hue: -34, sat: -14, lum: 20, res: '冷凝', icon: '❄' },
  r: { key: 'r', name: '礁岩', height: 5, hue: -46, sat: 12, lum: 4, res: '港口', icon: '⌇' },
  v: { key: 'v', name: '火山', height: 24, hue: 30, sat: 24, lum: -4, res: '矿石', icon: '▲' },
  d: { key: 'd', name: '荒漠', height: 9, hue: 26, sat: 14, lum: 14, res: '耗材', icon: '░' },
}

export const RESOURCE_ORDER = ['耗材', '木材', '矿石', '港口', '冷凝']

// 国家。glyph 对应归属层字符。
export const NATIONS = [
  {
    id: 'benchylvania', glyph: 'B', name: 'Benchylvania', flag: '⚓', color: '#4a8dff',
    slogan: '校准舰队，征服海洋。',
    desc: '东部大陆架工业强国，以精密 Benchy 舰队闻名。',
    status: 'active', gdp: 48200, weeklyGdp: 8300, memberCount: 47, rank: 1,
    foundedAt: '2026-04-28',
    leader: { name: 'ItzMpower', avatar: 'IP', role: '开国者 · 总统' },
    members: [
      { name: 'CosmosDestroyer', avatar: 'CD', role: '海军上将', gdp: 3100 },
      { name: 'Northeast3Dd', avatar: 'NE', role: '将军', gdp: 2600 },
      { name: 'AlexBench', avatar: 'AB', role: '国民', gdp: 1900 },
      { name: 'LL7053', avatar: 'LL', role: '外交官', gdp: 1400 },
    ],
    fleet: [
      { name: '港口灯塔 Mk III', kind: '地标', verified: true },
      { name: '舰队补给 Benchy', kind: '舰船', verified: true },
      { name: '国家纪念碑大门', kind: '地标', verified: true },
    ],
    texture: '钢蓝船坞 · 铆接装甲板',
    story: '起于东部大陆架的干船坞群。国民以「每一次校准都是一次胜利」为信条，把公差控制写进了宪法序言。',
    storyStatus: 'approved',
  },
  {
    id: 'print-republic', glyph: 'P', name: 'Print Republic', flag: '🛳️', color: '#ff4a4a',
    slogan: '每一层耗材，都是一道防线。',
    desc: '创客联邦，将 AMS 多色涂装视为海军迷彩。',
    status: 'active', gdp: 41500, weeklyGdp: 9100, memberCount: 52, rank: 2,
    foundedAt: '2026-05-02',
    leader: { name: 'GabeTechInd', avatar: 'GT', role: '开国者 · 总统' },
    members: [
      { name: 'BoneForgePrints', avatar: 'BF', role: '将军', gdp: 2900 },
      { name: 'WV4AM', avatar: 'WV', role: '部长', gdp: 2400 },
      { name: 'PocketArmourCO', avatar: 'PA', role: '外交官', gdp: 1800 },
    ],
    fleet: [
      { name: 'AMS 迷彩驱逐舰', kind: '舰船', verified: true },
      { name: '共和国参议院穹顶', kind: '地标', verified: true },
      { name: '多色涂装试验艇', kind: '舰船', verified: false },
    ],
    texture: '警报红 · 多色迷彩条纹',
    story: '由 UBE 工程派系改组而成的联邦。每一届参议院都要在穹顶上加印一层新色，层数即国龄。',
    storyStatus: 'approved',
  },
  {
    id: 'benchyland', glyph: 'L', name: 'Benchyland', flag: '🏝️', color: '#3ddc6b',
    slogan: '小船有大梦。',
    desc: '岛国，以吉祥物设计和欢快的战报著称。',
    status: 'active', gdp: 36800, weeklyGdp: 6200, memberCount: 38, rank: 3,
    foundedAt: '2026-05-14',
    leader: { name: 'blufufuf3D', avatar: 'BL', role: '开国者 · 总统' },
    members: [
      { name: 'Alex', avatar: 'AX', role: '部长', gdp: 2200 },
      { name: 'MAN', avatar: 'MN', role: '将军', gdp: 1600 },
    ],
    fleet: [
      { name: '岛屿吉祥物 Benchy', kind: '吉祥物', verified: true },
      { name: '火山观测站', kind: '地标', verified: true },
      { name: '欢乐战报播报塔', kind: '地标', verified: false },
    ],
    texture: '热带绿 · 火山黑砂滩',
    story: '全国只有一座火山和很多沙滩。战报写得最欢快，被 UBN 称为「不打仗的国家」。',
    storyStatus: 'approved',
  },
  {
    id: 'carabbenchia', glyph: 'C', name: 'Carabbenchia', flag: '🦀', color: '#ff8c2b',
    slogan: '甲壳工程，自建国日起。',
    desc: '沿海贸易国，连接 UBN 外交与沙盘纪念碑建设。',
    status: 'active', gdp: 29400, weeklyGdp: 4800, memberCount: 31, rank: 4,
    foundedAt: '2026-05-18',
    leader: { name: 'Jedieed', avatar: 'JD', role: '开国者 · 总统' },
    members: [
      { name: 'CrabWorks', avatar: 'CW', role: '部长', gdp: 1900 },
      { name: 'ReefPilot', avatar: 'RP', role: '外交官', gdp: 1300 },
    ],
    fleet: [
      { name: '蟹钳码头起重机', kind: '地标', verified: true },
      { name: '礁岩巡逻艇', kind: '舰船', verified: true },
    ],
    texture: '甲壳橙 · 礁岩纹',
    story: '国土全在礁岩线上，靠港口而不是耕地立国。外交部就设在码头起重机的驾驶室里。',
    storyStatus: 'approved',
  },
  {
    id: 'allabenchia', glyph: 'A', name: 'Allabenchia', flag: '👑', color: '#c46bff',
    slogan: '巫师打印，诸国崛起。',
    desc: 'UBN 阵营国家，普查参与度高，地图 lore 丰富。',
    status: 'active', gdp: 25100, weeklyGdp: 3900, memberCount: 29, rank: 5,
    foundedAt: '2026-06-01',
    leader: { name: 'xreme', avatar: 'XR', role: '开国者 · 总统' },
    members: [
      { name: 'WizardLayer', avatar: 'WL', role: '将军', gdp: 1700 },
      { name: 'CensusKeeper', avatar: 'CK', role: '部长', gdp: 1200 },
    ],
    fleet: [
      { name: '巫师灯塔', kind: '地标', verified: false },
      { name: '山脊要塞 Benchy', kind: '舰船', verified: true },
    ],
    texture: '巫紫 · 山脊符文',
    story: '把人口普查做成国教。每个国民的职位、同盟、领土都要登记在册，档案室比王宫还大。',
    storyStatus: 'approved',
  },
  {
    id: 'north-bench', glyph: 'N', name: 'North Bench', flag: '❄️', color: '#2bd9f0',
    slogan: '冷树脂，热 GDP。',
    desc: '北极船坞，专精破冰级 Benchy 变体。',
    status: 'active', gdp: 18700, weeklyGdp: 3100, memberCount: 22, rank: 6,
    foundedAt: '2026-06-11',
    leader: { name: 'FrostHull', avatar: 'FH', role: '开国者 · 总统' },
    members: [
      { name: 'IceBreaker9', avatar: 'IB', role: '海军上将', gdp: 1500 },
      { name: 'ColdResin', avatar: 'CR', role: '国民', gdp: 900 },
    ],
    fleet: [
      { name: '破冰船坞', kind: '地标', verified: true },
      { name: '破冰级 Benchy', kind: '舰船', verified: true },
    ],
    texture: '极地青 · 裂冰纹',
    story: '全境冰原，打印机要先预热两小时。国民认为这是筛选忠诚度的天然机制。',
    storyStatus: 'approved',
  },
  {
    id: 'new-bench-order', glyph: 'O', name: '新 Benchy 秩序', flag: '🌱', color: '#a8e02b',
    slogan: '三名国民，即可立国。',
    desc: '筹备中——正在招募国民以获得正式承认。',
    status: 'pending', gdp: 0, weeklyGdp: 420, memberCount: 2, rank: 0,
    foundedAt: '2026-07-01',
    leader: { name: 'NewFounder', avatar: 'NF', role: '发起人' },
    members: [
      { name: 'SeedPrinter', avatar: 'SP', role: '国民', gdp: 180 },
    ],
    fleet: [
      { name: '开国纪念 Benchy', kind: '舰船', verified: false },
    ],
    texture: '新芽黄绿 · 未定',
    story: '',
    storyStatus: 'none',
  },
]

// 争议格：两国同时主张，须管理员裁决
export const CONTESTED = [
  { col: 13, row: 3, claimants: ['benchylvania', 'allabenchia'], since: '3 天前',
    note: '地图 v2 发布后双方都在此格标注了纪念碑建设位。' },
  { col: 13, row: 4, claimants: ['benchylvania', 'allabenchia'], since: '3 天前',
    note: '山脊走向不明，双方对分水岭归属理解不同。' },
  { col: 5, row: 2, claimants: ['print-republic', 'north-bench'], since: '1 天前',
    note: '无主走廊，两国同日提交认领申请。' },
]

// 地标：玩家或 AI 产出，落在具体格子上
export const LANDMARKS = [
  { col: 11, row: 4, nationId: 'benchylvania', name: '主权港口大门', author: 'ItzMpower', origin: 'human', status: 'approved' },
  { col: 3, row: 4, nationId: 'print-republic', name: '共和国参议院穹顶', author: 'GabeTechInd', origin: 'human', status: 'approved' },
  { col: 9, row: 8, nationId: 'benchyland', name: '岛屿吉祥物纪念碑', author: 'blufufuf3D', origin: 'human', status: 'approved' },
  { col: 3, row: 8, nationId: 'carabbenchia', name: '蟹钳码头起重机', author: 'CrabWorks', origin: 'human', status: 'approved' },
  { col: 5, row: 1, nationId: 'north-bench', name: '破冰船坞', author: 'FrostHull', origin: 'human', status: 'approved' },
  { col: 14, row: 4, nationId: 'allabenchia', name: '巫师灯塔', author: 'WizardLayer', origin: 'ai', status: 'pending' },
]

// 三级角色。demo 可切换。
export const ROLES = {
  citizen: {
    key: 'citizen', label: '国民', user: 'AlexBench', avatar: 'AB',
    nationId: 'benchylvania', title: '国民 · Benchylvania',
    can: { submit: true, approveDomestic: false, approveTerritory: false },
    hint: '可提交 AI 草案与领土认领申请，不能核准。',
  },
  leader: {
    key: 'leader', label: '国家领袖', user: 'ItzMpower', avatar: 'IP',
    nationId: 'benchylvania', title: '开国者 · 总统 · Benchylvania',
    can: { submit: true, approveDomestic: true, approveTerritory: false },
    hint: '可核准本国内政（地形、地标、纹理、背景故事），领土变更仍需管理员。',
  },
  admin: {
    key: 'admin', label: '社区管理员', user: 'GBN-Mod', avatar: 'MD',
    nationId: null, title: '管理员 · 跨国事务',
    can: { submit: true, approveDomestic: true, approveTerritory: true },
    hint: '可裁决领土变更、争议格与战争结果。',
  },
}

// AI 生成的候选池。每次「生成」按顺序取用，保证 demo 可复现。
export const AI_POOL = {
  terrain: [
    { label: '抬升为山地', terrain: 'm', rationale: '相邻两格均为山地，按地质连续性补全分水岭。' },
    { label: '改造为森林', terrain: 'f', rationale: '该格处于内陆湿润带，森林覆盖符合周边生态。' },
    { label: '开凿为海岸', terrain: 'c', rationale: '紧邻海域，开放为海岸可新增港口资源。' },
    { label: '判定为荒漠', terrain: 'd', rationale: '位于山脉背风侧，降水稀少。' },
    { label: '标注为火山', terrain: 'v', rationale: '与已知火山同处一条隆起带，剪影可提升辨识度。' },
  ],
  landmark: [
    { label: '锚链凯旋门', rationale: '取材于该国舰队校准仪式，可打印为单件拱形结构。' },
    { label: '层积纪念碑', rationale: '以耗材层积为造型语言，呼应「每一层都是防线」。' },
    { label: '潮汐钟楼', rationale: '海岸格适合放置带机械结构的可动地标。' },
    { label: '普查档案塔', rationale: '把人口普查文化实体化，便于社区打卡。' },
    { label: '破冰纪念船坞', rationale: '冰原格地标稀少，船坞造型可承载国家叙事。' },
  ],
  texture: [
    { label: '铆接装甲板 · 冷钢蓝', rationale: '基于国家主色降饱和 + 铆钉阵列，贴图可平铺。' },
    { label: '多色迷彩条纹 · 警报红', rationale: '模拟 AMS 换色接缝，强化联邦身份。' },
    { label: '火山黑砂 · 热带绿', rationale: '岛国地貌对比强，黑砂能压住高饱和绿。' },
    { label: '礁岩甲壳纹 · 甲壳橙', rationale: '甲壳分节纹理与礁岩轮廓同源。' },
    { label: '裂冰纹 · 极地青', rationale: '冰裂随机种子可按国家 ID 固定，保证一致性。' },
  ],
  story: [
    { label: '建国叙事草案', rationale: '基于该国已有战报与地形自动串联，供领袖改写。',
      text: '第一批国民在冬季把打印机搬上了没有名字的海岬。他们没有旗，只有一台校准失败了七次的机器。第八次成功的时候，海岬有了名字。' },
    { label: '国民信条草案', rationale: '从社区帖高频措辞提炼，非原创，仅作参考。',
      text: '我们相信公差。我们相信一层比一层更接近正确。我们不相信没有打印证明的胜利。' },
    { label: '边境往事草案', rationale: '结合争议格历史，给外交叙事提供素材。',
      text: '争议从来不是关于那三格土地，而是关于谁先在地图上写下了它的名字。' },
  ],
}
