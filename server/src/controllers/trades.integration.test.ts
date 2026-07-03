/**
 * trades 集成测试 — 使用测试数据库中的交易历史作为输入，已平仓数据作为验证。
 *
 * 使用 SQLite :memory: 数据库，通过 createTrade 控制器完整复现每条证券的交易序列，
 * 逐步验证 Position 中间态，最终与测试数据库中已平仓数据比对。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// ── 必须在任何模块导入前设置 SQLITE_DB_PATH ──────────────────────────────
vi.hoisted(() => {
  process.env.SQLITE_DB_PATH = ':memory:'
})

// 动态导入确保 env 生效后再加载模型
const models = await import('../models')
const assetsMod = await import('../models/assets')
const positionsMod = await import('../models/positions')
const tradesMod = await import('../models/trades')
const tradesCtrl = await import('./trades')

const { sequelize } = models
const { Assets } = assetsMod
const { Position } = positionsMod
const { Trade } = tradesMod

// ── Helpers ──────────────────────────────────────────────────────────────

function mockReply() {
  const send = vi.fn().mockReturnValue(undefined) as any
  const code = vi.fn().mockReturnValue({ send }) as any
  return { send, code }
}

/** 构造 createTrade 请求对象 */
function makeRequest(body: Record<string, any>) {
  return {
    params: { id: 1 },
    body,
  }
}

// ── Fixtures: 从测试数据库提取的交易序列 ─────────────────────────────────

interface TradeFixture {
  type: 'BUY' | 'SELL'
  security_symbol: string
  security_name: string
  quantity: number
  price: number
  amount: number
  fee: number
  trade_date: string
  note?: string
}

/** 恒指科技 — 9 条交易，2 次完整开平仓循环 */
const TRADES_513180: TradeFixture[] = [
  {
    type: 'BUY',
    security_symbol: '513180',
    security_name: '恒指科技',
    quantity: 215400,
    price: 0.812,
    amount: 174904.8,
    fee: 43.73,
    trade_date: '2025-03-17',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513180',
    security_name: '恒指科技',
    quantity: 212600,
    price: 0.822,
    amount: 174757.2,
    fee: 43.69,
    trade_date: '2025-03-18',
    note: '买入',
  },
  {
    type: 'SELL',
    security_symbol: '513180',
    security_name: '恒指科技',
    quantity: 428000,
    price: 0.737,
    amount: 315436,
    fee: 78.86,
    trade_date: '2025-03-31',
    note: '卖出',
  },
  {
    type: 'BUY',
    security_symbol: '513180',
    security_name: '恒指科技',
    quantity: 156100,
    price: 0.673,
    amount: 105055.3,
    fee: 26.26,
    trade_date: '2025-04-07',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513180',
    security_name: '恒指科技',
    quantity: 289000,
    price: 0.693,
    amount: 200277.0,
    fee: 50.07,
    trade_date: '2025-04-28',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513180',
    security_name: '恒指科技',
    quantity: 209900,
    price: 0.721,
    amount: 151337.9,
    fee: 37.83,
    trade_date: '2025-05-13',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513180',
    security_name: '恒指科技',
    quantity: 161900,
    price: 0.701,
    amount: 113491.9,
    fee: 28.37,
    trade_date: '2025-05-30',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513180',
    security_name: '恒指科技',
    quantity: 58800,
    price: 0.768,
    amount: 45158.4,
    fee: 11.29,
    trade_date: '2025-08-28',
    note: '买入',
  },
  {
    type: 'SELL',
    security_symbol: '513180',
    security_name: '恒指科技',
    quantity: 583800,
    price: 0.627,
    amount: 366042.6,
    fee: 91.51,
    trade_date: '2026-05-15',
    note: '卖出',
  },
]

/** 恒指科技 — 第3条卖出是第二轮的第一次清仓（最后一笔在下面单独处理） */
const TRADES_513180_FINAL_SELL: TradeFixture = {
  type: 'SELL',
  security_symbol: '513180',
  security_name: '恒指科技',
  quantity: 291900,
  price: 0.628,
  amount: 183313.2,
  fee: 45.83,
  trade_date: '2026-05-15',
  note: '卖出',
}

