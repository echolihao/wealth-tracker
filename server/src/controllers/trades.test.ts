import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Op } from 'sequelize'

// ── Mock modules before any imports ──────────────────────────────────────────
// vi.mock factories are hoisted; vi.hoisted() values are hoisted even higher,
// so they are available inside vi.mock factories.

const mockSequelizeTransaction = vi.hoisted(() => vi.fn())

vi.mock('../models', () => ({
  sequelize: {
    transaction: mockSequelizeTransaction,
  },
}))

const mockAssetsFindAll = vi.hoisted(() => vi.fn())
const mockAssetsFindByPk = vi.hoisted(() => vi.fn())

vi.mock('../models/assets', () => ({
  Assets: {
    findAll: mockAssetsFindAll,
    findByPk: mockAssetsFindByPk,
  },
}))

const mockPositionFindAll = vi.hoisted(() => vi.fn())
const mockPositionFindOne = vi.hoisted(() => vi.fn())
const mockPositionUpdate = vi.hoisted(() => vi.fn())
const mockPositionCreate = vi.hoisted(() => vi.fn())
const mockPositionDestroy = vi.hoisted(() => vi.fn())

vi.mock('../models/positions', () => ({
  Position: {
    findAll: mockPositionFindAll,
    findOne: mockPositionFindOne,
    update: mockPositionUpdate,
    create: (...args: any[]) => mockPositionCreate(...args),
    destroy: (...args: any[]) => mockPositionDestroy(...args),
  },
}))

const mockTradeFindAndCountAll = vi.hoisted(() => vi.fn())
const mockTradeCreate = vi.hoisted(() => vi.fn())
const mockTradeFindByPk = vi.hoisted(() => vi.fn())
const mockTradeUpdate = vi.hoisted(() => vi.fn())
const mockTradeDestroy = vi.hoisted(() => vi.fn())

vi.mock('../models/trades', () => ({
  Trade: {
    findAndCountAll: mockTradeFindAndCountAll,
    create: mockTradeCreate,
    findByPk: mockTradeFindByPk,
    update: mockTradeUpdate,
    destroy: mockTradeDestroy,
  },
}))

// ── Import the module under test AFTER mocks are set up ──────────────────────

import * as tradesCtrl from './trades'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockReply() {
  const send = vi.fn().mockReturnValue(undefined)
  const code = vi.fn().mockReturnValue({ send })
  return { send, code }
}

function makePositionInstance(overrides: Record<string, any> = {}) {
  const instance: any = {
    id: 1,
    realized_pnl: 0,
    ...overrides,
    update: vi.fn().mockImplementation(function (this: any, data: any) {
      Object.assign(this, data)
      return Promise.resolve(this)
    }),
  }
  return instance
}

function makeTradeInstance(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    asset_id: 1,
    security_symbol: 'AAPL',
    security_name: 'Apple Inc.',
    type: 'BUY',
    quantity: 10,
    price: 150,
    amount: 1500,
    trade_date: '2024-01-15',
    note: '',
    created: new Date('2024-01-15'),
    ...overrides,
  }
}

const mockT = { id: 'mock-transaction' }

/** Default: sequelize.transaction executes callback with mock transaction */
function defaultTransactionImpl(cb: (t: any) => Promise<any>) {
  return cb(mockT)
}

beforeEach(() => {
  // Use resetAllMocks instead of clearAllMocks to also clear
  // mockResolvedValueOnce / mockImplementationOnce stacks that leak
  // between tests.
  vi.resetAllMocks()
  mockSequelizeTransaction.mockImplementation(defaultTransactionImpl)
  // Position.create 在 applyTradeEffect 中被调用，需要返回有 id 的对象
  mockPositionCreate.mockResolvedValue(makePositionInstance({ id: 1 }))
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getSecuritiesAccounts', () => {
  it('should return INVESTMENT type accounts', async () => {
    const accounts = [
      { type: 'INVESTMENT', alias: 'IBKR', amount: 10000 },
      { type: 'INVESTMENT', alias: 'Binance', amount: 5000 },
    ]
    mockAssetsFindAll.mockResolvedValue(accounts)
    const reply = mockReply()

    await tradesCtrl.getSecuritiesAccounts({} as any, reply)

    expect(mockAssetsFindAll).toHaveBeenCalledWith({
      where: { type: 'INVESTMENT' },
    })
    expect(reply.send).toHaveBeenCalledWith(accounts)
  })

  it('should handle errors', async () => {
    mockAssetsFindAll.mockRejectedValue(new Error('DB error'))
    const reply = mockReply()

    await tradesCtrl.getSecuritiesAccounts({} as any, reply)

    expect(reply.code).toHaveBeenCalledWith(400)
    expect(reply.code().send).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'DB error',
    })
  })
})

