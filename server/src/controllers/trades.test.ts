import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock('../models/positions', () => ({
  Position: {
    findAll: mockPositionFindAll,
    findOne: mockPositionFindOne,
    update: mockPositionUpdate,
    create: (...args: any[]) => mockPositionCreate(...args),
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
    asset_type: 'securities:test',
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
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getSecuritiesAccounts', () => {
  it('should return securities accounts', async () => {
    const accounts = [
      { type: 'securities:ibkr', amount: 10000 },
      { type: 'securities:binance', amount: 5000 },
    ]
    mockAssetsFindAll.mockResolvedValue(accounts)
    const reply = mockReply()

    await tradesCtrl.getSecuritiesAccounts({} as any, reply)

    // Verify the find call includes Op.or with Op.startsWith — matching
    // Sequelize Symbol operators requires a flexible assertion
    expect(mockAssetsFindAll).toHaveBeenCalledTimes(1)
    const args = mockAssetsFindAll.mock.calls[0][0]
    expect(args).toHaveProperty('where')
    // Check the actual structure without relying on Symbol comparison
    const where = args.where
    const orClauses = where[Object.getOwnPropertySymbols(where)[0]]
    expect(Array.isArray(orClauses)).toBe(true)
    expect(orClauses).toHaveLength(2)

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
  it('should return positions for an asset type', async () => {
    const positions = [
      { asset_type: 'securities:ibkr', security_symbol: 'AAPL' },
    ]
    mockPositionFindAll.mockResolvedValue(positions)
    const reply = mockReply()

    await tradesCtrl.getPositions(
      { params: { assetType: 'securities:ibkr' } } as any,
      reply,
    )

    expect(mockPositionFindAll).toHaveBeenCalledWith({
      where: { asset_type: 'securities:ibkr' },
      order: [['created', 'ASC']],
    })
    expect(reply.send).toHaveBeenCalledWith(positions)
  })

  it('should handle errors', async () => {
    mockPositionFindAll.mockRejectedValue(new Error('Query failed'))
    const reply = mockReply()

    await tradesCtrl.getPositions(
      { params: { assetType: 'securities:ibkr' } } as any,
      reply,
    )

    expect(reply.code).toHaveBeenCalledWith(400)
  })
})

describe('updatePositionPrice', () => {
  const defaultRequest = {
    params: { assetType: 'securities:ibkr', symbol: 'AAPL' },
    body: { current_price: 160, amount: 1600 },
  }

  it('should update position price and amount', async () => {
    const pos = makePositionInstance({
      asset_type: 'securities:ibkr',
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
      params: { assetType: 'securities:ibkr', symbol: 'AAPL' },
      body: { amount: 2000 },
    }
    const pos = makePositionInstance({
      asset_type: 'securities:ibkr',
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
        params: { assetType: 'securities:ibkr' },
        query: { page: '2', size: '5' },
      } as any,
      reply,
    )

    // query params arrive as strings; controller passes them directly
    expect(mockTradeFindAndCountAll).toHaveBeenCalledWith({
      where: { asset_type: 'securities:ibkr' },
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
        params: { assetType: 'securities:ibkr' },
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
      { params: { assetType: 'securities:ibkr' }, query: {} } as any,
      reply,
    )

    expect(reply.code).toHaveBeenCalledWith(400)
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
      params: { assetType: 'securities:ibkr' },
      body: { ...validBody, ...overrides },
    }
  }

  describe('validation', () => {
    it('should reject missing asset type', async () => {
      const req = { params: {}, body: validBody }
      const reply = mockReply()

      await tradesCtrl.createTrade(req as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Asset type is required.' }),
      )
    })

    it('should reject non-securities account', async () => {
      mockAssetsFindByPk.mockResolvedValue({ type: 'cash', alias: null })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest() as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid securities account type.' }),
      )
    })

    it('should reject missing trade type', async () => {
      mockAssetsFindByPk.mockResolvedValue({ type: 'securities:ibkr' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ type: '' }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Trade type must be BUY or SELL.' }),
      )
    })

    it('should reject invalid trade type', async () => {
      mockAssetsFindByPk.mockResolvedValue({ type: 'securities:ibkr' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ type: 'HOLD' }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Trade type must be BUY or SELL.' }),
      )
    })

    it('should reject missing security symbol', async () => {
      mockAssetsFindByPk.mockResolvedValue({ type: 'securities:ibkr' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ security_symbol: '' }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Security symbol and name are required.' }),
      )
    })

    it('should reject non-positive quantity', async () => {
      mockAssetsFindByPk.mockResolvedValue({ type: 'securities:ibkr' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ quantity: 0 }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Quantity must be a positive number.' }),
      )
    })

    it('should reject non-positive price', async () => {
      mockAssetsFindByPk.mockResolvedValue({ type: 'securities:ibkr' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ price: -1 }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Price must be a positive number.' }),
      )
    })

    it('should reject amount that does not equal quantity × price', async () => {
      mockAssetsFindByPk.mockResolvedValue({ type: 'securities:ibkr' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ amount: 9999 }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Amount must equal quantity × price.' }),
      )
    })

    it('should reject missing trade date', async () => {
      mockAssetsFindByPk.mockResolvedValue({ type: 'securities:ibkr' })
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest({ trade_date: '' }) as any, reply)

      expect(reply.code).toHaveBeenCalledWith(400)
      expect(reply.code().send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Trade date is required.' }),
      )
    })

    it('should accept alias match for securities account', async () => {
      mockAssetsFindByPk.mockResolvedValue({
        type: 'investment',
        alias: 'securities:ibkr',
      })
      mockTradeCreate.mockResolvedValue(makeTradeInstance())
      mockPositionFindOne.mockResolvedValue(null)
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest() as any, reply)

      expect(reply.code).not.toHaveBeenCalledWith(400)
      expect(mockTradeCreate).toHaveBeenCalled()
    })
  })

  describe('trade execution', () => {
    beforeEach(() => {
      mockAssetsFindByPk.mockResolvedValue({ type: 'securities:ibkr' })
    })

    it('should create a BUY trade and a new position', async () => {
      const trade = makeTradeInstance()
      mockTradeCreate.mockResolvedValue(trade)
      mockPositionFindOne.mockResolvedValue(null)
      const reply = mockReply()

      await tradesCtrl.createTrade(makeRequest() as any, reply)

      expect(mockTradeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          asset_type: 'securities:ibkr',
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
          asset_type: 'securities:ibkr',
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
        asset_type: 'securities:ibkr',
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

    it('should handle SELL trade', async () => {
      const trade = makeTradeInstance({ type: 'SELL' })
      const existingPos = makePositionInstance({
        asset_type: 'securities:ibkr',
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

    it('should handle database errors', async () => {
      mockTradeCreate.mockRejectedValue(new Error('DB error'))
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
    asset_type: 'securities:ibkr',
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
      asset_type: 'securities:ibkr',
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
      asset_type: 'securities:ibkr',
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
})

describe('deleteTrade', () => {
  const trade = makeTradeInstance({
    id: 1,
    asset_type: 'securities:ibkr',
    type: 'BUY',
    quantity: 10,
    price: 150,
  })

  it('should delete a trade and reverse its effect', async () => {
    const existingPos = makePositionInstance({
      asset_type: 'securities:ibkr',
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
      asset_type: 'securities:ibkr',
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
        cost_price: 135,
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

  it('should reverse a SELL trade and increase quantity', async () => {
    const existingPos = makePositionInstance({
      asset_type: 'securities:ibkr',
      security_symbol: 'AAPL',
      quantity: 5,
      cost_price: 145,
      current_price: 155,
      amount: 775,
      status: 'Open',
    })

    mockTradeFindByPk.mockResolvedValue(
      makeTradeInstance({ type: 'SELL', quantity: 10, price: 160 }),
    )
    mockPositionFindOne.mockResolvedValue(existingPos)
    const reply = mockReply()

    await tradesCtrl.deleteTrade({ params: { id: '1' } } as any, reply)

    expect(existingPos.update).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 15,
        status: 'Open',
        amount: 15 * 155,
      }),
      expect.anything(),
    )
  })

  it('should recreate position when reversing SELL and no position exists', async () => {
    mockTradeFindByPk.mockResolvedValue(
      makeTradeInstance({ type: 'SELL', quantity: 10, price: 160 }),
    )
    mockPositionFindOne.mockResolvedValue(null)
    mockPositionCreate.mockResolvedValue(
      makePositionInstance({ quantity: 10 }),
    )
    const reply = mockReply()

    await tradesCtrl.deleteTrade({ params: { id: '1' } } as any, reply)

    expect(mockPositionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_type: 'securities:test',
        security_symbol: 'AAPL',
        quantity: 10,
        cost_price: 160,
        current_price: 160,
        amount: 1600,
        status: 'Open',
      }),
      { transaction: mockT },
    )
  })
})
