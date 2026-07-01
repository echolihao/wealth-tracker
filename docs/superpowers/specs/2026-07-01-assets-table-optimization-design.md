# Assets 表结构优化设计

日期: 2026-07-01
状态: 待评审

## 需求概述

优化 Assets 表结构：
1. 增加 `id` 字段作为自增主键
2. `type` 不再是主键，也不是唯一键，取值限定为 `CASH` / `INVESTMENT`
3. `alias` 改为必填且唯一的资产名称
4. 所有 `INVESTMENT` 类型的资产默认支持交易功能（不再需要 `securities:` 前缀判断）
5. Record / Position / Trade 表的关联外键从 `type`/`asset_type` 改为 `asset_id`
6. API 路由路径参数从 `assetType` 改为 `id`
7. 旧数据不迁移（数据库重建），删除 `asset_type` 等旧列

## 影响范围

- 后端模型: `Assets`, `Record`, `Position`, `Trade`
- 后端测试: `trades.test.ts`
- 后端控制器: `assets.ts`, `trades.ts`, `backup.ts`（upsert / findOrCreate 受主键变更影响）
- 后端路由: `assets.ts`, `trades.ts`, `routes/index.ts`
- 前端类型定义: `typings/index.d.ts`
- 前端常量: `constant.ts`
- 前端 API 封装: `apis.ts`
- 前端页面: `Index.svelte`, `Status.svelte`, `Advice.svelte`
- 前端组件: `Update.svelte`, `AreaChart.svelte`, `BindingChart.svelte`, `TreemapChart.svelte` 等

## 设计方案

### 1. 新 Assets 表结构

```sql
CREATE TABLE assets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT    NOT NULL,           -- CASH | INVESTMENT
  alias      TEXT    NOT NULL UNIQUE,    -- 资产名称，必填唯一
  amount     DECIMAL(10,2) NOT NULL,
  currency   TEXT    NOT NULL,
  note       TEXT    DEFAULT '',
  risk       TEXT    NOT NULL DEFAULT 'LOW',
  liquidity  TEXT    NOT NULL DEFAULT 'GOOD',
  tags       TEXT    DEFAULT '',
  datetime   DATE    NOT NULL,
  created    DATE,
  updated    DATE    NOT NULL
);
```

#### AssetsItem 类型定义 (TypeScript)

```typescript
interface AssetsItem {
  id?: number
  type: 'CASH' | 'INVESTMENT'
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

### 2. Record 表结构变更

| 操作 | 字段 | 类型 | 说明 |
|------|------|------|------|
| 新增 | `asset_id` | `INTEGER` | 关联 assets.id |
| 删除 | `type` | — | 不再需要 |

Record 其余字段与 Assets 字段结构一致，用于存储历史快照。

### 3. Position 表结构变更

| 操作 | 字段 | 类型 | 说明 |
|------|------|------|------|
| 新增 | `asset_id` | `INTEGER` | 关联 assets.id |
| 删除 | `asset_type` | — | 不再需要 |
| 更新 | 唯一索引 | — | `[asset_type, security_symbol]` → `[asset_id, security_symbol]` |

### 4. Trade 表结构变更

| 操作 | 字段 | 类型 | 说明 |
|------|------|------|------|
| 新增 | `asset_id` | `INTEGER` | 关联 assets.id |
| 删除 | `asset_type` | — | 不再需要 |

### 5. API 路由变更

| 方法 | 旧路径 | 新路径 | 控制器变化 |
|------|--------|--------|-----------|
| `GET` | `/api/trades/securities-accounts` | 不变 | `type startsWith 'securities:'` → `type = 'INVESTMENT'` |
| `GET` | `/api/assets/:assetType/positions` | `/api/assets/:id/positions` | 参数改为 id |
| `PUT` | `/api/assets/:assetType/positions/:symbol` | `/api/assets/:id/positions/:symbol` | 同上 |
| `GET` | `/api/assets/:assetType/trades` | `/api/assets/:id/trades` | 同上 |
| `POST` | `/api/assets/:assetType/trades` | `/api/assets/:id/trades` | 同上 |
| `POST` | `/api/assets/:assetType/trades/import` | `/api/assets/:id/trades/import` | 同上 |

注意：Assets 自身的 CRUD 路由（`POST/GET/PUT/DELETE /api/assets`）路径不变，仅内部查询条件从 `where: { type }` 改为 `where: { id }`。

### 6. 前端变更

#### 常量 (constant.ts)

```typescript
// 新增资产类型选项
export const ASSETS_TYPE_ARR = [
  { key: 'cash', value: 'CASH' },
  { key: 'investment', value: 'INVESTMENT' },
]

// DEFAULT_ACCOUNT_ITEM 修改
export const DEFAULT_ACCOUNT_ITEM = {
  type: 'CASH',           // 改为固定值，不再是 Date.now().toString()
  alias: '',
  currency: 'CNY',
  risk: RISK_TYPES[0],
  liquidity: LIQUIDITY_TYPES[0],
  amount: 0,
  datetime: dayjs().format('YYYY-MM-DD'),
  note: '',
}
```

#### 创建/编辑弹窗 (Update.svelte)

- 新增「资产类型」选择器（CASH / INVESTMENT 下拉）
- `type` 字段改为选择器，不可自由输入
- `alias` 输入保留但增加唯一性校验提示

#### 图表组件

- `AreaChart` / `BindingChart` 中按 `type` 分组的逻辑改为按 `alias`（资产名称）分组
- `BindingChart` 的账户筛选条件从 `type` 改为 `id` 或 `alias`
- 其余图表组件仅类型定义变化，展示逻辑不变

#### 页面

- `Index.svelte`: 创建时 `type` 不再赋值 `Date.now().toString()`；删除逻辑改为用 `id`
- `Status.svelte`、`Advice.svelte`: AssetsItem 类型变化自动适配，无其他改动

### 7. 数据迁移方案

**采用完整重建：不迁移旧数据。**

由于 Assets 表结构变化较大（主键变更、type 语义变化），且关联表均需新增/删除列，最安全的方式是：
1. 数据库重建（assets / record / position / trade 四表）
2. 用户在重建后重新录入资产数据

`server/src/index.ts` 中 `connectToSqlite()` 迁移逻辑：
- 用原始 SQL 仅删除这 4 张表：`DROP TABLE IF EXISTS trades, positions, records, assets`
- 调用 `sequelize.sync()`（无 force 参数）根据新模型定义自动重建

注意：这会导致旧的资产、持仓、交易数据全部丢失。需在重置日志中提示用户。

### 8. 前端 API 封装变化 (apis.ts)

- `destroyAssets({ type })` → `destroyAssets({ id })`
- 交易模块函数（`getPositions`, `getTrades`, `createTrade` 等）路径参数从 `assetType` 改为 `id`
- `createAssets` / `updateAssets` body 结构不变（但 type 字段值变为 CASH/INVESTMENT）