describe('getPositions', () => {
  it('should return positions for an asset id', async () => {
    const positions = [
      { asset_id: 1, security_symbol: 'AAPL' },
    ]
    mockPositionFindAll.mockResolvedValue(positions)
    const reply = mockReply()

    await tradesCtrl.getPositions(
      { params: { id: 1 } } as any,
      reply,
    )

    expect(mockPositionFindAll).toHaveBeenCalledWith({
      where: { asset_id: 1 },
      order: [['created', 'ASC']],
    })
    expect(reply.send).toHaveBeenCalledWith(positions)
  })

  it('should handle errors', async () => {
    mockPositionFindAll.mockRejectedValue(new Error('Query failed'))
    const reply = mockReply()

    await tradesCtrl.getPositions(
      { params: { id: 1 } } as any,
      reply,
    )

    expect(reply.code).toHaveBeenCalledWith(400)
  })
})

describe('updatePositionPrice', () => {
  const defaultRequest = {
    params: { id: 1, symbol: 'AAPL' },
    body: { current_price: 160, amount: 1600 },
  }

  it('should update position price and amount', async () => {
    const pos = makePositionInstance({
      asset_id: 1,
      security_symbol: 'AAPL',
      quantity: 10,
      cost_price: 150,
      current_price: 150,
      amount: 1500,
    })
    mockPositionFindOne.mockResolvedValueOnce(pos)
    mockPositionFindOne.mockResolvedValueOnce(pos) // second findOne after update
    const reply = mockReply()

    await tradesCtrl.updatePositionPrice(defaultRequest as any, reply)

    expect(mockPositionFindOne).toHaveBeenCalledTimes(2)
    expect(mockPositionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        current_price: 160,
        amount: 1600,
      }),
      expect.anything(),
    )
    expect(reply.send).toHaveBeenCalledWith(pos)
  })

  it('should only update amount when current_price is omitted', async () => {
    const req = {
      params: { id: 1, symbol: 'AAPL' },
      body: { amount: 2000 },
    }
    const pos = makePositionInstance({
      asset_id: 1,
      security_symbol: 'AAPL',
    })
    mockPositionFindOne.mockResolvedValue(pos)
    const reply = mockReply()

    await tradesCtrl.updatePositionPrice(req as any, reply)

    // Position.update (static) should not include current_price
    expect(mockPositionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2000 }),
      expect.anything(),
    )
    const updateData = mockPositionUpdate.mock.calls[0][0]
    expect(updateData).not.toHaveProperty('current_price')
  })

  it('should throw 400 when position is not found', async () => {
    mockPositionFindOne.mockResolvedValue(null)
    const reply = mockReply()

    await tradesCtrl.updatePositionPrice(defaultRequest as any, reply)

    expect(reply.code).toHaveBeenCalledWith(400)
    expect(reply.code().send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Position not found.' }),
    )
  })

  it('should handle errors', async () => {
    mockPositionFindOne.mockRejectedValue(new Error('DB failure'))
    const reply = mockReply()

    await tradesCtrl.updatePositionPrice(defaultRequest as any, reply)

    expect(reply.code).toHaveBeenCalledWith(400)
    expect(reply.code().send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'DB failure' }),
    )
  })
})