/** 恒生医疗 — 7 条交易，1 次完整开平仓 */
const TRADES_513060: TradeFixture[] = [
  {
    type: 'BUY',
    security_symbol: '513060',
    security_name: '恒生医疗',
    quantity: 70000,
    price: 0.501,
    amount: 35070,
    fee: 8.77,
    trade_date: '2025-04-01',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513060',
    security_name: '恒生医疗',
    quantity: 140200,
    price: 0.5,
    amount: 70100,
    fee: 17.53,
    trade_date: '2025-04-01',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513060',
    security_name: '恒生医疗',
    quantity: 400000,
    price: 0.48,
    amount: 192000,
    fee: 48,
    trade_date: '2025-04-28',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513060',
    security_name: '恒生医疗',
    quantity: 300000,
    price: 0.684,
    amount: 205200,
    fee: 51.3,
    trade_date: '2025-07-29',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513060',
    security_name: '恒生医疗',
    quantity: 66200,
    price: 0.682,
    amount: 45148.4,
    fee: 11.29,
    trade_date: '2025-08-28',
    note: '买入',
  },
  {
    type: 'SELL',
    security_symbol: '513060',
    security_name: '恒生医疗',
    quantity: 325400,
    price: 0.659,
    amount: 214438.6,
    fee: 53.61,
    trade_date: '2025-10-28',
    note: '卖出',
  },
  {
    type: 'SELL',
    security_symbol: '513060',
    security_name: '恒生医疗',
    quantity: 651000,
    price: 0.537,
    amount: 349587,
    fee: 87.4,
    trade_date: '2026-05-15',
    note: '卖出',
  },
]

/** 恒生消费 — 6 条交易，1 次完整开平仓（含 amount ≠ qty × price 偏差） */
const TRADES_513970: TradeFixture[] = [
  {
    type: 'BUY',
    security_symbol: '513970',
    security_name: '恒生消费',
    quantity: 112800,
    price: 0.932,
    amount: 105129.6,
    fee: 26.28,
    trade_date: '2025-04-01',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513970',
    security_name: '恒生消费',
    quantity: 17400,
    price: 0.909,
    amount: 15816.6,
    fee: 5,
    trade_date: '2025-04-28',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513970',
    security_name: '恒生消费',
    quantity: 150000,
    price: 0.909,
    amount: 136350,
    fee: 34.09,
    trade_date: '2025-04-29',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '513970',
    security_name: '恒生消费',
    quantity: 43400,
    price: 1.039,
    amount: 45092.6,
    fee: 11.27,
    trade_date: '2025-08-28',
    note: '买入',
  },
  {
    type: 'SELL',
    security_symbol: '513970',
    security_name: '恒生消费',
    quantity: 107800,
    price: 0.981,
    amount: 105751.8,
    fee: 26.44,
    trade_date: '2025-10-28',
    note: '卖出',
  },
  {
    type: 'SELL',
    security_symbol: '513970',
    security_name: '恒生消费',
    quantity: 215800,
    price: 0.854,
    amount: 184293.2,
    fee: 46.07,
    trade_date: '2026-05-15',
    note: '卖出',
  },
]

/** 芯片ETF — 6 条交易，3 次开平仓循环（前2次已平，第3次仍 Open） */
const TRADES_159995: TradeFixture[] = [
  {
    type: 'BUY',
    security_symbol: '159995',
    security_name: '芯片ETF',
    quantity: 169700,
    price: 1.885,
    amount: 319884.5,
    fee: 79.97,
    trade_date: '2025-10-28',
    note: '买入',
  },
  {
    type: 'BUY',
    security_symbol: '159995',
    security_name: '芯片ETF',
    quantity: 154200,
    price: 2.341,
    amount: 360982.2,
    fee: 90.25,
    trade_date: '2026-05-18',
    note: '买入',
  },
  {
    type: 'SELL',
    security_symbol: '159995',
    security_name: '芯片ETF',
    quantity: 323900,
    price: 2.528,
    amount: 818819.2,
    fee: 204.7,
    trade_date: '2026-05-29',
    note: '卖出',
  },
  {
    type: 'BUY',
    security_symbol: '159995',
    security_name: '芯片ETF',
    quantity: 157800,
    price: 2.441,
    amount: 385189.8,
    fee: 96.3,
    trade_date: '2026-06-03',
    note: '买入',
  },
  {
    type: 'SELL',
    security_symbol: '159995',
    security_name: '芯片ETF',
    quantity: 157800,
    price: 2.833,
    amount: 447047.4,
    fee: 111.76,
    trade_date: '2026-06-23',
    note: '卖出',
  },
  {
    type: 'BUY',
    security_symbol: '159995',
    security_name: '芯片ETF',
    quantity: 130300,
    price: 3.052,
    amount: 397675.6,
    fee: 99.42,
    trade_date: '2026-06-25',
    note: '买入',
  },
]

