# Trade Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) for syntax tracking.

**Goal:** Add a new `/trade` page for recording securities buy/sell operations, with Positions (holdings) and Trades tables.

**Architecture:** New server models (Position, Trade) with controller and routes, new Svelte components and route page, extending existing Assets for securities account integration.

**Tech Stack:** Sequelize/SQLite (server), Svelte 4/Flowbite/ApexCharts (client), Routify (routing)

## Global Constraints

- All new Sequelize models must follow the existing pattern: `class Model extends Model {}` + `.init()` with `sequelize, tableName, timestamps: false`
- New models must be imported in `server/src/index.ts` before `sequelize.sync()`
- New API routes must be registered in `server/src/routes/index.ts`
- All trades+positions operations must use Sequelize transactions
- Client API calls follow the existing `$ajax.{get,post,put,delete}(genApiPath(...), data)` pattern
- i18n: add keys to all 5 locale files (`zh.json`, `zh-tw.json`, `en.json`, `ja.json`, `fr.json`)
- Frontend components must handle: loading, empty, error, and success states

---

### Task 1: Server Models — Position and Trade

**Files:**
- Create: `server/src/models/positions.ts`
- Create: `server/src/models/trades.ts`
- Modify: `server/src/index.ts` (add model imports)

**Interfaces:**
- Consumes: existing `sequelize` instance from `./models/index`
- Produces: `Position` class and `Trade` class exported from their respective files

- [ ] **Step 1: Create `server/src/models/positions.ts`**

```typescript
import { DataTypes, Model } from 'sequelize'
import { sequelize } from './index'

export class Position extends Model {}

Position.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    asset_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    security_symbol: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    security_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    cost_price: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
      defaultValue: 0,
    },
    current_price: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Open',
    },
    created: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    updated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Position',
    tableName: 'positions',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['asset_type', 'security_symbol'],
      },
    ],
  },
)
```

- [ ] **Step 2: Create `server/src/models/trades.ts`**

```typescript
import { DataTypes, Model } from 'sequelize'
import { sequelize } from './index'

export class Trade extends Model {}

Trade.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    asset_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    security_symbol: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    security_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    trade_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    created: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Trade',
    tableName: 'trades',
    timestamps: false,
  },
)
```

- [ ] **Step 3: Register models in `server/src/index.ts`**

In `loadServerModules()`, add imports for the two new models:

After line `import './models/session',` add:
```typescript
import './models/positions',
import './models/trades',
```

- [ ] **Step 4: Commit**

```bash
git add server/src/models/positions.ts server/src/models/trades.ts server/src/index.ts
git commit -m "feat: add Position and Trade server models"
```

---

### Task 2: Server Controller and Routes

**Files:**
- Create: `server/src/controllers/trades.ts`
- Create: `server/src/routes/trades.ts`
- Modify: `server/src/routes/index.ts`

**Interfaces:**
- Consumes: `Position` and `Trade` models from Task 1
- Produces: 7 route handlers and route array

- [ ] **Step 1: Create `server/src/controllers/trades.ts`**