describe('getTrades', () => {
  it('should return paginated trades (query params are strings)', async () => {
    const rows = [
      makeTradeInstance({ id: 1 }),
      makeTradeInstance({ id: 2 }),
    ]
    mockTradeFindAndCountAll.mockResolvedValue({ count: 20, rows })
    const reply = mockReply()

    await tradesCtrl.getTrades(
      {
        params: { id: 1 },
        query: { page: '2', size: '5' },
      } as any,
      reply,
    )

    // query params arrive as strings; controller passes them directly
    expect(mockTradeFindAndCountAll).toHaveBeenCalledWith({
      where: { asset_id: 1 },
      order: [['trade_date', 'DESC'], ['created', 'DESC']],
      offset: 5,
      limit: '5',
    })
    expect(reply.send).toHaveBeenCalledWith({
      total: 20,
      page: 2,
      size: 5,
      data: rows,
    })
  })

  it('should use default page and size when not provided', async () => {
    mockTradeFindAndCountAll.mockResolvedValue({ count: 0, rows: [] })
    const reply = mockReply()

    await tradesCtrl.getTrades(
      {
        params: { id: 1 },
        query: {},
      } as any,
      reply,
    )

    expect(mockTradeFindAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0, limit: 10 }),
    )
  })

  it('should handle errors', async () => {
    mockTradeFindAndCountAll.mockRejectedValue(new Error('Query error'))
    const reply = mockReply()

    await tradesCtrl.getTrades(
      { params: { id: 1 }, query: {} } as any,
      reply,
    )

    expect(reply.code).toHaveBeenCalledWith(400)
  })

  it('should filter by type parameter', async () => {
    mockTradeFindAndCountAll.mockResolvedValue({ count: 1, rows: [{ id: 1, type: 'BUY' }] })
    const reply = mockReply()

    await tradesCtrl.getTrades(
      {
        params: { id: 1 },
        query: { page: '1', size: '10', type: 'BUY' },
      } as any,
      reply,
    )

    expect(mockTradeFindAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'BUY' }),
      }),
    )
  })

  it('should filter by symbol parameter (like search)', async () => {
    mockTradeFindAndCountAll.mockResolvedValue({ count: 1, rows: [{ id: 1, security_symbol: 'AAPL' }] })
    const reply = mockReply()

    await tradesCtrl.getTrades(
      {
        params: { id: 1 },
        query: { page: '1', size: '10', symbol: 'AAPL' },
      } as any,
      reply,
    )

    const call = mockTradeFindAndCountAll.mock.calls[0][0]
    const securitySymbolFilter = call.where.security_symbol
    expect(securitySymbolFilter).toBeDefined()
    // Op.like should be '%AAPL%'
    const likeVal = securitySymbolFilter[Op.like]
    expect(likeVal).toBe('%AAPL%')
  })
})