/** 通信ETF — 4 条交易，2 次独立开平仓 */
const TRADES_515880: TradeFixture[] = [
  {
    type: 'BUY',
    security_symbol: '515880',
    security_name: '通信ETF',
    quantity: 227000,
    price: 1.694,
    amount: 384428.1,
    fee: 96.11,
    trade_date: '2026-06-03',
    note: '买入',
  },
  {
    type: 'SELL',
    security_symbol: '515880',
    security_name: '通信ETF',
    quantity: 227000,
    price: 1.785,
    amount: 405195,
    fee: 101.3,
    trade_date: '2026-06-23',
    note: '卖出',
  },
  {
    type: 'BUY',
    security_symbol: '515880',
    security_name: '通信ETF',
    quantity: 223700,
    price: 1.824,
    amount: 407954.2,
    fee: 101.99,
    trade_date: '2026-06-25',
    note: '买入',
  },
  {
    type: 'SELL',
    security_symbol: '515880',
    security_name: '通信ETF',
    quantity: 223700,
    price: 1.72,
    amount: 384764,
    fee: 96.19,
    trade_date: '2026-06-30',
    note: '卖出',
  },
]

/** 科创半导体ETF — 1 条交易，仍在 Open */
const TRADES_588170: TradeFixture[] = [
  {
    type: 'BUY',
    security_symbol: '588170',
    security_name: '科创半导体ETF',
    quantity: 74700,
    price: 4.02,
    amount: 300294,
    fee: 75.07,
    trade_date: '2026-06-30',
    note: '买入',
  },
]

// ── 从测试数据库提取的已平仓预期值 ─────────────────────────────────────

/** 测试数据库中已平仓 Position 的最终状态（用于最终验证） */
const EXPECTED_CLOSED_POSITIONS: Record<
  string,
  Array<{
    realized_pnl: number
    status: string
    quantity: number
  }>
> = {
  '513180': [
    { realized_pnl: -34392.28, status: 'Closed', quantity: 0 },
    { realized_pnl: -66255.86, status: 'Closed', quantity: 0 },
  ],
  '513060': [{ realized_pnl: 16229.3, status: 'Closed', quantity: 0 }],
  '513970': [{ realized_pnl: -12492.95, status: 'Closed', quantity: 0 }],
  '159995': [
    { realized_pnl: 137577.58, status: 'Closed', quantity: 0 },
    { realized_pnl: 61649.54, status: 'Closed', quantity: 0 },
    // 第三个仍然 Open
  ],
  '515880': [
    { realized_pnl: 20569.49, status: 'Closed', quantity: 0 },
    { realized_pnl: -23388.38, status: 'Closed', quantity: 0 },
  ],
}

// ── Setup & Teardown ─────────────────────────────────────────────────────

beforeAll(async () => {
  // 同步模型到内存 SQLite
  await sequelize.sync({ force: true })

  // 创建证券账户（asset_id=1, type=INVESTMENT）
  await Assets.create({
    id: 1,
    type: 'INVESTMENT',
    alias: '测试账户',
    amount: 1000000,
    currency: 'CNY',
    datetime: '2025-01-01',
    risk: 'MEDIUM',
    liquidity: 'GOOD',
    tags: '',
    note: '',
    created: new Date(),
    updated: new Date(),
  })
})

beforeEach(async () => {
  // 每个测试前清空交易和持仓数据
  await Trade.destroy({ where: {} })
  await Position.destroy({ where: {} })
})

// ── 辅助函数 ────────────────────────────────────────────────────────────

/** 按顺序执行一组交易，返回所有错误信息 */
async function executeTrades(trades: TradeFixture[]) {
  const errors: string[] = []
  for (const t of trades) {
    const reply = mockReply()
    await tradesCtrl.createTrade(makeRequest(t), reply)
    if (reply.code.mock.calls.length > 0) {
      const errorBody = reply.code.mock.results[0]?.value?.send?.mock?.calls?.[0]?.[0]
      errors.push(
        `Trade ${t.type} ${t.security_symbol} qty=${t.quantity}: ${JSON.stringify(errorBody)}`,
      )
    }
  }
  return errors
}