```typescript
import { Op } from 'sequelize'
import { sequelize } from '../models'
import { Assets } from '../models/assets'
import { Position } from '../models/positions'
import { Trade } from '../models/trades'

export const getSecuritiesAccounts = async (_, reply) => {
  try {
    const assets = await Assets.findAll()
    const securitiesAccounts = assets.filter((a: any) =>
      a.type.startsWith('securities:'),
    )
    return reply.send(securitiesAccounts)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const getPositions = async (request, reply) => {
  const { assetType } = request.params
  try {
    const data = await Position.findAll({
      where: { asset_type: assetType },
      order: [['created', 'ASC']],
    })
    return reply.send(data)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const updatePositionPrice = async (request, reply) => {
  const { assetType, symbol } = request.params
  const { current_price, amount } = request.body
  try {
    const position = await Position.findOne({
      where: { asset_type: assetType, security_symbol: symbol },
    })
    if (!position) {
      return reply.code(404).send({
        statusCode: 404,
        message: 'Position not found.',
      })
    }
    const updateData: any = { updated: new Date() }
    if (current_price !== undefined) {
      updateData.current_price = current_price
    }
    if (amount !== undefined) {
      updateData.amount = amount
    }
    await Position.update(updateData, {
      where: { asset_type: assetType, security_symbol: symbol },
    })
    const updated = await Position.findOne({
      where: { asset_type: assetType, security_symbol: symbol },
    })
    return reply.send(updated)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const getTrades = async (request, reply) => {
  const { assetType } = request.params
  const { page = 1, size = 10 } = request.query
  try {
    const offset = (page - 1) * size
    const { count, rows } = await Trade.findAndCountAll({
      where: { asset_type: assetType },
      order: [['trade_date', 'DESC'], ['created', 'DESC']],
      offset,
      limit: size,
    })
    return reply.send({
      total: count,
      page: Number(page),
      size: Number(size),
      data: rows,
    })
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const createTrade = async (request, reply) => {
  const { assetType } = request.params
  const params = request.body

  if (!assetType || !assetType.startsWith('securities:')) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Invalid securities account type.',
    })
  }

  if (!params.type || !['BUY', 'SELL'].includes(params.type)) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Trade type must be BUY or SELL.',
    })
  }

  if (!params.security_symbol || !params.security_name) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Security symbol and name are required.',
    })
  }

  const quantity = Number(params.quantity)
  const price = Number(params.price)
  if (!quantity || quantity <= 0) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Quantity must be a positive number.',
    })
  }
  if (!price || price <= 0) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Price must be a positive number.',
    })
  }

  const amount = Number(params.amount)
  if (Math.abs(amount - quantity * price) > 0.01) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Amount must equal quantity × price.',
    })
  }

  const trade_date = params.trade_date
  if (!trade_date) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Trade date is required.',
    })
  }

  try {
    const result = await sequelize.transaction(async (t) => {
      // 1. Create trade record
      const trade = await Trade.create(
        {
          asset_type: assetType,
          security_symbol: params.security_symbol,
          security_name: params.security_name,
          type: params.type,
          quantity,
          price,
          amount,
          trade_date,
          note: params.note || '',
          created: new Date(),
        },
        { transaction: t },
      )

      // 2. Update position
      const existing = await Position.findOne({
        where: {
          asset_type: assetType,
          security_symbol: params.security_symbol,
        },
        transaction: t,
      })

      if (params.type === 'BUY') {
        if (existing) {
          const oldQty = Number(existing.quantity)
          const oldCost = Number(existing.cost_price)
          const newQty = oldQty + quantity
          const newCost = (oldQty * oldCost + quantity * price) / newQty
          const currentPrice =
            existing.current_price !== null
              ? Number(existing.current_price)
              : price
          await existing.update(
            {
              quantity: newQty,
              cost_price: newCost,
              amount: newQty * currentPrice,
              status: 'Open',
              updated: new Date(),
            },
            { transaction: t },
          )
        } else {
          await Position.create(
            {
              asset_type: assetType,
              security_symbol: params.security_symbol,
              security_name: params.security_name,
              quantity,
              cost_price: price,
              current_price: price,
              amount: quantity * price,
              status: 'Open',
              created: new Date(),
              updated: new Date(),
            },
            { transaction: t },
          )
        }
      } else {
        // SELL
        if (!existing) {
          throw new Error('Position not found for sell.')
        }
        const oldQty = Number(existing.quantity)
        if (quantity > oldQty) {
          throw new Error(
            `Insufficient quantity. Available: ${oldQty}, attempting to sell: ${quantity}.`,
          )
        }
        const newQty = oldQty - quantity
        const updateData: any = {
          quantity: newQty,
          updated: new Date(),
        }
        if (newQty === 0) {
          updateData.status = 'Closed'
          updateData.amount = 0
        } else {
          const currentPrice =
            existing.current_price !== null
              ? Number(existing.current_price)
              : Number(existing.cost_price)
          updateData.amount = newQty * currentPrice
        }
        await existing.update(updateData, { transaction: t })
      }

      return trade
    })

    return reply.send(result)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const updateTrade = async (request, reply) => {
  const { id } = request.params
  const params = request.body
  try {
    const oldTrade = await Trade.findByPk(id)
    if (!oldTrade) {
      return reply.code(404).send({
        statusCode: 404,
        message: 'Trade not found.',
      })
    }

    await sequelize.transaction(async (t) => {
      // Reverse old trade
      await reverseTradeEffect(oldTrade, t)
      // Apply new trade
      const newType = params.type || oldTrade.type
      const newSymbol = params.security_symbol || oldTrade.security_symbol
      const newName = params.security_name || oldTrade.security_name
      const newQty = Number(params.quantity ?? oldTrade.quantity)
      const newPrice = Number(params.price ?? oldTrade.price)
      const newAmount = Number(params.amount ?? oldTrade.amount)
      const newDate = params.trade_date || oldTrade.trade_date

      await applyTradeEffect(
        oldTrade.asset_type,
        newType,
        newSymbol,
        newName,
        newQty,
        newPrice,
        newAmount,
        t,
      )

      await Trade.update(
        {
          type: newType,
          security_symbol: newSymbol,
          security_name: newName,
          quantity: newQty,
          price: newPrice,
          amount: newAmount,
          trade_date: newDate,
          note: params.note !== undefined ? params.note : oldTrade.note,
        },
        { where: { id }, transaction: t },
      )
    })

    const updated = await Trade.findByPk(id)
    return reply.send(updated)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

export const deleteTrade = async (request, reply) => {
  const { id } = request.params
  try {
    const trade = await Trade.findByPk(id)
    if (!trade) {
      return reply.code(404).send({
        statusCode: 404,
        message: 'Trade not found.',
      })
    }

    await sequelize.transaction(async (t) => {
      await reverseTradeEffect(trade, t)
      await Trade.destroy({ where: { id }, transaction: t })
    })

    return reply.send({ result: true })
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}

// Helper: reverse a trade's effect on positions
async function reverseTradeEffect(trade: any, t: any) {
  const assetType = trade.asset_type
  const symbol = trade.security_symbol
  const qty = Number(trade.quantity)
  const price = Number(trade.price)

  const existing = await Position.findOne({
    where: { asset_type: assetType, security_symbol: symbol },
    transaction: t,
  })

  if (trade.type === 'BUY') {
    // Reverse buy: decrease quantity
    if (existing) {
      const oldQty = Number(existing.quantity)
      const newQty = oldQty - qty
      if (newQty < 0) {
        throw new Error(
          'Cannot reverse this trade: position quantity would go negative.',
        )
      }
      const updateData: any = {
        quantity: newQty,
        updated: new Date(),
      }
      if (newQty === 0) {
        updateData.status = 'Closed'
        updateData.amount = 0
      } else {
        // Restore cost price to before this buy (reverse weighted avg)
        const oldCost = Number(existing.cost_price)
        const restoredCost =
          oldQty > 0 ? (oldQty * oldCost - qty * price) / newQty : 0
        updateData.cost_price = restoredCost
        const currentPrice =
          existing.current_price !== null
            ? Number(existing.current_price)
            : price
        updateData.amount = newQty * currentPrice
      }
      await existing.update(updateData, { transaction: t })
    }
  } else {
    // Reverse sell: increase quantity
    if (existing) {
      const oldQty = Number(existing.quantity)
      const newQty = oldQty + qty
      const currentPrice =
        existing.current_price !== null
          ? Number(existing.current_price)
          : Number(existing.cost_price)
      await existing.update(
        {
          quantity: newQty,
          status: 'Open',
          amount: newQty * currentPrice,
          updated: new Date(),
        },
        { transaction: t },
      )
    } else {
      // Position was fully closed and deleted (shouldn't happen since we use Closed status)
      const currentPrice = price
      await Position.create(
        {
          asset_type: assetType,
          security_symbol: symbol,
          security_name: trade.security_name,
          quantity: qty,
          cost_price: price,
          current_price: price,
          amount: qty * currentPrice,
          status: 'Open',
          created: new Date(),
          updated: new Date(),
        },
        { transaction: t },
      )
    }
  }
}

// Helper: apply a trade's effect on positions
async function applyTradeEffect(
  assetType: string,
  type: string,
  symbol: string,
  name: string,
  quantity: number,
  price: number,
  amount: number,
  t: any,
) {
  const existing = await Position.findOne({
    where: { asset_type: assetType, security_symbol: symbol },
    transaction: t,
  })

  if (type === 'BUY') {
    if (existing) {
      const oldQty = Number(existing.quantity)
      const oldCost = Number(existing.cost_price)
      const newQty = oldQty + quantity
      const newCost = (oldQty * oldCost + quantity * price) / newQty
      const currentPrice =
        existing.current_price !== null
          ? Number(existing.current_price)
          : price
      await existing.update(
        {
          quantity: newQty,
          cost_price: newCost,
          amount: newQty * currentPrice,
          status: 'Open',
          updated: new Date(),
        },
        { transaction: t },
      )
    } else {
      await Position.create(
        {
          asset_type: assetType,
          security_symbol: symbol,
          security_name: name,
          quantity,
          cost_price: price,
          current_price: price,
          amount: quantity * price,
          status: 'Open',
          created: new Date(),
          updated: new Date(),
        },
        { transaction: t },
      )
    }
  } else {
    // SELL
    if (!existing) {
      throw new Error('Position not found for sell.')
    }
    const oldQty = Number(existing.quantity)
    if (quantity > oldQty) {
      throw new Error(
        `Insufficient quantity. Available: ${oldQty}, attempting to sell: ${quantity}.`,
      )
    }
    const newQty = oldQty - quantity
    const updateData: any = {
      quantity: newQty,
      updated: new Date(),
    }
    if (newQty === 0) {
      updateData.status = 'Closed'
      updateData.amount = 0
    } else {
      const currentPrice =
        existing.current_price !== null
          ? Number(existing.current_price)
          : Number(existing.cost_price)
      updateData.amount = newQty * currentPrice
    }
    await existing.update(updateData, { transaction: t })
  }
}
```