describe('createTrade', () => {
  const validBody = {
    type: 'BUY',
    security_symbol: 'AAPL',
    security_name: 'Apple Inc.',
    quantity: 10,
    price: 150,
    amount: 1500,
    trade_date: '2024-01-15',
  }

  function makeRequest(overrides: Record<string, any> = {}) {
    return {
      params: { id: 1 },
      body: { ...validBody, ...overrides },
    }
  }

  describe('validation', () => {
    it('should reject missing asset id', async () => {
      const req = { params: {}, body: validBody }
      const reply = mockReply()

      await tradesCtrl.createTrade(req as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Asset id is required.' }),
      )
    })

    it('should reject non-securities account', async () => {
      mockAssetsFindByPk.mockResolvedValue({ id: 2, type: 'CASH' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest() as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid securities account type.' }),
      )
    })

    it('should reject missing trade type', async () => {
      mockAssetsFindByPk.mockResolvedValue({ id: 1, type: 'INVESTMENT' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ type: '' }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Trade type must be BUY or SELL.' }),
      )
    })

    it('should reject invalid trade type', async () => {
      mockAssetsFindByPk.mockResolvedValue({ id: 1, type: 'INVESTMENT' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ type: 'HOLD' }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Trade type must be BUY or SELL.' }),
      )
    })

    it('should reject missing security symbol', async () => {
      mockAssetsFindByPk.mockResolvedValue({ id: 1, type: 'INVESTMENT' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ security_symbol: '' }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Security symbol and name are required.' }),
      )
    })

    it('should reject non-positive quantity', async () => {
      mockAssetsFindByPk.mockResolvedValue({ id: 1, type: 'INVESTMENT' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ quantity: 0 }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Quantity must be a positive number.' }),
      )
    })

    it('should reject non-positive price', async () => {
      mockAssetsFindByPk.mockResolvedValue({ id: 1, type: 'INVESTMENT' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ price: -1 }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Price must be a positive number.' }),
      )
    })

    it('should allow amount that differs from quantity × price (multi-fill execution)', async () => {
      mockAssetsFindByPk.mockResolvedValue({ id: 1, type: 'INVESTMENT' })
      const trade = makeTradeInstance()
      mockTradeCreate.mockResolvedValue(trade)
      mockPositionFindOne.mockResolvedValue(null)
      const reply = mockReply()

      // amount=1510 but qty×price=1500 — 10元偏差来自多笔成交
      await tradesCtrl.createTrade(makeRequest({ amount: 1510 }) as any, reply)

      // 不应报错，应正常创建
      expect(reply.send).toHaveBeenCalledWith(trade)
      // 成本价应基于实际 amount: (1510 + 0) / 10 = 151
      expect(mockPositionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          cost_price: 151,
          amount: 1510,
        }),
        { transaction: mockT },
      )
    })

    it('should reject missing trade date', async () => {
      mockAssetsFindByPk.mockResolvedValue({ id: 1, type: 'INVESTMENT' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ trade_date: '' }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Trade date is required.' }),
      )
    })
  })

  describe('trade execution', () => {
    beforeEach(() => {
      mockAssetsFindByPk.mockResolvedValue({ id: 1, type: 'INVESTMENT' })
    })

    it('should create a BUY trade and a new position', async () => {
      const trade = makeTradeInstance()
      mockTradeCreate.mockResolvedValue(trade)
      mockPositionFindOne.mockResolvedValue(null)
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest() as any, reply)

      expect(mockTradeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          asset_id: 1,
          security_symbol: 'AAPL',
          type: 'BUY',
          quantity: 10,
          price: 150,
          amount: 1500,
        }),
        { transaction: mockT },
      )
      expect(mockPositionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          asset_id: 1,
          security_symbol: 'AAPL',
          quantity: 10,
          cost_price: 150,
          current_price: 150,
          amount: 1500,
          status: 'Open',
        }),
        { transaction: mockT },
      )
      expect(reply.send).toHaveBeenCalledWith(trade)
    })

    it('should update existing position on BUY with weighted average cost', async () => {
      const existingPos = makePositionInstance({
        asset_id: 1,
        security_symbol: 'AAPL',
        quantity: 5,
        cost_price: 140,
        current_price: 145,
        amount: 725,
        status: 'Open',
      })
      mockTradeCreate.mockResolvedValue(makeTradeInstance())
      mockPositionFindOne.mockResolvedValue(existingPos)
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest() as any, reply)

      expect(existingPos.update).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 15,
          cost_price: (5 * 140 + 10 * 150) / 15,
          amount: 15 * 145,
          status: 'Open',
        }),
        { transaction: mockT },
      )
    })

    it('should use actual amount for weighted average cost when amount ≠ qty × price', async () => {
      const existingPos = makePositionInstance({
        asset_id: 1,
        security_symbol: 'AAPL',
        quantity: 5,
        cost_price: 140,
        current_price: 145,
        amount: 725,
        status: 'Open',
      })
      mockTradeCreate.mockResolvedValue(makeTradeInstance())
      mockPositionFindOne.mockResolvedValue(existingPos)
      const reply = mockReply()

      // amount=1510, qty=10, price=150 → qty×price=1500, 偏差10
      await tradesCtrl.createTrade(makeRequest({ amount: 1510 }) as any, reply)

      // newCost = (5*140 + 1510 + 0) / 15 = (700 + 1510) / 15 = 147.33...
      const expectedCost = (5 * 140 + 1510) / 15
      expect(existingPos.update).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 15,
          cost_price: expectedCost,
        }),
        { transaction: mockT },
      )
    })

    it('should handle SELL trade', async () => {
      const trade = makeTradeInstance({ type: 'SELL' })
      const existingPos = makePositionInstance({
        asset_id: 1,
        security_symbol: 'AAPL',
        quantity: 15,
        cost_price: 140,
        current_price: 160,
        amount: 2400,
        status: 'Open',
      })
      mockTradeCreate.mockResolvedValue(trade)
      mockPositionFindOne.mockResolvedValue(existingPos)
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ type: 'SELL' }) as any, reply)

      expect(existingPos.update).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 5,
          amount: 5 * 160,
          updated: expect.any(Date),
        }),
        { transaction: mockT },
      )
    })

    it('should track realized_pnl on SELL trade record', async () => {
      const trade = makeTradeInstance({ type: 'SELL' })
      const existingPos = makePositionInstance({
        asset_id: 1,
        security_symbol: 'AAPL',
        quantity: 15,
        cost_price: 140,
        current_price: 160,
        amount: 2400,
        status: 'Open',
      })
      mockTradeCreate.mockResolvedValue(trade)
      mockPositionFindOne.mockResolvedValue(existingPos)
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ type: 'SELL' }) as any, reply)

      // Trade record should store realized_pnl = (sell_price - cost_price) * qty
      expect(mockTradeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          realized_pnl: (150 - 140) * 10,
        }),
        { transaction: mockT },
      )
    })

    it('should update position realized_pnl on SELL', async () => {
      const trade = makeTradeInstance({ type: 'SELL' })
      const existingPos = makePositionInstance({
        asset_id: 1,
        security_symbol: 'AAPL',
        quantity: 15,
        cost_price: 140,
        current_price: 160,
        amount: 2400,
        status: 'Open',
        realized_pnl: 50,
      })
      mockTradeCreate.mockResolvedValue(trade)
      mockPositionFindOne.mockResolvedValue(existingPos)
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ type: 'SELL' }) as any, reply)

      // Position realized_pnl should accumulate: 50 + (150 - 140) * 10 = 150
      expect(existingPos.update).toHaveBeenCalledWith(
        expect.objectContaining({
          realized_pnl: 150,
        }),
        { transaction: mockT },
      )
    })

    it('should calculate realized_pnl from actual amount on SELL when amount ≠ qty × price', async () => {
      const existingPos = makePositionInstance({
        asset_id: 1,
        security_symbol: 'AAPL',
        quantity: 15,
        cost_price: 140,
        current_price: 160,
        amount: 2400,
        status: 'Open',
      })
      mockTradeCreate.mockResolvedValue(makeTradeInstance({ type: 'SELL' }))
      mockPositionFindOne.mockResolvedValue(existingPos)
      const reply = mockReply()

      // amount=1590, qty=10, price=160 → qty×price=1600, 偏差-10（实际卖出均价更低）
      await tradesCtrl.createTrade(
        makeRequest({ type: 'SELL', amount: 1590 }) as any,
        reply,
      )

      // realizedPnl = (1590 - 0) - 140*10 = 1590 - 1400 = 190
      expect(mockTradeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          realized_pnl: 190,
        }),
        { transaction: mockT },
      )
    })

    it('should set realized_pnl to null on BUY trade record', async () => {
      const trade = makeTradeInstance()
      mockTradeCreate.mockResolvedValue(trade)
      mockPositionFindOne.mockResolvedValue(null)
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest() as any, reply)

      expect(mockTradeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          realized_pnl: null,
        }),
        { transaction: mockT },
      )
    })

    it('should close position when SELL depletes quantity to zero', async () => {
      const existingPos = makePositionInstance({
        quantity: 10,
        cost_price: 150,
        current_price: 160,
        amount: 1600,
        status: 'Open',
      })
      mockTradeCreate.mockResolvedValue(makeTradeInstance({ type: 'SELL' }))
      mockPositionFindOne.mockResolvedValue(existingPos)
      const reply = mockReply()

      await tradesCtrl.createTrade(
        makeRequest({ type: 'SELL', quantity: 10, amount: 1500 }) as any,
        reply,
      )

      expect(existingPos.update).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 0,
          status: 'Closed',
          amount: 0,
        }),
        { transaction: mockT },
      )
    })

    it('should reject SELL with insufficient quantity', async () => {
      const existingPos = makePositionInstance({ quantity: 3 })

      mockTradeCreate.mockResolvedValue(makeTradeInstance({ type: 'SELL' }))
      mockPositionFindOne.mockResolvedValue(existingPos)
      const reply = mockReply()

      await tradesCtrl.createTrade(
        makeRequest({ type: 'SELL', quantity: 10, amount: 1500 }) as any,
        reply,
      )

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Insufficient quantity'),
        }),
      )
    })

    it('should reject SELL when position does not exist', async () => {
      mockTradeCreate.mockResolvedValue(makeTradeInstance({ type: 'SELL' }))
      mockPositionFindOne.mockResolvedValue(null)
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ type: 'SELL' }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Position not found for sell.' }),
      )
    })

    it('should create a new position when BUY on a symbol with only Closed positions', async () => {
      mockTradeCreate.mockResolvedValue(makeTradeInstance())
      // No Open position found (Closed positions are not returned)
      mockPositionFindOne.mockResolvedValue(null)
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ price: 180, amount: 1800 }) as any, reply)

      // Should create a fresh position record
      expect(mockPositionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          asset_id: 1,
          security_symbol: 'AAPL',
          quantity: 10,
          cost_price: 180,
          current_price: 180,
          amount: 1800,
          realized_pnl: 0,
          status: 'Open',
        }),
        { transaction: mockT },
      )
      // Old Closed position records are untouched
      expect(mockPositionDestroy).not.toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      mockPositionFindOne.mockRejectedValue(new Error('DB error'))
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest() as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'DB error' }),
      )
    })
  })
})