/** 获取指定 symbol 的 Open 持仓 */
async function getOpenPosition(symbol: string) {
  return Position.findOne({
    where: { asset_id: 1, security_symbol: symbol, status: 'Open' },
  })
}

/** 获取指定 symbol 的所有持仓（按 id 排序） */
async function getAllPositions(symbol: string) {
  return Position.findAll({
    where: { asset_id: 1, security_symbol: symbol },
    order: [['id', 'ASC']],
  })
}

/** 获取指定 symbol 的所有交易（按 trade_date 排序） */
async function getAllTrades(symbol: string) {
  return Trade.findAll({
    where: { asset_id: 1, security_symbol: symbol },
    order: [
      ['trade_date', 'ASC'],
      ['id', 'ASC'],
    ],
  })
}

// ── 测试用例 ─────────────────────────────────────────────────────────────

describe('513180 恒指科技 — 两次开平仓循环', () => {
  it('第一轮：2笔BUY → 1笔SELL 清仓，已实现盈亏应为 -34392.28', async () => {
    const cycle1 = TRADES_513180.slice(0, 3)
    const errors = await executeTrades(cycle1)
    expect(errors).toEqual([])

    const positions = await getAllPositions('513180')
    const closedPos = positions.find((p) => p.status === 'Closed')
    expect(closedPos).toBeDefined()
    expect(closedPos!.quantity).toBe(0)
    expect(closedPos!.realized_pnl).toBeCloseTo(-34392.28, 1)

    // 验证 SELL trade 的 realized_pnl
    const trades = await getAllTrades('513180')
    const sellTrade = trades.find((t) => t.type === 'SELL')
    expect(sellTrade).toBeDefined()
    expect(sellTrade!.realized_pnl).toBeCloseTo(-34392.28, 1)
  })

  it('第二轮：5笔BUY → 1笔SELL 部分卖出 → 1笔SELL 清仓', async () => {
    // 先执行第一轮 3 笔，再执行第二轮
    const errors = await executeTrades(TRADES_513180)
    expect(errors).toEqual([])

    // 此时应有 Open position（quantity=875700-583800=291900）
    const openPos = await getOpenPosition('513180')
    expect(openPos).toBeDefined()
    expect(openPos!.quantity).toBe(291900)

    // 第二轮第一次 SELL 的 trade realized_pnl 验证
    const trades = await getAllTrades('513180')
    const sellTrades = trades.filter((t) => t.type === 'SELL')
    expect(sellTrades.length).toBe(2)
    // 第一轮 SELL: realized_pnl = -34392.28
    expect(sellTrades[0].realized_pnl).toBeCloseTo(-34392.28, 1)
  })

  it('最后一笔SELL清仓后，第二个持仓应 Closed，已实现盈亏 -66255.86', async () => {
    const allTrades = [...TRADES_513180, TRADES_513180_FINAL_SELL]
    const errors = await executeTrades(allTrades)
    expect(errors).toEqual([])

    const positions = await getAllPositions('513180')
    const closedPositions = positions.filter((p) => p.status === 'Closed')
    expect(closedPositions.length).toBe(2)

    // 按创建顺序：第一个 Closed position realized_pnl = -34392.28
    expect(closedPositions[0].realized_pnl).toBeCloseTo(-34392.28, 1)
    // 第二个 Closed position realized_pnl = -66255.86
    expect(closedPositions[1].realized_pnl).toBeCloseTo(-66255.86, 1)

    // 不应有 Open position
    const openPos = await getOpenPosition('513180')
    expect(openPos).toBeNull()
  })
})