- [ ] **Step 2: Create `server/src/routes/trades.ts`**

```typescript
import {
  getSecuritiesAccounts,
  getPositions,
  updatePositionPrice,
  getTrades,
  createTrade,
  updateTrade,
  deleteTrade,
} from '../controllers/trades'

export default [
  {
    method: 'GET',
    url: '/api/trades/securities-accounts',
    handler: getSecuritiesAccounts,
  },
  {
    method: 'GET',
    url: '/api/assets/:assetType/positions',
    handler: getPositions,
  },
  {
    method: 'PUT',
    url: '/api/assets/:assetType/positions/:symbol',
    handler: updatePositionPrice,
  },
  {
    method: 'GET',
    url: '/api/assets/:assetType/trades',
    handler: getTrades,
  },
  {
    method: 'POST',
    url: '/api/assets/:assetType/trades',
    handler: createTrade,
  },
  {
    method: 'PUT',
    url: '/api/trades/:id',
    handler: updateTrade,
  },
  {
    method: 'DELETE',
    url: '/api/trades/:id',
    handler: deleteTrade,
  },
]
```

- [ ] **Step 3: Register in `server/src/routes/index.ts`**

Add import at top:
```typescript
import trades from './trades'
```

Add to export array:
```typescript
...trades,
```

- [ ] **Step 4: Commit**

```bash
git add server/src/controllers/trades.ts server/src/routes/trades.ts server/src/routes/index.ts
git commit -m "feat: add trade controller and API routes"
```

---

### Task 3: Update Assets Destroy + Backup for Trade Data

**Files:**
- Modify: `server/src/controllers/assets.ts`
- Modify: `server/src/controllers/backup.ts`

- [ ] **Step 1: Update `assets.ts` destroy to cascade delete positions and trades**

Add imports at top:
```typescript
import { Position } from '../models/positions'
import { Trade } from '../models/trades'
```

Update the `destroy` function:
```typescript
export const destroy = async (request, reply) => {
  const { type = '' } = request?.body
  try {
    await Trade.destroy({ where: { asset_type: type } })
    await Position.destroy({ where: { asset_type: type } })
    await Assets.destroy({ where: { type } })
    await Record.destroy({ where: { type } })
    return reply.send({ result: true })
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}
```

- [ ] **Step 2: Include Positions and Trades in backup**

Add imports at top of `server/src/controllers/backup.ts`:
```typescript
import { Position } from '../models/positions'
import { Trade } from '../models/trades'
```

Add to the `exportData` function's Promise.all and response:
```typescript
// In the Promise.all destructuring:
const [assets, records, insights, goals, customCurrencies, positions, trades] = await Promise.all([
  Assets.findAll({ raw: true }),
  Record.findAll({ raw: true }),
  Insight.findAll({ raw: true }),
  Goal.findAll({ raw: true }),
  CustomCurrency.findAll({ raw: true }),
  Position.findAll({ raw: true }),
  Trade.findAll({ raw: true }),
])

// In the response data:
data: { assets, records, insights, goals, customCurrencies, positions, trades },
```

Add to `importData` — after the customCurrencies block, add:
```typescript
if (Array.isArray(data.positions)) {
  for (const item of data.positions) {
    if (!item?.asset_type || !item?.security_symbol) continue
    await Position.upsert({
      id: item.id,
      asset_type: item.asset_type,
      security_symbol: item.security_symbol,
      security_name: item.security_name,
      quantity: item.quantity || 0,
      cost_price: item.cost_price || 0,
      current_price: item.current_price || null,
      amount: item.amount || 0,
      status: item.status || 'Open',
      created: item.created || new Date(),
      updated: new Date(),
    })
    counts.positions += 1
  }
}

if (Array.isArray(data.trades)) {
  for (const item of data.trades) {
    if (!item?.asset_type || !item?.security_symbol) continue
    const existing = await Trade.findOne({ where: { id: item.id } })
    if (!existing) {
      await Trade.create({
        asset_type: item.asset_type,
        security_symbol: item.security_symbol,
        security_name: item.security_name,
        type: item.type,
        quantity: item.quantity,
        price: item.price,
        amount: item.amount,
        trade_date: item.trade_date,
        note: item.note || '',
        created: item.created || new Date(),
      })
    }
    counts.trades += 1
  }
}
```

Also add `positions: 0, trades: 0` to the `counts` object initializer.

- [ ] **Step 3: Commit**

```bash
git add server/src/controllers/assets.ts server/src/controllers/backup.ts
git commit -m "feat: cascade delete trade data on asset removal, include in backup"
```

---

### Task 4: Client API Calls

**Files:**
- Modify: `client/src/helper/apis.ts`

- [ ] **Step 1: Add trade API functions**

Append to `apis.ts`:

```typescript
export const getSecuritiesAccounts = () => {
  return $ajax.get(genApiPath('trades/securities-accounts'), {})
}

export const getPositions = (assetType: string) => {
  return $ajax.get(genApiPath(`assets/${assetType}/positions`), {})
}

export const updatePositionPrice = (
  assetType: string,
  symbol: string,
  data: { current_price?: number; amount?: number },
) => {
  return $ajax.put(genApiPath(`assets/${assetType}/positions/${symbol}`), data)
}

export const getTrades = (assetType: string, data = {}) => {
  return $ajax.get(genApiPath(`assets/${assetType}/trades`), data)
}

export const createTrade = (assetType: string, data: any) => {
  return $ajax.post(genApiPath(`assets/${assetType}/trades`), data)
}

export const updateTrade = (id: number, data: any) => {
  return $ajax.put(genApiPath(`trades/${id}`), data)
}

export const deleteTrade = (id: number) => {
  return $ajax.delete(genApiPath(`trades/${id}`), {})
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/helper/apis.ts
git commit -m "feat: add trade API client functions"
```

---

### Task 5: i18n Translations

**Files:**
- Modify: `client/src/lang/zh.json`
- Modify: `client/src/lang/zh-tw.json`
- Modify: `client/src/lang/en.json`
- Modify: `client/src/lang/ja.json`
- Modify: `client/src/lang/fr.json`

- [ ] **Step 1: Add to `client/src/lang/zh.json`**

Append before the closing `}`:

```json
  "trade": "交易",
  "tradePage": "交易记录",
  "positions": "持仓",
  "position": "持仓",
  "closedPositions": "已平仓",
  "openPositions": "持仓中",
  "buy": "买入",
  "sell": "卖出",
  "securitySymbol": "证券代码",
  "securityName": "证券名称",
  "quantity": "数量",
  "price": "单价",
  "tradeDate": "交易日期",
  "tradeAmount": "成交金额",
  "costPrice": "成本价",
  "currentPrice": "现价",
  "profitLoss": "盈亏",
  "recordTrade": "记录交易",
  "tradeSuccess": "交易记录成功",
  "tradeDeleted": "交易已删除",
  "selectAccount": "选择证券账户",
  "noSecuritiesAccount": "暂无证券账户，请先在首页添加",
  "goToAdd": "去添加",
  "noPositions": "暂无持仓",
  "noTrades": "暂无交易记录",
  "insufficientQuantity": "可卖数量不足，当前仅持有 {count} 股",
  "deleteTradeConfirm": "确定删除此交易记录？删除后将回退持仓。",
  "editPrice": "编辑现价",
  "totalInvestment": "总投资",
  "holdingCount": "持有证券"
```

- [ ] **Step 2: Add to `client/src/lang/en.json`**

```json
  "trade": "Trade",
  "tradePage": "Trade Records",
  "positions": "Positions",
  "position": "Position",
  "closedPositions": "Closed",
  "openPositions": "Open",
  "buy": "Buy",
  "sell": "Sell",
  "securitySymbol": "Symbol",
  "securityName": "Name",
  "quantity": "Qty",
  "price": "Price",
  "tradeDate": "Trade Date",
  "tradeAmount": "Amount",
  "costPrice": "Cost Price",
  "currentPrice": "Current Price",
  "profitLoss": "P&L",
  "recordTrade": "Record Trade",
  "tradeSuccess": "Trade recorded successfully",
  "tradeDeleted": "Trade deleted",
  "selectAccount": "Select Account",
  "noSecuritiesAccount": "No securities account yet. Add one on the home page.",
  "goToAdd": "Go to Add",
  "noPositions": "No positions",
  "noTrades": "No trade records",
  "insufficientQuantity": "Insufficient quantity. Available: {count}",
  "deleteTradeConfirm": "Delete this trade? This will revert the position.",
  "editPrice": "Edit Price",
  "totalInvestment": "Total Investment",
  "holdingCount": "Holdings"
```

- [ ] **Step 3: Add to `client/src/lang/zh-tw.json`**

Same keys as `zh.json` but with traditional Chinese:

```json
  "trade": "交易",
  "tradePage": "交易記錄",
  "positions": "持倉",
  "position": "持倉",
  "closedPositions": "已平倉",
  "openPositions": "持倉中",
  "buy": "買入",
  "sell": "賣出",
  "securitySymbol": "證券代碼",
  "securityName": "證券名稱",
  "quantity": "數量",
  "price": "單價",
  "tradeDate": "交易日期",
  "tradeAmount": "成交金額",
  "costPrice": "成本價",
  "currentPrice": "現價",
  "profitLoss": "盈虧",
  "recordTrade": "記錄交易",
  "tradeSuccess": "交易記錄成功",
  "tradeDeleted": "交易已刪除",
  "selectAccount": "選擇證券賬戶",
  "noSecuritiesAccount": "暫無證券賬戶，請先在首頁添加",
  "goToAdd": "去添加",
  "noPositions": "暫無持倉",
  "noTrades": "暫無交易記錄",
  "insufficientQuantity": "可賣數量不足，當前僅持有 {count} 股",
  "deleteTradeConfirm": "確定刪除此交易記錄？刪除後將回退持倉。",
  "editPrice": "編輯現價",
  "totalInvestment": "總投資",
  "holdingCount": "持有證券"
```

- [ ] **Step 4: Add to `client/src/lang/ja.json`**

```json
  "trade": "取引",
  "tradePage": "取引記録",
  "positions": "ポジション",
  "position": "ポジション",
  "closedPositions": "決済済み",
  "openPositions": "保有中",
  "buy": "買い",
  "sell": "売り",
  "securitySymbol": "証券コード",
  "securityName": "証券名",
  "quantity": "数量",
  "price": "単価",
  "tradeDate": "取引日",
  "tradeAmount": "取引金額",
  "costPrice": "取得単価",
  "currentPrice": "現在値",
  "profitLoss": "損益",
  "recordTrade": "取引を記録",
  "tradeSuccess": "取引を記録しました",
  "tradeDeleted": "取引を削除しました",
  "selectAccount": "証券口座を選択",
  "noSecuritiesAccount": "証券口座がありません。トップページで追加してください。",
  "goToAdd": "追加へ",
  "noPositions": "ポジションがありません",
  "noTrades": "取引記録がありません",
  "insufficientQuantity": "数量が不足しています。現在 {count} 株保有中",
  "deleteTradeConfirm": "この取引を削除しますか？ポジションも元に戻ります。",
  "editPrice": "現在値を編集",
  "totalInvestment": "総投資額",
  "holdingCount": "保有証券"
```

