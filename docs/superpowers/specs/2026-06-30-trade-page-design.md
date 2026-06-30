# 交易操作页面设计文档

> 创建日期: 2026-06-30
> 状态: 定稿

## 概述

在 Wealth Tracker 中新增交易操作页面（`/trade`），支持用户记录和管理证券（股票/ETF等）的买入/卖出交易。引入持仓（Positions）和交易明细（Trades）两张新表，建立"证券账户 → 持仓 → 交易"的三层数据模型。

## 数据模型

### Positions 表（持仓表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, autoIncrement | 自增主键 |
| `asset_type` | STRING | NOT NULL | 关联 Assets.type，如 `securities:华泰证券` |
| `security_symbol` | STRING | NOT NULL | 证券代码，如 `0700.HK` |
| `security_name` | STRING | NOT NULL | 证券名称，如 `腾讯控股` |
| `quantity` | DECIMAL(14,2) | NOT NULL | 当前持有数量 |
| `cost_price` | DECIMAL(14,4) | NOT NULL | 加权平均成本价 |
| `current_price` | DECIMAL(14,4) | nullable | 最新参考价（手动输入） |
| `amount` | DECIMAL(14,2) | NOT NULL | 持仓总金额（quantity × current_price） |
| `status` | ENUM('Open','Closed') | NOT NULL, DEFAULT 'Open' | 持仓状态 |
| `created` | DATE | DEFAULT NOW | 创建时间 |
| `updated` | DATE | 自动更新 | 更新时间 |

**唯一约束：** (asset_type, security_symbol)

### Trades 表（交易记录表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, autoIncrement | 自增主键 |
| `asset_type` | STRING | NOT NULL | 关联 Assets.type |
| `security_symbol` | STRING | NOT NULL | 证券代码 |
| `security_name` | STRING | NOT NULL | 证券名称 |
| `type` | ENUM('BUY','SELL') | NOT NULL | 交易类型 |
| `quantity` | DECIMAL(14,2) | NOT NULL | 交易数量（正数） |
| `price` | DECIMAL(14,4) | NOT NULL | 每股价格（正数） |
| `amount` | DECIMAL(14,2) | NOT NULL | 成交金额（quantity × price） |
| `trade_date` | DATEONLY | NOT NULL | 交易日期 |
| `note` | TEXT | nullable | 备注 |
| `created` | DATE | DEFAULT NOW | 创建时间 |

### 关键设计决策

- 证券账户沿用现有 `Assets` 表，通过 `type = 'securities:xxx'` 标识
- 交易操作不生成 Records，独立管理
- amount = quantity × price，方便汇总统计
- Positions 不删除归零行，改为 Closed 状态保留历史

## API 设计

### 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/trades/securities-accounts` | 获取所有证券账户列表 |
| `GET` | `/api/assets/:assetType/positions` | 获取指定账户的持仓列表 |
| `PUT` | `/api/assets/:assetType/positions/:symbol` | 更新持仓现价 |
| `GET` | `/api/assets/:assetType/trades` | 获取指定账户的交易历史（分页） |
| `POST` | `/api/assets/:assetType/trades` | 新增一笔交易 |
| `PUT` | `/api/trades/:id` | 编辑一笔交易 |
| `DELETE` | `/api/trades/:id` | 删除一笔交易 |

### 新增交易流程

1. 校验请求参数（字段必填、类型合法、数量 > 0、sell 时数量充足）
2. 在事务中插入 Trades 记录
3. Buy → Positions upsert: 增加 quantity，加权更新 cost_price
4. Sell → Positions 扣减 quantity，归零时 status = 'Closed'
5. 重新计算该账户下所有 Open 持仓的 amount 之和
6. 返回完整交易记录

### 编辑/删除交易流程

1. 在事务中回退原交易的影响（反向操作 Positions）
2. 应用新数据（编辑）或完成（删除）
3. 重新计算持仓 amount

## 页面布局

```
┌─ 账户选择器 ──────────────────────────────────┐
│  [华泰证券 ▼]    总投资 ¥XXX,XXX   N 支证券   │
├─ 持仓列表 ────────────────────────────────────┤
│  代码 │ 名称 │ 数量 │ 成本价 │ 现价 │ 金额   │
│  ...  │ ...  │ ...  │ ...    │ ...  │ ...    │
├─ 快速交易表单 ────────────────────────────────┤
│  [买入 ○] [卖出 ●]  代码 [___]  名称 [___]  │
│  数量 [___] 单价 [___] 金额 [自动计算]       │
│  日期 [______] 备注 [____________________]   │
│              [  记 录 交 易  ]               │
├─ 交易历史 ──────────────────── [分页] ──────┤
│  日期 │ 类型 │ 代码 │ 数量 │ 单价 │ 金额     │
│  ...  │ ...  │ ...  │ ...  │ ...  │ ...      │
└──────────────────────────────────────────────┘
```

## 前端实现

### 新增文件

| 文件 | 说明 |
|------|------|
| `client/src/routes/Trade.svelte` | 页面主入口 |
| `client/src/components/AccountSelector.svelte` | 证券账户下拉选择器 |
| `client/src/components/PositionsTable.svelte` | 持仓表格（行内编辑现价，快速卖出入口） |
| `client/src/components/TradeForm.svelte` | 买入/卖出表单 |
| `client/src/components/TradeHistory.svelte` | 分页交易历史表格 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `client/src/components/Header.svelte` | 导航栏新增"交易"入口 |
| `client/src/helper/apis.ts` | 新增 7 个交易相关 API 调用函数 |
| `client/src/lang/*.json` | 新增约 20 个多语言词条 |

### 组件状态覆盖

每个组件需覆盖：**加载中、空数据、正常、错误** 四种状态。表单需额外覆盖：**提交中、校验失败、提交成功、提交失败**。

## 服务端实现

### 新增文件

| 文件 | 说明 |
|------|------|
| `server/src/models/positions.ts` | Positions 模型定义 |
| `server/src/models/trades.ts` | Trades 模型定义 |
| `server/src/routes/trades.ts` | 交易路由注册 |
| `server/src/controllers/trades.ts` | 交易业务逻辑 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `server/src/index.ts` | 导入并初始化 Positions 和 Trades 模型 |
| `server/src/routes/index.ts` | 注册 trades 路由 |
| `server/src/controllers/assets.ts` | 删除资产时级联删除相关 Positions 和 Trades |

### 关键实现要求

- 所有 Trades + Positions 操作使用 Sequelize 事务
- 加权成本价：买入时 (原数量×原成本 + 新数量×买入价) / (原数量+新数量)，卖出时不改成本价
- 输入校验包含前端和服务端双重验证
- 服务端增加防重复提交保护

## 边界情况

| 场景 | 处理 |
|------|------|
| 卖出数量超过持仓数量 | 400 错误，提示可卖数量 |
| asset_type 不是 securities: 前缀 | 400 错误 |
| 证券账户不存在 | 404 错误 |
| 删除含持仓的证券账户 | 级联删除所有关联 Positions 和 Trades |
| 网络中断/重复提交 | toast 提示 + 按钮 disabled |
| 已有同名股票重新买入（Closed） | status 恢复 Open，重新开始计算 |
