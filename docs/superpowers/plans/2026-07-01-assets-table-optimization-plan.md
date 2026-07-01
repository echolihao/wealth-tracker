# Assets 表结构优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化 Assets 表结构：增加 id 主键，type 限值 CASH/INVESTMENT，alias 必填唯一，关联表外键改为 asset_id，API 路由参数改用 id。

**Architecture:** 重建 assets / record / position / trade 四表，不迁移旧数据；后端控制器查询条件从 type 改为 id；前端增加资产类型选择器、图表分组改为按 alias。

**Tech Stack:** Sequelize + SQLite, Fastify, Svelte 4, ApexCharts

## 全局约束

- 旧数据不迁移：`DROP TABLE IF EXISTS trades, positions, records, assets` 后 `sequelize.sync()`
- SQLite 不支持 `ALTER TABLE DROP COLUMN`，所以用重建方式实现列删除
- 新 API 路由必须注册到 `server/src/routes/index.ts`
- 新 Sequelize 模型必须在 `server/src/index.ts` 的 `loadServerModules()` 中 import，且在 `sequelize.sync()` 之前

---

### 任务 1：修改后端 4 个模型定义

**文件：**
- 修改：`server/src/models/assets.ts`（全部）
- 修改：`server/src/models/records.ts`（type → asset_id）
- 修改：`server/src/models/positions.ts`（asset_type → asset_id + 唯一索引更新）
- 修改：`server/src/models/trades.ts`（asset_type → asset_id）

**接口：**
- 产出：新的 Assets 模型（id PK, type CASH/INVESTMENT, alias UNIQUE NOT NULL）
- 产出：Record 模型增加 asset_id，删除 type
- 产出：Position 模型增加 asset_id，删除 asset_type，唯一索引改为 [asset_id, security_symbol]
- 产出：Trade 模型增加 asset_id，删除 asset_type

- [ ] **步骤 1：修改 Assets 模型**

```typescript
// server/src/models/assets.ts
import { DataTypes, Model } from 'sequelize'
import { sequelize } from './index'

export class Assets extends Model {}

Assets.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['CASH', 'INVESTMENT']],
      },
    },
    alias: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    risk: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'LOW',
    },
    liquidity: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'GOOD',
    },
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    currency: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    datetime: {
      type: DataTypes.DATEONLY,
      allowNull: false,
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
    modelName: 'Assets',
    tableName: 'assets',
    timestamps: false,
  },
)
```

- [ ] **步骤 2：修改 Record 模型**

```typescript
// server/src/models/records.ts — 删除 type 字段，增加 asset_id
import { DataTypes, Model } from 'sequelize'
import { sequelize } from './index'

export class Record extends Model {}

Record.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    asset_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    alias: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    risk: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'LOW',
    },
    liquidity: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'GOOD',
    },
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    currency: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    datetime: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    created: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Record',
    tableName: 'record',
    timestamps: false,
  },
)
```

- [ ] **步骤 3：修改 Position 模型**

```typescript
// server/src/models/positions.ts — asset_type → asset_id，唯一索引更新
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
    asset_id: {
      type: DataTypes.INTEGER,
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
    realized_pnl: {
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
        fields: ['asset_id', 'security_symbol'],
      },
    ],
  },
)
```

- [ ] **步骤 4：修改 Trade 模型**