- [ ] **Step 5: Add to `client/src/lang/fr.json`**

```json
  "trade": "Transaction",
  "tradePage": "Transactions",
  "positions": "Positions",
  "position": "Position",
  "closedPositions": "Clôturé",
  "openPositions": "Ouvert",
  "buy": "Achat",
  "sell": "Vente",
  "securitySymbol": "Symbole",
  "securityName": "Nom",
  "quantity": "Quantité",
  "price": "Prix",
  "tradeDate": "Date",
  "tradeAmount": "Montant",
  "costPrice": "Prix de revient",
  "currentPrice": "Prix actuel",
  "profitLoss": "P&L",
  "recordTrade": "Enregistrer",
  "tradeSuccess": "Transaction enregistrée",
  "tradeDeleted": "Transaction supprimée",
  "selectAccount": "Sélectionner un compte",
  "noSecuritiesAccount": "Aucun compte titres. Ajoutez-en sur la page d'accueil.",
  "goToAdd": "Ajouter",
  "noPositions": "Aucune position",
  "noTrades": "Aucune transaction",
  "insufficientQuantity": "Quantité insuffisante. Disponible : {count}",
  "deleteTradeConfirm": "Supprimer cette transaction ? La position sera restaurée.",
  "editPrice": "Modifier le prix",
  "totalInvestment": "Investissement total",
  "holdingCount": "Titres détenus"
```

- [ ] **Step 6: Commit**

```bash
git add client/src/lang/*.json
git commit -m "feat: add i18n translations for trade page"
```

---

### Task 6: AccountSelector Component

**File:**
- Create: `client/src/components/AccountSelector.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { getSecuritiesAccounts } from '../helper/apis'
  import Skeleton from './Skeleton.svelte'

  const dispatch = createEventDispatcher()

  export let selectedAccount: any = null

  let accounts: any[] = []
  let loading = true

  onMount(() => {
    fetchAccounts()
  })

  const fetchAccounts = async () => {
    loading = true
    try {
      const data = await getSecuritiesAccounts()
      accounts = data || []
      if (accounts.length > 0 && !selectedAccount) {
        selectedAccount = accounts[0]
        dispatch('select', accounts[0])
      }
    } catch (error) {
      console.error('Error fetching securities accounts:', error)
    } finally {
      loading = false
    }
  }

  const handleSelect = (account: any) => {
    selectedAccount = account
    dispatch('select', account)
  }

  const getTotalAmount = (account: any) => {
    return Number(account.amount || 0)
  }

  const formatAmount = (value: number) => {
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
</script>

<div class="mb-6 w-full">
  {#if loading}
    <div class="space-y-2">
      <Skeleton width="w-48" height="h-6" />
      <Skeleton width="w-32" height="h-4" />
    </div>
  {:else if accounts.length === 0}
    <div class="rounded-lg border border-dashed border-gray-300 p-6 text-center">
      <p class="mb-2 text-gray-500">{$_('noSecuritiesAccount')}</p>
      <a
        href="/"
        class="comfirm-btn inline-block rounded px-4 py-2 text-sm font-medium text-white">
        {$_('goToAdd')}
      </a>
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-3">
      {#each accounts as account}
        <button
          on:click={() => handleSelect(account)}
          class="focus-visible-ring rounded-lg border px-4 py-3 text-left transition-all
          {selectedAccount?.type === account.type
            ? 'border-brand bg-brand/5 shadow-sm'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}">
          <div class="flex items-center gap-3">
            <span class="font-medium">{account.alias || account.type.replace('securities:', '')}</span>
            <span class="text-lg font-semibold text-brand"
              >¥{formatAmount(getTotalAmount(account))}</span
            >
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/AccountSelector.svelte
git commit -m "feat: add AccountSelector component"
```

---

### Task 7: PositionsTable Component

