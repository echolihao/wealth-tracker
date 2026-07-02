# 基于实际成交金额的盈亏计算 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将所有盈亏/成本计算中的 `quantity × price` 替换为实际成交金额 `amount`，使盈亏基于真金白银而非券商汇总均价。

**Architecture:** 后端 `applyTradeEffect()` 新增 `amount` 参数，6 处公式用 `amount` 替代 `quantity × price`；`createTrade` 移除 amount 强校验；前端 TradeForm 解除 amount 的 disabled 状态。

**Tech Stack:** TypeScript, Svelte 4, Sequelize, Vitest

## Global Constraints

- 不修改数据库 schema
- 不修改 Position 模型
- 不新增 i18n key
- `price` 字段保留原值不参与计算
- 适用 CSV 导入和手动录入

---

### Task 1: 修改 `applyTradeEffect()` — 新增 amount 参数并改公式

**Files:**
- Modify: `server/src/controllers/trades.ts:492-582`

**Interfaces:**
- Produces: `applyTradeEffect(assetId, type, symbol, name, quantity, price, amount, t, tradeDate?, existingPosition?, fee)` — 新签名
- Consumes: 无（底层函数，被 Task 3/4/5 调用）

- [ ] **Step 1: 函数签名新增 `amount` 参数**

将 L492-503：
```typescript
async function applyTradeEffect(
  assetId: number,
  type: string,
  symbol: string,
  name: string,
  quantity: number,
  price: number,
  t: any,
  tradeDate?: string,
  existingPosition?: any,
  fee: number = 0,
)
```

改为：
```typescript
async function applyTradeEffect(
  assetId: number,
  type: string,
  symbol: string,
  name: string,
  quantity: number,
  price: number,
  amount: number,
  t: any,
  tradeDate?: string,
  existingPosition?: any,
  fee: number = 0,
)
```

- [ ] **Step 2: BUY 加仓加权成本 (L515) — `quantity * price` → `amount`**

将：
```typescript
const newCost = (oldQty * oldCost + quantity * price + fee) / newQty
```

改为：
```typescript
const newCost = (oldQty * oldCost + amount + fee) / newQty
```

- [ ] **Step 3: BUY 新建持仓成本 (L538) — `quantity * price` → `amount`**

将：
```typescript
cost_price: (quantity * price + fee) / quantity,
```

改为：
```typescript
cost_price: (amount + fee) / quantity,
```

- [ ] **Step 4: SELL 已实现盈亏 (L563) — 改用 amount 公式**

将：
```typescript
const realizedPnl = (price - costPrice) * quantity - fee
```

改为：
```typescript
const realizedPnl = (amount - fee) - costPrice * quantity
```

- [ ] **Step 5: 验证编译通过**

```bash
cd server && npx tsc --noEmit
```
Expected: 会有调用方类型错误（因为签名变了）—— 正常，后续任务会修复。

---

### Task 2: 修改 `reverseTradeEffect()` — 使用 trade.amount

**Files:**
- Modify: `server/src/controllers/trades.ts:403-489`

**Interfaces:**
- Consumes: `Trade.amount` 字段（已有）
- Produces: 无签名变更

- [ ] **Step 1: Reverse BUY 还原成本 (L437) — `qty * price` → `Number(trade.amount)`**

将：
```typescript
const restoredCost =
  oldQty > 0 ? (oldQty * oldCost - qty * price - tradeFee) / newQty : 0
```

改为：
```typescript
const restoredCost =
  oldQty > 0 ? (oldQty * oldCost - Number(trade.amount) - tradeFee) / newQty : 0
```

- [ ] **Step 2: 验证编译通过**

```bash
cd server && npx tsc --noEmit
```
Expected: `reverseTradeEffect` 自身的类型应通过（它不调用 `applyTradeEffect`）。

---

### Task 3: 修改 `createTrade()` — 放宽校验 + 使用 amount

**Files:**
- Modify: `server/src/controllers/trades.ts:116-303`

**Interfaces:**
- Consumes: `applyTradeEffect` 新签名（from Task 1）
- Produces: 无 API 变更

- [ ] **Step 1: 移除 amount 硬错误校验 (L163-169)**

删除以下代码块：
```typescript
  const amount = Number(params.amount)
  if (Math.abs(amount - quantity * price) > 0.01) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Amount must equal quantity × price.',
    })
  }
```