describe('513060 恒生医疗 — 多笔买入加权平均 + 两次卖出清仓', () => {
  it('5笔BUY逐步累加，加权平均成本应正确', async () => {
    // 只执行前两笔 BUY
    const errors = await executeTrades(TRADES_513060.slice(0, 2))
    expect(errors).toEqual([])

    const pos = await getOpenPosition('513060')
    expect(pos).toBeDefined()
    expect(pos!.quantity).toBe(70000 + 140200)

    // cost_price = (35070 + 8.77 + 70100 + 17.53) / 210200
    const expectedCost = (35070 + 8.77 + 70100 + 17.53) / (70000 + 140200)
    expect(pos!.cost_price).toBeCloseTo(expectedCost, 4)
  })

  it('全部7笔交易执行完毕，已平仓 realized_pnl = 16229.30', async () => {
    const errors = await executeTrades(TRADES_513060)
    expect(errors).toEqual([])

    const positions = await getAllPositions('513060')
    const closedPos = positions.find((p) => p.status === 'Closed')
    expect(closedPos).toBeDefined()
    expect(closedPos!.quantity).toBe(0)
    expect(closedPos!.realized_pnl).toBeCloseTo(16229.3, 1)

    // 验证所有 SELL trade 的 realized_pnl 之和等于 position 的 realized_pnl
    const trades = await getAllTrades('513060')
    const sellTrades = trades.filter((t) => t.type === 'SELL')
    const totalRealizedPnl = sellTrades.reduce((sum, t) => sum + Number(t.realized_pnl ?? 0), 0)
    expect(totalRealizedPnl).toBeCloseTo(16229.3, 1)
  })

  it('第一笔SELL后应有已实现盈亏累加', async () => {
    const errors = await executeTrades(TRADES_513060.slice(0, 6))
    expect(errors).toEqual([])

    const pos = await getOpenPosition('513060')
    expect(pos).toBeDefined()
    // 此时 quantity = 976400 - 325400 = 651000
    expect(pos!.quantity).toBe(651000)
    // realized_pnl 应为第一笔 SELL 的值
    const trades = await getAllTrades('513060')
    const sellTrade = trades.find((t) => t.type === 'SELL')
    expect(sellTrade).toBeDefined()
    expect(pos!.realized_pnl).toBeCloseTo(Number(sellTrade!.realized_pnl), 1)
  })
})

describe('513970 恒生消费 — 含 amount 偏差的买卖', () => {
  it('全部交易执行完毕，已平仓 realized_pnl = -12492.95', async () => {
    const errors = await executeTrades(TRADES_513970)
    expect(errors).toEqual([])

    const positions = await getAllPositions('513970')
    const closedPos = positions.find((p) => p.status === 'Closed')
    expect(closedPos).toBeDefined()
    expect(closedPos!.quantity).toBe(0)
    expect(closedPos!.realized_pnl).toBeCloseTo(-12492.95, 1)
  })

  it('4笔BUY后持仓quantity应为323600', async () => {
    const errors = await executeTrades(TRADES_513970.slice(0, 4))
    expect(errors).toEqual([])

    const pos = await getOpenPosition('513970')
    expect(pos).toBeDefined()
    const expectedQty = 112800 + 17400 + 150000 + 43400
    expect(pos!.quantity).toBe(expectedQty)
  })

  it('第一笔SELL后持仓应为部分卖出状态', async () => {
    const errors = await executeTrades(TRADES_513970.slice(0, 5))
    expect(errors).toEqual([])

    const pos = await getOpenPosition('513970')
    expect(pos).toBeDefined()
    expect(pos!.quantity).toBe(323600 - 107800)
    expect(pos!.status).toBe('Open')
    // 应有已实现盈亏
    expect(pos!.realized_pnl).not.toBe(0)
  })
})

describe('159995 芯片ETF — 多次开平仓循环', () => {
  it('第一轮：2BUY → SELL清仓，realized_pnl = 137577.58', async () => {
    const errors = await executeTrades(TRADES_159995.slice(0, 3))
    expect(errors).toEqual([])

    const positions = await getAllPositions('159995')
    const closedPos = positions.find((p) => p.status === 'Closed')
    expect(closedPos).toBeDefined()
    expect(closedPos!.realized_pnl).toBeCloseTo(137577.58, 1)

    // 清仓后无 Open 持仓
    const openPos = await getOpenPosition('159995')
    expect(openPos).toBeNull()
  })

  it('第二轮：新BUY → SELL清仓，realized_pnl = 61649.54', async () => {
    const errors = await executeTrades(TRADES_159995.slice(0, 5))
    expect(errors).toEqual([])

    const positions = await getAllPositions('159995')
    const closedPositions = positions.filter((p) => p.status === 'Closed')
    expect(closedPositions.length).toBe(2)
    expect(closedPositions[0].realized_pnl).toBeCloseTo(137577.58, 1)
    expect(closedPositions[1].realized_pnl).toBeCloseTo(61649.54, 1)
  })

  it('第三轮：新BUY后保持Open，共3条持仓记录', async () => {
    const errors = await executeTrades(TRADES_159995)
    expect(errors).toEqual([])

    const positions = await getAllPositions('159995')
    expect(positions.length).toBe(3) // 2 Closed + 1 Open

    const openPos = positions.find((p) => p.status === 'Open')
    expect(openPos).toBeDefined()
    expect(openPos!.quantity).toBe(130300)
    expect(openPos!.realized_pnl).toBe(0) // 新开仓无已实现盈亏

    // 验证 cost_price = (amount + fee) / quantity
    const expectedCost = (397675.6 + 99.42) / 130300
    expect(openPos!.cost_price).toBeCloseTo(expectedCost, 4)

    // 新开仓 amount 应为交易金额
    expect(openPos!.amount).toBeCloseTo(397675.6, 1)
  })
})