**File:**
- Create: `client/src/components/PositionsTable.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { Table } from 'flowbite-svelte'
  import SvgIcon from './SvgIcon.svelte'
  import Skeleton from './Skeleton.svelte'
  import { updatePositionPrice } from '../helper/apis'
  import { notice } from '../stores'

  const dispatch = createEventDispatcher()

  export let positions: any[] = []
  export let loading = false
  export let assetType = ''

  let editingSymbol: string | null = null
  let editingPrice: string = ''
  let showClosed = false

  const openPositions = positions.filter((p: any) => p.status === 'Open')
  const closedPositions = positions.filter((p: any) => p.status === 'Closed')

  const formatPrice = (value: any) => {
    if (value === null || value === undefined) return '-'
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }

  const formatQty = (value: any) => {
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }

  const startEditPrice = (position: any) => {
    editingSymbol = position.security_symbol
    editingPrice = String(position.current_price ?? '')
  }

  const savePrice = async (position: any) => {
    const newPrice = parseFloat(editingPrice)
    if (isNaN(newPrice) || newPrice <= 0) {
      editingSymbol = null
      return
    }
    const newAmount = newPrice * Number(position.quantity)
    try {
      await updatePositionPrice(assetType, position.security_symbol, {
        current_price: newPrice,
        amount: newAmount,
      })
      notice.set($_('editPrice') + ' ✓')
      dispatch('priceUpdated')
    } catch (error) {
      console.error('Failed to update price:', error)
    }
    editingSymbol = null
  }

  const handleSell = (position: any) => {
    dispatch('sell', position)
  }

  const handleKeydown = (e: KeyboardEvent, position: any) => {
    if (e.key === 'Enter') {
      savePrice(position)
    }
    if (e.key === 'Escape') {
      editingSymbol = null
    }
  }
</script>

<div class="w-full">
  {#if loading}
    <div class="space-y-2">
      <Skeleton width="w-full" height="h-8" />
      <Skeleton width="w-full" height="h-8" />
      <Skeleton width="w-full" height="h-8" />
    </div>
  {:else if positions.length === 0}
    <div class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500">
      {$_('noPositions')}
    </div>
  {:else}
    <!-- Open positions -->
    <Table>
      <thead>
        <tr>
          <th>{$_('securitySymbol')}</th>
          <th>{$_('securityName')}</th>
          <th class="text-right">{$_('quantity')}</th>
          <th class="text-right">{$_('costPrice')}</th>
          <th class="text-right">{$_('currentPrice')}</th>
          <th class="text-right">{$_('tradeAmount')}</th>
          <th class="text-center">{$_('action')}</th>
        </tr>
      </thead>
      <tbody>
        {#each openPositions as position (position.security_symbol)}
          <tr class="hover:bg-gray-50">
            <td class="font-mono text-sm">{position.security_symbol}</td>
            <td>{position.security_name}</td>
            <td class="text-right">{formatQty(position.quantity)}</td>
            <td class="text-right font-mono text-sm">{formatPrice(position.cost_price)}</td>
            <td
              class="text-right font-mono text-sm"
              role="button"
              tabindex="0"
              on:click={() => startEditPrice(position)}
              on:keydown={(e) => e.key === 'Enter' && startEditPrice(position)}>
              {#if editingSymbol === position.security_symbol}
                <input
                  type="number"
                  step="0.0001"
                  class="custom-input w-24 text-right text-sm"
                  bind:value={editingPrice}
                  on:blur={() => savePrice(position)}
                  on:keydown={(e) => handleKeydown(e, position)}
                  autofocus />
              {:else}
                <span class="cursor-pointer hover:text-brand">{formatPrice(position.current_price)}</span>
              {/if}
            </td>
            <td class="text-right font-mono text-sm">{formatPrice(position.amount)}</td>
            <td class="text-center">
              <button
                on:click={() => handleSell(position)}
                class="rounded px-2 py-1 text-xs font-medium text-white
                  bg-orange-500 hover:bg-orange-600 transition-colors">
                {$_('sell')}
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </Table>

    <!-- Closed positions toggle -->
    {#if closedPositions.length > 0}
      <button
        on:click={() => (showClosed = !showClosed)}
        class="mt-4 flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
        <SvgIcon
          name={showClosed ? 'chevron-down' : 'chevron-right'}
          width={16}
          height={16} />
        {$_('closedPositions')} ({closedPositions.length})
      </button>
      {#if showClosed}
        <Table>
          <thead>
            <tr>
              <th>{$_('securitySymbol')}</th>
              <th>{$_('securityName')}</th>
              <th class="text-right">{$_('costPrice')}</th>
              <th class="text-right">{$_('tradeAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {#each closedPositions as position (position.security_symbol)}
              <tr class="text-gray-400">
                <td class="font-mono text-sm">{position.security_symbol}</td>
                <td>{position.security_name}</td>
                <td class="text-right font-mono text-sm">{formatPrice(position.cost_price)}</td>
                <td class="text-right font-mono text-sm">{formatPrice(position.amount)}</td>
              </tr>
            {/each}
          </tbody>
        </Table>
      {/if}
    {/if}
  {/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/PositionsTable.svelte
git commit -m "feat: add PositionsTable component with inline price editing"
```

---

### Task 8: TradeForm Component

**File:**
- Create: `client/src/components/TradeForm.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  import dayjs from 'dayjs'
  import SvgIcon from './SvgIcon.svelte'
  import { createTrade } from '../helper/apis'
  import { alert, notice } from '../stores'

  const dispatch = createEventDispatcher()

  export let assetType = ''

  let tradeType = 'BUY'
  let securitySymbol = ''
  let securityName = ''
  let quantity = ''
  let price = ''
  let amount = 0
  let tradeDate = dayjs().format('YYYY-MM-DD')
  let note = ''
  let submitting = false

  $: {
    const qty = parseFloat(quantity) || 0
    const p = parseFloat(price) || 0
    amount = qty * p
  }

  const resetForm = () => {
    securitySymbol = ''
    securityName = ''
    quantity = ''
    price = ''
    amount = 0
    tradeDate = dayjs().format('YYYY-MM-DD')
    note = ''
  }

  const handleSubmit = async () => {
    if (!securitySymbol.trim()) {
      alert.set($_('securitySymbol') + ' ' + $_('fillAccountTypeTip'))
      return
    }
    if (!securityName.trim()) {
      alert.set($_('securityName') + ' ' + $_('fillAccountTypeTip'))
      return
    }
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) {
      alert.set($_('quantity') + ' ' + $_('fillAccountTypeTip'))
      return
    }
    const p = parseFloat(price)
    if (!p || p <= 0) {
      alert.set($_('price') + ' ' + $_('fillAccountTypeTip'))
      return
    }
    if (!tradeDate) {
      alert.set($_('tradeDate') + ' ' + $_('fillValidDateTip'))
      return
    }

    submitting = true
    try {
      await createTrade(assetType, {
        type: tradeType,
        security_symbol: securitySymbol.trim(),
        security_name: securityName.trim(),
        quantity: qty,
        price: p,
        amount: amount,
        trade_date: tradeDate,
        note: note.trim(),
      })
      notice.set($_('tradeSuccess'))
      // Keep symbol/name for consecutive trades, clear rest
      quantity = ''
      price = ''
      amount = 0
      dispatch('created')
    } catch (error: any) {
      const msg = error?.response?.data?.message || error.message
      alert.set(msg)
    } finally {
      submitting = false
    }
  }

  const selectSell = (data: { symbol: string; name: string }) => {
    tradeType = 'SELL'
    securitySymbol = data.symbol
    securityName = data.name
  }

  export { selectSell }
</script>

<div class="w-full rounded-lg border border-gray-200 p-4">
  <h3 class="mb-4 flex items-center gap-2 text-base font-medium">
    <SvgIcon name="adjustment" width={18} height={18} color="#1e293b" />
    {$_('recordTrade')}
  </h3>

  <!-- Trade type toggle -->
  <div class="mb-4 flex gap-2">
    <button
      on:click={() => (tradeType = 'BUY')}
      class="rounded-full px-4 py-1.5 text-sm font-medium transition-all
      {tradeType === 'BUY'
        ? 'bg-green-500 text-white'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
      {$_('buy')}
    </button>
    <button
      on:click={() => (tradeType = 'SELL')}
      class="rounded-full px-4 py-1.5 text-sm font-medium transition-all
      {tradeType === 'SELL'
        ? 'bg-orange-500 text-white'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
      {$_('sell')}
    </button>
  </div>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div class="module-warp">
      <label class="custom-label">
        {$_('securitySymbol')}
        <i class="text-mark">*</i>
      </label>
      <input
        type="text"
        class="custom-input"
        bind:value={securitySymbol}
        placeholder="0700.HK" />
    </div>
    <div class="module-warp">
      <label class="custom-label">
        {$_('securityName')}
        <i class="text-mark">*</i>
      </label>
      <input
        type="text"
        class="custom-input"
        bind:value={securityName}
        placeholder={$_('securityName')} />
    </div>
    <div class="module-warp">
      <label class="custom-label">
        {$_('quantity')}
        <i class="text-mark">*</i>
      </label>
      <input
        type="number"
        step="1"
        class="custom-input"
        bind:value={quantity}
        placeholder="100" />
    </div>
    <div class="module-warp">
      <label class="custom-label">
        {$_('price')}
        <i class="text-mark">*</i>
      </label>
      <input
        type="number"
        step="0.0001"
        class="custom-input"
        bind:value={price}
        placeholder="700.00" />
    </div>
    <div class="module-warp">
      <label class="custom-label">{$_('tradeAmount')}</label>
      <input
        type="text"
        class="custom-input bg-gray-50"
        value={amount ? amount.toFixed(2) : ''}
        disabled />
    </div>
    <div class="module-warp">
      <label class="custom-label">
        {$_('tradeDate')}
        <i class="text-mark">*</i>
      </label>
      <input
        type="date"
        class="custom-input"
        bind:value={tradeDate} />
    </div>
  </div>
  <div class="module-warp mt-2">
    <label class="custom-label">{$_('remark')}</label>
    <input
      type="text"
      class="custom-input"
      bind:value={note}
      placeholder={$_('placeholderOfRemark')} />
  </div>
  <div class="mt-4 flex justify-center">
    <button
      on:click={handleSubmit}
      disabled={submitting}
      class="comfirm-btn rounded px-8 py-2 font-medium text-white disabled:opacity-50">
      {submitting ? $_('persist') + '...' : $_('recordTrade')}
    </button>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/TradeForm.svelte
git commit -m "feat: add TradeForm component with buy/sell form"
```