describe('updateTrade', () => {
  const oldTrade = makeTradeInstance({
    id: 1,
    asset_id: 1,
    type: 'BUY',
    security_symbol: 'AAPL',
    security_name: 'Apple Inc.',
    quantity: 10,
    price: 150,
    amount: 1500,
    trade_date: '2024-01-15',
  })

  const defaultRequest = {
    params: { id: '1' },
    body: {
      type: 'SELL',
      security_symbol: 'AAPL',
      security_name: 'Apple Inc.',
      quantity: 5,
      price: 160,
      amount: 800,
      trade_date: '2024-01-20',
    },
  }

  it('should update a trade by reversing old and applying new effect', async () => {
    const updatedTrade = { ...oldTrade, type: 'SELL', quantity: 5 }
    // Position quantity must survive reverseTradeEffect (reverse BUY 10 → qty drops)
    // AND still allow applyTradeEffect (apply SELL 5 → needs enough remaining)
    const existingPos = makePositionInstance({
      asset_id: 1,
      security_symbol: 'AAPL',
      quantity: 20,
      cost_price: 150,
      current_price: 150,
      amount: 3000,
      status: 'Open',
    })

    mockTradeFindByPk.mockResolvedValueOnce(oldTrade)
    mockTradeFindByPk.mockResolvedValueOnce(updatedTrade)
    mockPositionFindOne.mockResolvedValue(existingPos)
    const reply = mockReply()

    await tradesCtrl.updateTrade(defaultRequest as any, reply)

    expect(mockTradeFindByPk).toHaveBeenCalledTimes(2)
    expect(mockTradeUpdate).toHaveBeenCalled()
    expect(reply.send).toHaveBeenCalled()
  })

  it('should throw 400 when trade is not found', async () => {
    mockTradeFindByPk.mockResolvedValue(null)
    const reply = mockReply()

    await tradesCtrl.updateTrade(defaultRequest as any, reply)

    expect(reply.code).toHaveBeenCalledWith(400)
    expect(reply.code().send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Trade not found.' }),
    )
  })

  it('should handle errors', async () => {
    mockTradeFindByPk.mockRejectedValue(new Error('Update failed'))
    const reply = mockReply()

    await tradesCtrl.updateTrade(defaultRequest as any, reply)

    expect(reply.code).toHaveBeenCalledWith(400)
  })

  it('should use old trade values for omitted fields', async () => {
    const updatedTrade = { ...oldTrade }
    const existingPos = makePositionInstance({
      asset_id: 1,
      security_symbol: 'AAPL',
      quantity: 20,
      cost_price: 150,
      current_price: 150,
      amount: 3000,
    })

    mockTradeFindByPk.mockResolvedValueOnce(oldTrade)
    mockTradeFindByPk.mockResolvedValueOnce(updatedTrade)
    mockPositionFindOne.mockResolvedValue(existingPos)
    const reply = mockReply()

    await tradesCtrl.updateTrade(
      {
        params: { id: '1' },
        body: { type: 'SELL', quantity: 5 },
      } as any,
      reply,
    )

    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SELL',
        security_symbol: 'AAPL',
        quantity: 5,
        price: 150,
      }),
      expect.anything(),
    )
  })

  it('should recalculate realized_pnl on trade update for SELL', async () => {
    // Old trade: BUY 10 @ $150 (no realized_pnl since it's a buy)
    // New trade: SELL 5 @ $160
    // After reversing old BUY (10 @ $150), cost_price before new trade = 150
    // realized_pnl on trade record = (160 - 150) * 5 = 50
    const updatedTrade = {
      ...oldTrade,
      type: 'SELL',
      quantity: 5,
      price: 160,
    }
    const existingPos = makePositionInstance({
      asset_id: 1,
      security_symbol: 'AAPL',
      quantity: 20,
      cost_price: 150,
      current_price: 150,
      amount: 3000,
    })

    mockTradeFindByPk.mockResolvedValueOnce(oldTrade)
    mockTradeFindByPk.mockResolvedValueOnce(updatedTrade)
    mockPositionFindOne.mockResolvedValue(existingPos)
    const reply = mockReply()

    await tradesCtrl.updateTrade(
      {
        params: { id: '1' },
        body: {
          type: 'SELL',
          security_symbol: 'AAPL',
          security_name: 'Apple Inc.',
          quantity: 5,
          price: 160,
          amount: 800,
          trade_date: '2024-01-20',
        },
      } as any,
      reply,
    )

    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        realized_pnl: (160 - 150) * 5,
      }),
      expect.anything(),
    )
  })
})