替换为：
```typescript
  const amount = Number(params.amount)
```

- [ ] **Step 2: BUY 加仓加权成本 (L225) — `quantity * price` → `amount`**

将：
```typescript
const newCost = (oldQty * oldCost + quantity * price + fee) / newQty
```

改为：
```typescript
const newCost = (oldQty * oldCost + amount + fee) / newQty
```

- [ ] **Step 3: BUY 新建持仓成本 (L248) — `quantity * price` → `amount`**

将：
```typescript
cost_price: (quantity * price + fee) / quantity,
```

改为：
```typescript
cost_price: (amount + fee) / quantity,
```

- [ ] **Step 4: BUY 新建持仓 amount (L250) — `quantity * price` → `amount`**

将：
```typescript
amount: quantity * price,
```

改为：
```typescript
amount: amount,
```

注意：此处左侧是 Position 的 amount 字段（市值），应使用实际成交金额作为初始市值。

- [ ] **Step 5: SELL 已实现盈亏 (L210) — 改用 amount 公式**

将：
```typescript
realized_pnl:
  params.type === 'SELL' && existing
    ? (price - costPrice) * quantity - fee
    : null,
```

改为：
```typescript
realized_pnl:
  params.type === 'SELL' && existing
    ? (amount - fee) - costPrice * quantity
    : null,
```

- [ ] **Step 6: SELL Position 已实现盈亏累计 (L273) — 改用 amount 公式**

将：
```typescript
const realizedPnl = (price - costPrice) * quantity - fee
```

改为：
```typescript
const realizedPnl = (amount - fee) - costPrice * quantity
```

- [ ] **Step 7: 验证编译通过**

```bash
cd server && npx tsc --noEmit
```
Expected: 仍有调用方错误（Task 4/5 的 importTrades/updateTrade 还未修）。

---

### Task 4: 修改 `importTrades()` — 传递 amount

**Files:**
- Modify: `server/src/controllers/trades.ts:584-837`

**Interfaces:**
- Consumes: `applyTradeEffect` 新签名（from Task 1）

- [ ] **Step 1: applyTradeEffect 调用 (L788-L796) 新增 `v.amount` 参数**

将：
```typescript
        await applyTradeEffect(
          id,
          v.type,
          v.security_symbol,
          v.security_name,
          v.quantity,
          v.price,
          t,
          v.trade_date,
          posBefore,
          v.fee,
        )
```

改为：
```typescript
        await applyTradeEffect(
          id,
          v.type,
          v.security_symbol,
          v.security_name,
          v.quantity,
          v.price,
          v.amount,
          t,
          v.trade_date,
          posBefore,
          v.fee,
        )
```

- [ ] **Step 2: SELL realized_pnl 计算 (L813) — 改用 amount 公式**

将：
```typescript
            realized_pnl:
              v.type === 'SELL' && posBefore
                ? (v.price - costPrice) * v.quantity - v.fee
                : null,
```

改为：
```typescript
            realized_pnl:
              v.type === 'SELL' && posBefore
                ? (v.amount - v.fee) - costPrice * v.quantity
                : null,
```

- [ ] **Step 3: 验证编译通过**

```bash
cd server && npx tsc --noEmit
```
Expected: 仅剩 updateTrade 的类型错误。

---

### Task 5: 修改 `updateTrade()` — 传递 amount

**Files:**
- Modify: `server/src/controllers/trades.ts:305-379`

**Interfaces:**
- Consumes: `applyTradeEffect` 新签名（from Task 1）

- [ ] **Step 1: applyTradeEffect 调用 (L337-L348) 新增 `newAmount` 参数**

将：
```typescript
      await applyTradeEffect(
        oldTrade.asset_id,
        newType,
        newSymbol,
        newName,
        newQty,
        newPrice,
        t,
        newDate,
        undefined,
        newFee,
      )
```

改为：
```typescript
      await applyTradeEffect(
        oldTrade.asset_id,
        newType,
        newSymbol,
        newName,
        newQty,
        newPrice,
        newAmount,
        t,
        newDate,
        undefined,
        newFee,
      )
```

- [ ] **Step 2: realized_pnl 计算 (L361-L364) — 改用 amount 公式**