---

### Task 9: TradeHistory Component

**File:**
- Create: `client/src/components/TradeHistory.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { Pagination, Table } from 'flowbite-svelte'
  import SvgIcon from './SvgIcon.svelte'
  import Skeleton from './Skeleton.svelte'
  import { deleteTrade } from '../helper/apis'
  import { alert, notice } from '../stores'
  import type { LinkType } from 'flowbite-svelte'

  const dispatch = createEventDispatcher()

  export let trades: any[] = []
  export let total = 0
  export let page = 1
  export let size = 10
  export let loading = false

  let showDeleteConfirm = false
  let deleteTarget: any = null

  const totalPages = Math.ceil(total / size)

  const formatAmount = (value: any) => {
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const handleDelete = (trade: any) => {
    deleteTarget = trade
    showDeleteConfirm = true
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteTrade(deleteTarget.id)
      notice.set($_('tradeDeleted'))
      showDeleteConfirm = false
      deleteTarget = null
      dispatch('deleted')
    } catch (error: any) {
      alert.set(error?.response?.data?.message || error.message)
    }
  }

  const handlePrevious = () => {
    if (page > 1) {
      dispatch('pageChange', page - 1)
    }
  }

  const handleNext = () => {
    if (page < totalPages) {
      dispatch('pageChange', page + 1)
    }
  }

  $: pages = assemblePagination(totalPages, page)

  const assemblePagination = (total: number, current: number): LinkType[] => {
    if (total <= 1) return []
    const items: LinkType[] = []
    for (let i = 1; i <= total; i++) {
      items.push({
        name: `${i}`,
        active: i === current,
        href: '',
      })
    }
    return items
  }
</script>

<div class="w-full">
  <h3 class="mb-3 text-base font-medium">{$_('recordDetails')}</h3>

  {#if loading}
    <div class="space-y-2">
      <Skeleton width="w-full" height="h-8" />
      <Skeleton width="w-full" height="h-8" />
    </div>
  {:else if trades.length === 0}
    <div class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500">
      {$_('noTrades')}
    </div>
  {:else}
    <Table>
      <thead>
        <tr>
          <th>{$_('tradeDate')}</th>
          <th>{$_('action')}</th>
          <th>{$_('securitySymbol')}</th>
          <th>{$_('securityName')}</th>
          <th class="text-right">{$_('quantity')}</th>
          <th class="text-right">{$_('price')}</th>
          <th class="text-right">{$_('tradeAmount')}</th>
          <th class="text-center">{$_('action')}</th>
        </tr>
      </thead>
      <tbody>
        {#each trades as trade (trade.id)}
          <tr class="hover:bg-gray-50">
            <td class="text-sm">{trade.trade_date}</td>
            <td>
              <span
                class="inline-block rounded-full px-2 py-0.5 text-xs font-medium
                {trade.type === 'BUY'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-700'}">
                {trade.type === 'BUY' ? $_('buy') : $_('sell')}
              </span>
            </td>
            <td class="font-mono text-sm">{trade.security_symbol}</td>
            <td>{trade.security_name}</td>
            <td class="text-right font-mono text-sm">
              {Number(trade.quantity).toLocaleString()}
            </td>
            <td class="text-right font-mono text-sm">
              {formatAmount(trade.price)}
            </td>
            <td class="text-right font-mono text-sm">
              {formatAmount(trade.amount)}
            </td>
            <td class="text-center">
              <button
                on:click={() => handleDelete(trade)}
                class="text-sm text-gray-400 hover:text-red-500"
                title={$_('destroy')}>
                <SvgIcon name="close" width={16} height={16} />
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </Table>

    {#if totalPages > 1}
      <div class="mt-4 flex justify-center">
        <Pagination
          {pages}
          large
          on:previous={handlePrevious}
          on:next={handleNext}
          activeClass="text-brand">
          <svelte:fragment slot="prev">
            <span class="sr-only">Previous</span>
            <SvgIcon name="chevron-left" />
          </svelte:fragment>
          <svelte:fragment slot="next">
            <span class="sr-only">Next</span>
            <SvgIcon name="chevron-right" />
          </svelte:fragment>
        </Pagination>
      </div>
    {/if}
  {/if}
</div>

<!-- Delete confirmation modal -->
{#if showDeleteConfirm}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    on:click={() => (showDeleteConfirm = false)}>
    <div
      class="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
      on:click|stopPropagation>
      <div class="mb-4 flex items-center gap-2">
        <SvgIcon name="close" width={20} height={20} color="#dc2626" />
        <span class="font-medium">{$_('destroy')} {$_('trade')}</span>
      </div>
      <p class="mb-6 text-sm text-gray-600">
        {$_('deleteTradeConfirm')}
      </p>
      <div class="flex justify-center gap-3">
        <button
          on:click={() => (showDeleteConfirm = false)}
          class="cancel-btn rounded px-4 py-2 text-sm">
          {$_('cancel')}
        </button>
        <button
          on:click={confirmDelete}
          class="rounded bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">
          {$_('confirm')}
        </button>
      </div>
    </div>
  </div>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/TradeHistory.svelte
git commit -m "feat: add TradeHistory component with pagination and delete"
```