describe('deleteTrade', () => {
  const trade = makeTradeInstance({
    id: 1,
    asset_id: 1,
    type: 'BUY',
    quantity: 10,
    price: 150,
  })

  it('should delete a trade and reverse its effect', async () => {
    const existingPos = makePositionInstance({
      asset_id: 1,
      security_symbol: 'AAPL',
      quantity: 15,
      cost_price: 145,
      current_price: 155,
      amount: 2325,
      status: 'Open',
    })

    mockTradeFindByPk.mockResolvedValue(trade)
    mockPositionFindOne.mockResolvedValue(existingPos)
    const reply = mockReply()

    await tradesCtrl.deleteTrade({ params: { id: '1' } } as any, reply)

    expect(existingPos.update).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 5,
        updated: expect.any(Date),
      }),
      { transaction: mockT },
    )
    expect(mockTradeDestroy).toHaveBeenCalledWith({
      where: { id: '1' },
      transaction: mockT,
    })
    expect(reply.send).toHaveBeenCalledWith({ result: true })
  })

  it('should throw 400 when trade is not found', async () => {
    mockTradeFindByPk.mockResolvedValue(null)
    const reply = mockReply()

    await tradesCtrl.deleteTrade({ params: { id: '999' } } as any, reply)

    expect(reply.code).toHaveBeenCalledWith(400)
    expect(reply.code().send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Trade not found.' }),
    )
  })

  it('should handle errors', async () => {
    mockTradeFindByPk.mockRejectedValue(new Error('Delete failed'))
    const reply = mockReply()

    await tradesCtrl.deleteTrade({ params: { id: '1' } } as any, reply)

    expect(reply.code).toHaveBeenCalledWith(400)
  })
})