将：
```typescript
          realized_pnl:
            newType === 'SELL' && posBefore
              ? (newPrice - costPriceBefore) * newQty - newFee
              : null,
```

改为：
```typescript
          realized_pnl:
            newType === 'SELL' && posBefore
              ? (newAmount - newFee) - costPriceBefore * newQty
              : null,
```

- [ ] **Step 3: 验证编译通过**

```bash
cd server && npx tsc --noEmit
```
Expected: 零错误。

---

### Task 6: 更新测试 — 适配新公式 + 新增 amount 偏差用例

**Files:**
- Modify: `server/src/controllers/trades.test.ts`

**Interfaces:**
- Consumes: 所有后端函数变更（Task 1-5）

- [ ] **Step 1: 删除 "should reject amount that does not equal quantity × price" 测试 (L464-474)**

删除整个 `it('should reject amount that does not equal quantity × price', ...)` 测试块。

- [ ] **Step 2: 替换为 "should allow amount that differs from quantity × price" 测试**

在相同位置（原测试删除处）新增：
```typescript
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
```

- [ ] **Step 3: 新增 BUY 加仓 amount 偏差测试**

在 `describe('trade execution')` 的 `describe` 块末尾新增：
```typescript
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
```

- [ ] **Step 4: 新增 SELL amount 偏差测试**

```typescript
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
```

- [ ] **Step 5: 更新 reverseTradeEffect 测试 — 验证 amount 参与还原**

将 L991 附近的断言从：
```typescript
        cost_price: 135,
```
改为保持（此测试中 amount = qty × price，结果不变，但需确认公式使用 amount 后结果一致）：
```typescript
        cost_price: (15 * 145 - 1500) / 5, // = 135, 用 amount=1500 计算
```

- [ ] **Step 6: 运行全部测试**

```bash
cd server && npm run test
```
Expected: 全部通过。

---

### Task 7: 前端 TradeForm — amount 解除 disabled

**Files:**
- Modify: `client/src/components/TradeForm.svelte:167-173`

**Interfaces:**
- Consumes: `createTrade` API（已支持 amount 偏差）
- Produces: 用户可手动编辑 amount

- [ ] **Step 1: amount 输入框解除 disabled，改用 number 类型**

将 L167-174：
```svelte
    <div class="module-warp">
      <label class="custom-label">{$_('tradeAmount')}</label>
      <input
        type="text"
        class="custom-input bg-gray-50"
        value={amount ? amount.toFixed(2) : ''}
        disabled />
    </div>
```

改为：
```svelte
    <div class="module-warp">
      <label class="custom-label">{$_('tradeAmount')}</label>
      <input
        type="number"
        step="0.01"
        class="custom-input"
        class:bg-yellow-50={Math.abs(amount - (parseFloat(quantity) || 0) * (parseFloat(price) || 0)) > 0.01}
        bind:value={amount}
        placeholder="0.00" />
    </div>
```

注意：
- `type="text"` → `type="number"`，可直接双向绑定
- 移除 `disabled` 属性
- 添加 `class:bg-yellow-50` 条件样式：当 amount 与 qty×price 偏差超过 0.01 时，背景变淡黄色作为视觉提示
- 响应式声明 `$: amount = qty * p`（L24-28）保留不动：当用户修改 quantity 或 price 时仍自动更新 amount 作为默认值，但用户可随后手动覆盖

- [ ] **Step 2: 验证前端编译**

```bash
cd client && npm run check
```
Expected: 零错误。

---

### Task 8: 端到端验证

**Files:**
- 无新建文件

- [ ] **Step 1: 启动后端并运行测试**

```bash
cd server && npm run test
```
Expected: 全部测试通过。

- [ ] **Step 2: 手动验证场景**

用你的实际 CSV 数据做一次导入验证：

```bash
# 确认导入的 trade 记录中 amount 正确存储
# 确认 position 的 cost_price 基于 amount 计算
# 确认盈亏数据与实际券商数据一致
```

CSV 示例行：
```
2026-06-25,BUY,515880,通信ETF,223700,1.8240,407954.20,101.99,测试
```

预期：
- Trade.amount = 407954.20
- Position.cost_price = (407954.20 + 101.99) / 223700 ≈ 1.8241

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: 盈亏计算改用实际成交金额 amount 替代 quantity × price"
```