---

### Task 10: Trade Page

**File:**
- Create: `client/src/routes/Trade.svelte`

- [ ] **Step 1: Create the page**

```svelte
<script lang="ts">
  import { params } from '@roxi/routify'
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import Header from '../components/Header.svelte'
  import Footer from '../components/Footer.svelte'
  import AccountSelector from '../components/AccountSelector.svelte'
  import PositionsTable from '../components/PositionsTable.svelte'
  import TradeForm from '../components/TradeForm.svelte'
  import TradeHistory from '../components/TradeHistory.svelte'
  import { getPositions, getTrades } from '../helper/apis'
  import { updatePageMetaInfo } from '../helper/utils'

  let selectedAccount: any = null
  let positions: any[] = []
  let trades: any[] = []
  let tradeTotal = 0
  let tradePage = 1
  let tradeSize = 10
  let loadingPositions = false
  let loadingTrades = false

  onMount(() => {
    updatePageMetaInfo({
      title: $_('tradePage'),
    })
  })

  const handleAccountSelect = async (event: CustomEvent) => {
    selectedAccount = event.detail
    tradePage = 1
    await Promise.all([fetchPositions(), fetchTrades()])
  }

  const fetchPositions = async () => {
    if (!selectedAccount) return
    loadingPositions = true
    try {
      positions = (await getPositions(selectedAccount.type)) || []
    } catch (error) {
      console.error('Error fetching positions:', error)
    } finally {
      loadingPositions = false
    }
  }

  const fetchTrades = async () => {
    if (!selectedAccount) return
    loadingTrades = true
    try {
      const result = await getTrades(selectedAccount.type, {
        page: tradePage,
        size: tradeSize,
      })
      trades = result.data || []
      tradeTotal = result.total || 0
    } catch (error) {
      console.error('Error fetching trades:', error)
    } finally {
      loadingTrades = false
    }
  }

  const handleTradeCreated = () => {
    Promise.all([fetchPositions(), fetchTrades()])
  }

  const handlePositionUpdated = () => {
    fetchPositions()
  }

  const handleTradeDeleted = () => {
    Promise.all([fetchPositions(), fetchTrades()])
  }

  const handlePageChange = (event: CustomEvent) => {
    tradePage = event.detail
    fetchTrades()
  }

  const handleSell = (event: CustomEvent) => {
    // Forward sell data to TradeForm component
    const tradeForm = document.querySelector('#trade-form-component') as any
    if (tradeForm && tradeForm.selectSell) {
      tradeForm.selectSell({
        symbol: event.detail.security_symbol,
        name: event.detail.security_name,
      })
    }
  }
</script>

<Header />

<div class="flex w-full flex-col items-center justify-center px-4">
  <div class="w-full max-w-5xl">
    <h2 class="mb-6 mt-4 text-xl font-semibold">{$_('tradePage')}</h2>

    <AccountSelector
      bind:selectedAccount
      on:select={handleAccountSelect} />

    {#if selectedAccount}
      <div class="mb-6">
        <h3 class="mb-3 text-base font-medium">{$_('positions')}</h3>
        <PositionsTable
          {positions}
          loading={loadingPositions}
          assetType={selectedAccount.type}
          on:sell={handleSell}
          on:priceUpdated={handlePositionUpdated} />
      </div>

      <div class="mb-6" id="trade-form-component">
        <TradeForm
          assetType={selectedAccount.type}
          on:created={handleTradeCreated} />
      </div>

      <div class="mb-6">
        <TradeHistory
          {trades}
          total={tradeTotal}
          page={tradePage}
          size={tradeSize}
          loading={loadingTrades}
          on:deleted={handleTradeDeleted}
          on:pageChange={handlePageChange} />
      </div>
    {:else}
      <div class="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
        {$_('selectAccount')}
      </div>
    {/if}
  </div>
</div>

<Footer />
```

- [ ] **Step 2: Update `App.svelte` to ensure the new route is lowercase**

The existing `App.svelte` already lowercases route names, so `Trade.svelte` → `trade` route automatically. No change needed.

- [ ] **Step 3: Commit**

```bash
git add client/src/routes/Trade.svelte
git commit -m "feat: add Trade page with positions, form, and history"
```

---

### Task 11: Navigation Integration

**Files:**
- Modify: `client/src/components/Header.svelte`

- [ ] **Step 1: Add trade link to Header navigation**

Before the theme toggle button, add:

```svelte
<a
  href="/trade"
  class="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium
    text-gray-700 hover:bg-gray-100 hover:text-gray-900"
  on:click={() => trackEvent('navigation-click', { page: 'trade' })}>
  <SvgIcon name="adjustment" width={18} height={18} color="#212121" class="mr-1" />
  {$_('trade')}
</a>
```

Place this after the X/Twitter link `<a>` and before the theme toggle `<button>`.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Header.svelte
git commit -m "feat: add trade navigation link to header"
```

---

### Task 12: Verify Build

**Files:** No file changes. Run type check and build.

- [ ] **Step 1: Run type check**

```bash
cd client && npm run check
```

Expected: No errors. If TypeScript errors appear for new components, fix them (likely missing `$:` reactive bindings or prop type annotations).

- [ ] **Step 2: Run build**

```bash
yarn build
```

Expected: Build succeeds, output goes to `server/public/` and `server/dist/`.

- [ ] **Step 3: Start dev server to verify**

Start server in one terminal:
```bash
cd server && npm run dev
```

Start client in another terminal:
```bash
cd client && npm run dev
```

Visit `http://localhost:5173/trade` — should see the trade page with account selector.

- [ ] **Step 4: Final commit with any build fixes**

```bash
git add -A
git commit -m "fix: resolve type and build issues for trade page"
```