describe('reverseTradeEffect (via deleteTrade)', () => {
  it('should reverse a BUY trade and restore weighted average cost', async () => {
    const existingPos = makePositionInstance({
      asset_id: 1,
      security_symbol: 'AAPL',
      quantity: 15,
      cost_price: 145,
      current_price: 155,
      amount: 2325,
      status: 'Open',
    })

    mockTradeFindByPk.mockResolvedValue(
      makeTradeInstance({ type: 'BUY', quantity: 10, price: 150 }),
    )
    mockPositionFindOne.mockResolvedValue(existingPos)
    const reply = mockReply()

    await tradesCtrl.deleteTrade({ params: { id: '1' } } as any, reply)

    expect(existingPos.update).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 5,
        cost_price: (15 * 145 - 1500) / 5, // = 135, 用 amount=1500 计算
        amount: 5 * 155,
      }),
      expect.anything(),
    )
  })

  it('should reverse a BUY and close position when quantity reaches zero', async () => {
    const existingPos = makePositionInstance({
      quantity: 10,
      cost_price: 150,
      current_price: 160,
      amount: 1600,
      status: 'Open',
    })

    mockTradeFindByPk.mockResolvedValue(
      makeTradeInstance({ type: 'BUY', quantity: 10, price: 150 }),
    )
    mockPositionFindOne.mockResolvedValue(existingPos)
    const reply = mockReply()

    await tradesCtrl.deleteTrade({ params: { id: '1' } } as any, reply)

    expect(existingPos.update).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 0,
        status: 'Closed',
        amount: 0,
      }),
      expect.anything(),
    )
  })

  it('should throw when reversing BUY would make quantity negative', async () => {
    const existingPos = makePositionInstance({ quantity: 3 })

    mockTradeFindByPk.mockResolvedValue(
      makeTradeInstance({ type: 'BUY', quantity: 10 }),
    )
    mockPositionFindOne.mockResolvedValue(existingPos)
    const reply = mockReply()

    await tradesCtrl.deleteTrade({ params: { id: '1' } } as any, reply)

    expect(reply.code).toHaveBeenCalledWith(400)
    expect(reply.code().send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Cannot reverse this trade'),
      }),
    )
  })

  it('should reverse a SELL trade, increase quantity and subtract realized_pnl', async () => {
    const existingPos = makePositionInstance({
      asset_id: 1,
      security_symbol: 'AAPL',
      quantity: 5,
      cost_price: 145,
      current_price: 155,
      amount: 775,
      status: 'Open',
      realized_pnl: 150,
    })

    mockTradeFindByPk.mockResolvedValue(
      makeTradeInstance({ type: 'SELL', quantity: 10, price: 160, realized_pnl: 100 }),
    )
    mockPositionFindOne.mockResolvedValue(existingPos)
    const reply = mockReply()

    await tradesCtrl.deleteTrade({ params: { id: '1' } } as any, reply)

    expect(existingPos.update).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 15,
        status: 'Open',
        amount: 15 * 155,
        realized_pnl: 50, // 150 - 100
      }),
      expect.anything(),
    )
  })

  it('should set realized_pnl when recreating position on SELL reversal', async () => {
    mockTradeFindByPk.mockResolvedValue(
      makeTradeInstance({ type: 'SELL', quantity: 10, price: 160, realized_pnl: 100 }),
    )
    mockPositionFindOne.mockResolvedValue(null)
    mockPositionCreate.mockResolvedValue(
      makePositionInstance({ quantity: 10 }),
    )
    const reply = mockReply()

    await tradesCtrl.deleteTrade({ params: { id: '1' } } as any, reply)

    expect(mockPositionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: 1,
        security_symbol: 'AAPL',
        quantity: 10,
        cost_price: 160,
        current_price: 160,
        amount: 1600,
        realized_pnl: -100, // reverse the realized P&L
        status: 'Open',
      }),
      { transaction: mockT },
    )
  })
})
