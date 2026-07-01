# 持仓总盈亏汇总设计

## 需求
在交易页面的持仓模块底部添加两组汇总盈亏数据：当前持仓总盈亏、全部持仓总盈亏。

## 变更范围
仅修改 `client/src/components/PositionsTable.svelte`，无需后端改动。

## 实现方案

### 计算属性（script 段新增）
```ts
// 当前持仓总盈亏 = 每个 Open 持仓的 (现价-成本价)*数量 + 已实现盈亏
$: totalOpenPnl = openPositions.reduce((sum, p) => {
  const unrealized = (Number(p.current_price ?? 0) - Number(p.cost_price ?? 0)) * Number(p.quantity ?? 0)
  return sum + unrealized + Number(p.realized_pnl ?? 0)
}, 0)

// 全部持仓总盈亏 = 当前持仓总盈亏 + 所有已平仓的已实现盈亏
$: totalAllPnl = totalOpenPnl + closedPositions.reduce((sum, p) => sum + Number(p.realized_pnl ?? 0), 0)
```

### 展示方式
在已平仓折叠按钮下方（或开放持仓表格下方，若无已平仓）添加一个两列的汇总栏：
- 左列：**当前持仓总盈亏** + 红绿色数值
- 右列：**全部持仓总盈亏** + 红绿色数值

数值格式化与现有盈亏列保持一致（带 +/- 号，2 位小数，红盈绿亏）。