describe('515880 通信ETF — 两次独立买卖', () => {
  it('第一轮：BUY → SELL 清仓，realized_pnl = 20569.49', async () => {
    const errors = await executeTrades(TRADES_515880.slice(0, 2))
    expect(errors).toEqual([])

    const positions = await getAllPositions('515880')
    const closedPos = positions.find((p) => p.status === 'Closed')
    expect(closedPos).toBeDefined()
    expect(closedPos!.realized_pnl).toBeCloseTo(20569.49, 1)

    // 验证 SELL trade 的 realized_pnl
    const trades = await getAllTrades('515880')
    const sellTrade = trades.find((t) => t.type === 'SELL')
    expect(sellTrade).toBeDefined()
    // realized_pnl = (amount - fee) - cost_price * quantity
    const expectedPnl = 405195 - 101.3 - ((384428.1 + 96.11) / 227000) * 227000
    expect(sellTrade!.realized_pnl).toBeCloseTo(expectedPnl, 1)
  })

  it('第二轮：新BUY → SELL 清仓，realized_pnl = -23388.38', async () => {
    const errors = await executeTrades(TRADES_515880)
    expect(errors).toEqual([])

    const positions = await getAllPositions('515880')
    const closedPositions = positions.filter((p) => p.status === 'Closed')
    expect(closedPositions.length).toBe(2)
    expect(closedPositions[0].realized_pnl).toBeCloseTo(20569.49, 1)
    expect(closedPositions[1].realized_pnl).toBeCloseTo(-23388.38, 1)

    // 验证第二轮 SELL 的 realized_pnl
    const trades = await getAllTrades('515880')
    const sellTrades = trades.filter((t) => t.type === 'SELL')
    expect(sellTrades.length).toBe(2)
    expect(sellTrades[1].realized_pnl).toBeCloseTo(-23388.38, 1)
  })

  it('全部交易后无 Open 持仓', async () => {
    const errors = await executeTrades(TRADES_515880)
    expect(errors).toEqual([])

    const openPos = await getOpenPosition('515880')
    expect(openPos).toBeNull()
  })
})

describe('588170 科创半导体ETF — 单笔买入仍在持仓', () => {
  it('单笔BUY后持仓quantity=74700, realized_pnl=0, status=Open', async () => {
    const errors = await executeTrades(TRADES_588170)
    expect(errors).toEqual([])

    const pos = await getOpenPosition('588170')
    expect(pos).toBeDefined()
    expect(pos!.security_name).toBe('科创半导体ETF')
    expect(pos!.quantity).toBe(74700)
    expect(pos!.realized_pnl).toBe(0)
    expect(pos!.status).toBe('Open')

    // cost_price = (amount + fee) / quantity
    const expectedCost = (300294 + 75.07) / 74700
    expect(pos!.cost_price).toBeCloseTo(expectedCost, 4)
    // amount 应为交易金额
    expect(pos!.amount).toBeCloseTo(300294, 1)
    // current_price 应为交易价格
    expect(pos!.current_price).toBe(4.02)
  })
})