```typescript
// server/src/models/trades.ts — asset_type → asset_id
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
    asset_id: {
      type: DataTypes.INTEGER,
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
    realized_pnl: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
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

---

### 任务 2：添加数据库迁移逻辑

**文件：**
- 修改：`server/src/index.ts`（在 `connectToSqlite()` 中添加 DROP TABLE 重建逻辑）

**接口：**
- 依赖：任务 1 的新模型定义
- 时序：在 `sequelize.sync()` 之前执行

- [ ] **步骤 1：添加 DROP TABLE 迁移代码**

在 `server/src/index.ts` 的 `connectToSqlite()` 中，`sequelize.sync()` 调用之前，添加：

```typescript
// 重建 assets / record / position / trade 四表
const tablesToRebuild = ['trades', 'positions', 'record', 'assets']
for (const table of tablesToRebuild) {
  await sequelize.query(`DROP TABLE IF EXISTS "${table}"`)
}
```

> 注意：不要使用 `sequelize.sync({ force: true })`，因为那会删除所有表（包括 password、session、user_settings、custom_currencies、goals、insights）。我们只需显式删除要重建的 4 张表，然后让后续的 `sequelize.sync()` 自动创建它们。

---

### 任务 3：修改 assets 控制器

**文件：**
- 修改：`server/src/controllers/assets.ts`

**接口：**
- 依赖：任务 1 的 Assets 模型（id PK，type 改为 CASH/INVESTMENT）
- 消耗：前端传入 `{ type: 'CASH'|'INVESTMENT', alias: string, ... }`
- 产出：CRUD 操作通过 `id` 查询而非 `type`

- [ ] **步骤 1：修改 `create` 控制器**

```typescript
export const create = async (request, reply) => {
  const params = request?.body
  try {
    const options = {
      type: params.type,         // 由前端传入 'CASH' | 'INVESTMENT'
      alias: params.alias,
      amount: params.amount,
      currency: params.currency,
      note: params.note,
      datetime: params.datetime,
      risk: params.risk,
      liquidity: params.liquidity,
      tags: params.tags || '',
      updated: new Date(),
    }
    const assets = await Assets.create(options)
    await Record.create({
      ...assets.dataValues,
      asset_id: assets.id,    // 改为 asset_id
      // type 不再写入 Record
    })
    return reply.send(assets)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}
```

- [ ] **步骤 2：修改 `update` 控制器**

```typescript
export const update = async (request, reply) => {
  const params = request?.body
  const now = new Date()
  try {
    const options = {
      alias: params.alias,
      amount: params.amount,
      currency: params.currency,
      note: params.note,
      datetime: params.datetime,
      created: params.created,
      risk: params.risk,
      liquidity: params.liquidity,
      tags: params.tags || '',
      updated: now,
    }
    await Assets.update(options, {
      where: { id: params.id },    // type → id
    })
    await Record.create({
      ...options,
      asset_id: params.id,         // 改为 asset_id
      created: now,
    })
    return reply.send({ success: true })
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}
```

- [ ] **步骤 3：修改 `destroy` 控制器**

```typescript
export const destroy = async (request, reply) => {
  const { id = null } = request?.body    // type → id
  try {
    await sequelize.transaction(async (t) => {
      await Trade.destroy({ where: { asset_id: id }, transaction: t })
      await Position.destroy({ where: { asset_id: id }, transaction: t })
      await Record.destroy({ where: { asset_id: id }, transaction: t })
      await Assets.destroy({ where: { id }, transaction: t })
    })
    return reply.send({ result: true })
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}
```

---

### 任务 4：修改 trades 控制器

**文件：**
- 修改：`server/src/controllers/trades.ts`

**接口：**
- 依赖：任务 1 的模型（asset_id 替换 asset_type）
- 消耗：路由参数 `:id`（原 `:assetType`）
- 产出：查询条件统一改为 `asset_id`

- [ ] **步骤 1：修改 `getSecuritiesAccounts`**

```typescript
export const getSecuritiesAccounts = async (_, reply) => {
  try {
    const data = await Assets.findAll({
      where: { type: 'INVESTMENT' },   // 从 Op.startsWith('securities:') 改为
    })
    return reply.send(data)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}
```

- [ ] **步骤 2：修改 `getPositions`**

```typescript
export const getPositions = async (request, reply) => {
  const { id } = request.params   // assetType → id
  try {
    const data = await Position.findAll({
      where: { asset_id: id },    // asset_type → asset_id
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
```

- [ ] **步骤 3：修改 `updatePositionPrice`**

```typescript
export const updatePositionPrice = async (request, reply) => {
  const { id, symbol } = request.params   // assetType → id
  const { current_price, amount } = request.body
  try {
    const result = await sequelize.transaction(async (t) => {
      const position = await Position.findOne({
        where: { asset_id: id, security_symbol: symbol },   // asset_type → asset_id
        transaction: t,
      })
      if (!position) {
        throw new Error('Position not found.')
      }
      const updateData: any = { updated: new Date() }
      if (current_price !== undefined) {
        updateData.current_price = current_price
      }
      if (amount !== undefined) {
        updateData.amount = amount
      }
      await Position.update(updateData, {
        where: { asset_id: id, security_symbol: symbol },
        transaction: t,
      })
      const updated = await Position.findOne({
        where: { asset_id: id, security_symbol: symbol },
        transaction: t,
      })
      return updated
    })
    return reply.send(result)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}
```

- [ ] **步骤 4：修改 `getTrades`**

将 `where: { asset_type: assetType }` 改为 `where: { asset_id: id }`，参数名改为 `id`。

```typescript
export const getTrades = async (request, reply) => {
  const { id } = request.params
  const { page = 1, size = 10, startDate, endDate, type, symbol } = request.query
  try {
    const offset = (page - 1) * size
    const whereClause: any = { asset_id: id }

    if (startDate) {
      whereClause.trade_date = { ...whereClause.trade_date, [Op.gte]: startDate }
    }
    if (endDate) {
      whereClause.trade_date = { ...whereClause.trade_date, [Op.lte]: endDate }
    }
    if (type) {
      whereClause.type = type
    }
    if (symbol) {
      whereClause.security_symbol = { [Op.like]: `%${symbol}%` }
    }

    const { count, rows } = await Trade.findAndCountAll({
      where: whereClause,
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
```

- [ ] **步骤 5：修改 `createTrade`**

```typescript
export const createTrade = async (request, reply) => {
  const { id } = request.params
  const params = request.body

  if (!id) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Asset id is required.',
    })
  }
  const account = await Assets.findByPk(id)
  if (!account || account.type !== 'INVESTMENT') {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Invalid securities account type.',
    })
  }
  // ... 校验与之前相同 ...
```

将所有 `assetType` 改为 `id`，所有 `asset_type` 改为 `asset_id`：
- `Position.findOne({ where: { asset_id: id, security_symbol: params.security_symbol } })`
- `Trade.create({ ... , asset_id: id, ... })`
- `Position.create({ ... , asset_id: id, ... })`

- [ ] **步骤 6：修改 `updateTrade` 和 `deleteTrade`**

```typescript
export const updateTrade = async (request, reply) => {
  const { id } = request.params
  const params = request.body
  try {
    let updated
    await sequelize.transaction(async (t) => {
      const oldTrade = await Trade.findByPk(id, { transaction: t })
      if (!oldTrade) {
        throw new Error('Trade not found.')
      }
      await reverseTradeEffect(oldTrade, t)
      // ...后续用 oldTrade.asset_id 代替 oldTrade.asset_type...
      await applyTradeEffect(oldTrade.asset_id, ...)
      // ...
    })
    return reply.send(updated)
  } catch (error: any) {
    return reply.code(400).send({
      statusCode: 400,
      message: error.message,
    })
  }
}
```

在 `updateTrade`、`deleteTrade`、`reverseTradeEffect`、`applyTradeEffect`、`importTrades` 中，所有 `trade.asset_type` / `assetType` 改为 `trade.asset_id` / `id`，所有 `where: { asset_type: ... }` 改为 `where: { asset_id: ... }`。

- [ ] **步骤 7：修改 `reverseTradeEffect` 辅助函数**

替换全部 `asset_type` 引用为 `asset_id`：

```typescript
async function reverseTradeEffect(trade: any, t: any) {
  const assetId = trade.asset_id
  const symbol = trade.security_symbol
  // ...
  const existing = await Position.findOne({
    where: { asset_id: assetId, security_symbol: symbol },
    transaction: t,
  })
  // ...
  // Position.create 中使用 asset_id: assetId
}
```

- [ ] **步骤 8：修改 `applyTradeEffect` 辅助函数**

签名改为 `applyTradeEffect(assetId: number, type: string, ...)`，内部 `asset_type` 全部替换为 `asset_id`。

- [ ] **步骤 9：修改 `importTrades` 控制器**

```typescript
export const importTrades = async (request, reply) => {
  const { id } = request.params   // assetType → id

  if (!id) { ... }

  const account = await Assets.findByPk(id)
  if (!account || account.type !== 'INVESTMENT') {
    return reply.code(400).send({ ... })
  }
  // ...后续所有 assetType 改为 id，asset_type 改为 asset_id...
}
```

---

### 任务 5：修改路由配置

**文件：**
- 修改：`server/src/routes/trades.ts`

- [ ] **步骤 1：更新路由路径参数**

```typescript
// server/src/routes/trades.ts
{
  method: 'GET',
  url: '/api/assets/:id/positions',            // :assetType → :id
  handler: getPositions,
},
{
  method: 'PUT',
  url: '/api/assets/:id/positions/:symbol',    // :assetType → :id
  handler: updatePositionPrice,
},
{
  method: 'GET',
  url: '/api/assets/:id/trades',               // :assetType → :id
  handler: getTrades,
},
{
  method: 'POST',
  url: '/api/assets/:id/trades',               // :assetType → :id
  handler: createTrade,
},
{
  method: 'POST',
  url: '/api/assets/:id/trades/import',        // :assetType → :id
  handler: importTrades,
},
```

---

### 任务 6：修改备份控制器

**文件：**
- 修改：`server/src/controllers/backup.ts`

- [ ] **步骤 1：修改 Record 去重键函数**

`genRecordKey` 中 `item.type` → `item.asset_id`：

```typescript
const genRecordKey = (item: any) => {
  const created = item.created ? new Date(item.created).getTime() : 0
  return [item.asset_id, item.datetime, Number(item.amount), item.currency, created].join('|')
}
```

- [ ] **步骤 2：修改资产导入逻辑**

`Assets.upsert` 不再通过 `type` 作为主键，所以改为先 `findOne` 再 `create`：

```typescript
if (Array.isArray(data.assets)) {
  for (const item of data.assets) {
    if (!item?.alias || item.amount === undefined) continue
    const existing = await Assets.findOne({ where: { alias: item.alias } })
    if (existing) {
      await existing.update({
        amount: normalizeImportedAmount(item),
        currency: item.currency || 'CNY',
        note: item.note || '',
        risk: item.risk || 'LOW',
        liquidity: item.liquidity || 'GOOD',
        tags: item.tags || '',
        datetime: item.datetime,
        updated: new Date(),
      })
    } else {
      await Assets.create({
        type: 'CASH',   // 旧备份无 type 分类，默认 CASH
        alias: item.alias,
        amount: normalizeImportedAmount(item),
        currency: item.currency || 'CNY',
        note: item.note || '',
        risk: item.risk || 'LOW',
        liquidity: item.liquidity || 'GOOD',
        tags: item.tags || '',
        datetime: item.datetime,
        created: item.created || new Date(),
        updated: new Date(),
      })
    }
    counts.assets += 1
  }
}
```

- [ ] **步骤 3：修改 Record 导入逻辑**

Record 导入的 `type` 字段改为 `asset_id`（导入时在 item 上用 asset_id）：

```typescript
.map((item: any) => ({
  asset_id: item.asset_id,
  alias: item.alias || '',
  // ...
}))
```

- [ ] **步骤 4：修改 Position 导入逻辑**

```typescript
if (Array.isArray(data.positions)) {
  for (const item of data.positions) {
    if (!item?.asset_id || !item?.security_symbol) continue
    await Position.upsert({
      id: item.id,
      asset_id: item.asset_id,       // asset_type → asset_id
      // ...
    })
    counts.positions += 1
  }
}
```

- [ ] **步骤 5：修改 Trade 导入逻辑**

```typescript
if (Array.isArray(data.trades)) {
  for (const item of data.trades) {
    if (!item?.asset_id || !item?.security_symbol) continue
    // ...
    await Trade.create({
      asset_id: item.asset_id,       // asset_type → asset_id
      // ...
    })
  }
}
```

---

### 任务 7：更新前端类型与常量

**文件：**
- 修改：`client/src/typings/index.d.ts`
- 修改：`client/src/helper/constant.ts`

- [ ] **步骤 1：更新 AssetsItem 类型**

```typescript
// client/src/typings/index.d.ts
export interface AssetsItem {
  id?: number
  type: string        // 'CASH' | 'INVESTMENT'
  alias: string
  amount: number
  currency: string
  risk: string
  liquidity: string
  datetime: string
  note: string
  tags?: string
}
```

- [ ] **步骤 2：在 constant.ts 中增加 ASSETS_TYPE_ARR**

```typescript
// client/src/helper/constant.ts
export const ASSETS_TYPE_ARR = [
  { key: 'cash', value: 'CASH' },
  { key: 'investment', value: 'INVESTMENT' },
]
```

- [ ] **步骤 3：修改 DEFAULT_ACCOUNT_ITEM**

```typescript
export const DEFAULT_ACCOUNT_ITEM = {
  type: 'CASH',                    // 改为固定值，不再是 Date.now().toString()
  alias: '',
  currency: 'CNY',
  risk: RISK_TYPES[0],
  liquidity: LIQUIDITY_TYPES[0],
  amount: 0,
  datetime: dayjs().format('YYYY-MM-DD'),
  note: '',
}
```

---

### 任务 8：更新前端 API 封装

**文件：**
- 修改：`client/src/helper/apis.ts`

- [ ] **步骤 1：修改资产相关函数**

`destroyAssets` 参数从 `{ type }` 改为 `{ id }`。

```typescript
export const destroyAssets = (data: { id: number }) => {
  return $ajax.delete(genApiPath('assets'), data)
}
```

`createAssets` / `updateAssets` 的 body 保持不变（核心数据字段不变，type 取值变了，id 由后端返回）。

- [ ] **步骤 2：修改交易相关函数**

```typescript
export const getPositions = (id: number) => {
  return $ajax.get(genApiPath(`assets/${id}/positions`))
}

export const updatePositionPrice = (id: number, symbol: string, data: any) => {
  return $ajax.put(genApiPath(`assets/${id}/positions/${symbol}`), data)
}

export const getTrades = (id: number, params?: any) => {
  return $ajax.get(genApiPath(`assets/${id}/trades`), params)
}

export const createTrade = (id: number, data: any) => {
  return $ajax.post(genApiPath(`assets/${id}/trades`), data)
}

export const importTrades = (id: number, data: FormData) => {
  return $ajax.post(genApiPath(`assets/${id}/trades/import`), data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
```

---

### 任务 9a：添加国际化翻译键值

**文件：**
- 修改：`client/src/lang/zh.json`
- 修改：`client/src/lang/en.json`
- 修改：`client/src/lang/ja.json`
- 修改：`client/src/lang/fr.json`
- 修改：`client/src/lang/zh-tw.json`

- [ ] **步骤 1：zh.json 添加**

在 `zh.json` 中添加：
```json
"assetType": "资产类型",
"cash": "现金",
"investment": "投资"
```

- [ ] **步骤 2：en.json 添加**

```json
"assetType": "Asset Type",
"cash": "Cash",
"investment": "Investment"
```

- [ ] **步骤 3：zh-tw.json 添加**

```json
"assetType": "資產類型",
"cash": "現金",
"investment": "投資"
```

- [ ] **步骤 4：ja.json 添加**

```json
"assetType": "資産タイプ",
"cash": "現金",
"investment": "投資"
```

- [ ] **步骤 5：fr.json 添加**

```json
"assetType": "Type d'actif",
"cash": "Liquidités",
"investment": "Investissement"
```

---

### 任务 9b：修改前端创建/编辑弹窗

**文件：**
- 修改：`client/src/components/Modal/Update.svelte`

- [ ] **步骤 1：导入 ASSETS_TYPE_ARR**

在 import 中新增：
```typescript
import {
  ACTION_TYPES,
  ASSETS_RISK_ARR,
  ASSETS_LIQUIDITY_ARR,
  ASSETS_TYPE_ARR,              // 新增
  DEFAULT_ACCOUNT_ITEM,
  getAllCurrencies,
} from './../../helper/constant'
```

- [ ] **步骤 2：添加 $localizedTypeArr 响应式声明**

```typescript
// 在 Update.svelte script 中，与 localizedRiskArr 等并列
$: localizedTypeArr = ASSETS_TYPE_ARR.map((item) => ({
  name: $_(item.key),
  value: item.value,
}))
```

- [ ] **步骤 3：添加 type 选择器事件处理**

```typescript
const handleTypeSelect = (event) => {
  items.type = event.detail.value
}
```

- [ ] **步骤 4：在模板中增加资产类型选择器**

在 `account` 输入框下方增加类型选择器：

```svelte
<div class="module-warp">
  <label for="update-currency" class="custom-label">
    {$_('assetType')}
  </label>
  <div class="w-full">
    <CustomSelect
      options={localizedTypeArr}
      active={genTypeActive(items.type)}
      listboxClass="w-full"
      on:selected={handleTypeSelect} />
  </div>
</div>
```

并添加 `genTypeActive` 辅助函数：
```typescript
const genTypeActive = (type) => {
  return ASSETS_TYPE_ARR.findIndex((item) => item.value === type)
}
```

---

### 任务 10：修改前端页面

**文件：**
- 修改：`client/src/routes/Index.svelte`

- [ ] **步骤 1：修改 `handleAdd`**

```typescript
const handleAdd = () => {
  currentAssetItem = deepClone(DEFAULT_ACCOUNT_ITEM)
  // 不再设置 currentAssetItem.type = Date.now().toString()
  updateActionType = ACTION_TYPES.create
  isShowUpdateModal = true
}
```

- [ ] **步骤 2：修改删除逻辑**

`typeToBeDestroyed` → `assetIdToBeDestroyed`，调用 `destroyAssets` 时传 `{ id }`。

```typescript
let assetIdToBeDestroyed: number | null = null

// 假设有个 handleConfirmDestroy
const handleConfirmDestroy = async () => {
  if (assetIdToBeDestroyed == null) return
  try {
    await destroyAssets({ id: assetIdToBeDestroyed })
    assetIdToBeDestroyed = null
    fetchDatabase()
  } catch (error) {
    console.error('Error destroying asset:', error)
  }
}
```

---

### 任务 11：修改图表组件分组逻辑

**文件：**
- 修改：`client/src/components/ChartWidget/AreaChart.svelte`
- 修改：`client/src/components/ChartWidget/BindingChart.svelte`

- [ ] **步骤 1：修改 AreaChart 分组调用**

`AreaChart.svelte:76` 将：
```typescript
const splitAssetsArr = groupArrayByType(sortedAssetsArr)
```
改为：
```typescript
const splitAssetsArr = groupArrayByType(sortedAssetsArr, 'alias')
```

- [ ] **步骤 2：修改 BindingChart 分组调用**

`BindingChart.svelte:126` 将：
```typescript
const splitAssetsArr = groupArrayByType(sortedAssetsArr)
```
改为：
```typescript
const splitAssetsArr = groupArrayByType(sortedAssetsArr, 'alias')
```

- [ ] **步骤 3：修改 BindingChart 账户筛选**

账户筛选的 `selectedAccount` 从匹配 `type` 改为匹配 `alias`：

```typescript
// BindingChart.svelte 中 regenAreaOptions 内的筛选逻辑
$: filteredByAccount = sources.filter((item) => {
  if (selectedAccount === 'ALL') return true
  return item.alias === selectedAccount    // type → alias
})
```

---

### 任务 12：修改测试文件

**文件：**
- 修改：`server/src/controllers/trades.test.ts`

- [ ] **步骤 1：更新 Mock 模型字段**

```typescript
// trades.test.ts 中的 Assets mock
const mockAssets = {
  findByPk: vi.fn(),
  findAll: vi.fn(),
}

// Position mock 中的 asset_type → asset_id
const mockPosition = {
  // asset_type: 'test',
  asset_id: 1,
  // ...
}

// Trade mock 中的 asset_type → asset_id
const mockTrade = {
  // asset_type: 'test',
  asset_id: 1,
  // ...
}
```

---

## 实施顺序

任务可部分并行，推荐执行顺序：

```
任务 1（模型定义）              ← 基础
   ↓
任务 2（迁移代码）              ← 依赖任务 1
   ↓
任务 3（assets 控制器）         ← 依赖任务 1
任务 4（trades 控制器）         ← 依赖任务 1
任务 5（路由配置）              ← 依赖任务 4
任务 6（备份控制器）            ← 依赖任务 1
   ↓
任务 7（前端类型与常量）        ← 可与后端任务并行
任务 8（前端 API 封装）         ← 依赖任务 7
任务 9（前端创建/编辑弹窗）     ← 依赖任务 7, 8
任务 10（前端页面）             ← 依赖任务 7, 8
任务 11（图表组件）             ← 依赖任务 7
   ↓
任务 12（测试文件）             ← 最后，可随时更新
```
