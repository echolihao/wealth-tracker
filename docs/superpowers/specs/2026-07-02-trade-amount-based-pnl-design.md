# 基于实际成交金额的盈亏计算

**日期**: 2026-07-02
**状态**: 待实现

## 背景

券商导出的交易 CSV 中，当一笔交易以多个不同价格分笔成交时，券商只提供一个汇总均价（price）和实际总成交金额（amount）。此时 `amount ≠ quantity × price`。

例如：
```
quantity=223,700, price=1.8240, amount=407,954.20
quantity × price = 408,028.80  (偏差 74.60)
```

当前系统在 CSV 导入时能保留实际 amount 并发出警告，但后续盈亏计算仍基于 `quantity × price`，导致计算出的盈亏与实际数据存在偏差。

**核心问题**：`price` 只是一个汇总参考价，不应该作为盈亏计算的依据。真金白银的 `amount` 才是正确的计算基准。

## 设计目标

1. BUY/SELL 的盈亏和成本计算统一使用实际 `amount` 替代 `quantity × price`
2. 同时适用于 CSV 批量导入和手动单笔录入
3. `price` 字段保留原值作为参考报价，不参与计算
4. 不修改数据库 schema

## 公式变更

### BUY — 持仓成本价

**新建持仓**：
```
旧: cost_price = (quantity × price + fee) / quantity
新: cost_price = (amount + fee) / quantity
```

**加仓（加权平均）**：
```
旧: newCost = (oldQty × oldCost + quantity × price + fee) / newQty
新: newCost = (oldQty × oldCost + amount + fee) / newQty
```

### SELL — 已实现盈亏

```
旧: realizedPnl = (price - costPrice) × quantity - fee
新: realizedPnl = (amount - fee) - costPrice × quantity
```

解读：`(amount - fee)` 是卖出净收入，减去卖出部分的成本基数，即为已实现盈亏。

### Reverse BUY — 还原成本

```
旧: restoredCost = (oldQty × oldCost - quantity × price - fee) / newQty
新: restoredCost = (oldQty × oldCost - amount - fee) / newQty
```

## 代码变更

### 1. `applyTradeEffect()` — 新增 amount 参数

**文件**: `server/src/controllers/trades.ts`

函数签名新增 `amount: number` 参数（位于 `price` 之后）：

```typescript
async function applyTradeEffect(
  assetId: number,
  type: string,
  symbol: string,
  name: string,
  quantity: number,
  price: number,
  amount: number,  // 新增
  t: any,
  tradeDate?: string,
  existingPosition?: any,
  fee: number = 0,
)
```

**具体改动**：

- L515 (BUY 加仓加权成本): `quantity * price` → `amount`
- L538 (BUY 新建持仓成本): `quantity * price` → `amount`
- L563 (SELL 已实现盈亏): `(price - costPrice) * quantity - fee` → `(amount - fee) - costPrice * quantity`
- `price` 保留用于：设置新持仓的初始 `current_price`（L539, L549）

### 2. `reverseTradeEffect()` — 使用 trade.amount

**具体改动**：

- L437 (Reverse BUY 还原成本): `qty * price` → `Number(trade.amount)`

Reverse SELL 无需额外改动——它扣减的是已存储的 `trade.realized_pnl`。

### 3. `createTrade()` — 放宽校验 + 传递 amount

- **移除硬错误**（L164-169）：`Math.abs(amount - qty * price) > 0.01` 不再报错
- L225 (BUY 加权成本): 改用 `amount`
- L248 (BUY 新建成本): 改用 `amount`
- L210 (SELL 盈亏): 改用 `(amount - fee) - costPrice × qty`
- `applyTradeEffect()` 调用新增传入 `amount`
- `applyTradeEffect()` 签名调用处 L337：新增 `newAmount` 参数

### 4. `importTrades()` — 传递 amount

- 调用 `applyTradeEffect()` 时传入 `v.amount`
- L813 SELL 的 `realized_pnl` 计算改用 amount 公式

### 5. `updateTrade()` — 传递 amount

- 调用 `applyTradeEffect()` 时传入 `newAmount`（L326 已定义）
- L363 realized_pnl 计算同步变更

## 前端变更

### TradeForm.svelte

当前 `amount` 输入框为 disabled，自动计算。改为：

- 保留自动计算作为默认填充：quantity 或 price 变化时，`amount = quantity × price`
- amount 输入框 **解除 disabled**，用户可手动覆盖
- 当 `|amount - quantity × price| > 0.01` 时，显示轻量视觉提示（如淡黄色图标），不阻止提交
- **无需新增 i18n key**：提示可用已有样式表达

## 影响范围

| 文件 | 变更程度 | 说明 |
|---|---|---|
| `server/src/controllers/trades.ts` | ~10 行改动 | 6 处公式替换 + 函数签名 + 移除硬错误 |
| `client/src/components/TradeForm.svelte` | ~5 行改动 | amount 解除 disabled |
| `server/src/controllers/trades.test.ts` | 新增用例 | 覆盖 amount ≠ qty×price 的 BUY/SELL 场景 |

## 不在范围内

- 不新增数据库列
- 不修改 Position 模型
- 不修改前端 PositionsTable、TradeHistory、BatchImport 组件
- 不修改 API 路由注册