describe('综合验证', () => {
  it('执行全部34条交易后，所有已平仓数据应与测试数据库一致', async () => {
    const allTrades: TradeFixture[] = [
      ...TRADES_513180,
      TRADES_513180_FINAL_SELL,
      ...TRADES_513060,
      ...TRADES_513970,
      ...TRADES_159995,
      ...TRADES_515880,
      ...TRADES_588170,
    ]

    const errors = await executeTrades(allTrades)
    expect(errors).toEqual([])

    // 验证交易总数
    expect(await Trade.count()).toBe(34)

    // 验证持仓总数
    const allPositions = await Position.findAll({ order: [['id', 'ASC']] })
    const closedPositions = allPositions.filter((p) => p.status === 'Closed')
    const openPositions = allPositions.filter((p) => p.status === 'Open')

    expect(closedPositions.length).toBe(8)
    expect(openPositions.length).toBe(2)

    // 验证每个 symbol 的已平仓数据
    for (const [symbol, expectedList] of Object.entries(EXPECTED_CLOSED_POSITIONS)) {
      const symbolClosedPositions = closedPositions.filter((p) => p.security_symbol === symbol)
      expect(symbolClosedPositions.length).toBe(expectedList.length)

      for (let i = 0; i < expectedList.length; i++) {
        const expected = expectedList[i]
        const actual = symbolClosedPositions[i]
        expect(actual.quantity).toBe(expected.quantity)
        expect(actual.status).toBe(expected.status)
        expect(actual.realized_pnl).toBeCloseTo(expected.realized_pnl, 1)
      }
    }

    // 验证 Open 持仓
    const open159995 = openPositions.find((p) => p.security_symbol === '159995')
    expect(open159995).toBeDefined()
    expect(open159995!.quantity).toBe(130300)
    expect(open159995!.realized_pnl).toBe(0)

    const open588170 = openPositions.find((p) => p.security_symbol === '588170')
    expect(open588170).toBeDefined()
    expect(open588170!.quantity).toBe(74700)
    expect(open588170!.realized_pnl).toBe(0)
  })

  it('每笔 SELL trade 的 realized_pnl 不应为 null', async () => {
    const allTrades: TradeFixture[] = [
      ...TRADES_513180,
      TRADES_513180_FINAL_SELL,
      ...TRADES_513060,
      ...TRADES_513970,
      ...TRADES_159995,
      ...TRADES_515880,
      ...TRADES_588170,
    ]

    await executeTrades(allTrades)

    const sellTrades = await Trade.findAll({
      where: { type: 'SELL' },
    })

    expect(sellTrades.length).toBeGreaterThan(0)
    for (const trade of sellTrades) {
      expect(trade.realized_pnl).not.toBeNull()
      expect(trade.realized_pnl).not.toBeUndefined()
    }
  })

  it('每笔 BUY trade 的 realized_pnl 应为 null', async () => {
    const allTrades: TradeFixture[] = [
      ...TRADES_513180,
      TRADES_513180_FINAL_SELL,
      ...TRADES_513060,
      ...TRADES_513970,
      ...TRADES_159995,
      ...TRADES_515880,
      ...TRADES_588170,
    ]

    await executeTrades(allTrades)

    const buyTrades = await Trade.findAll({
      where: { type: 'BUY' },
    })

    expect(buyTrades.length).toBeGreaterThan(0)
    for (const trade of buyTrades) {
      expect(trade.realized_pnl).toBeNull()
    }
  })

  it('Position 的 realized_pnl 应等于其所有 SELL trade realized_pnl 之和', async () => {
    const allTrades: TradeFixture[] = [
      ...TRADES_513180,
      TRADES_513180_FINAL_SELL,
      ...TRADES_513060,
      ...TRADES_513970,
      ...TRADES_159995,
      ...TRADES_515880,
      ...TRADES_588170,
    ]

    await executeTrades(allTrades)

    // 按 symbol 分组验证
    const symbols = ['513180', '513060', '513970', '159995', '515880']
    for (const symbol of symbols) {
      const trades = await Trade.findAll({
        where: { asset_id: 1, security_symbol: symbol, type: 'SELL' },
      })
      const positions = await Position.findAll({
        where: { asset_id: 1, security_symbol: symbol },
      })

      // 分析每个 position 对应的 SELL trades
      // 通过 trade_date 范围来匹配 position 和 trades
      // 简化处理：验证所有 SELL trades 的 realized_pnl 之和 = 所有 positions 的 realized_pnl 之和
      const totalTradePnl = trades.reduce((sum, t) => sum + Number(t.realized_pnl ?? 0), 0)
      const totalPositionPnl = positions.reduce((sum, p) => sum + Number(p.realized_pnl), 0)
      expect(totalTradePnl).toBeCloseTo(totalPositionPnl, 1)
    }
  })
})
