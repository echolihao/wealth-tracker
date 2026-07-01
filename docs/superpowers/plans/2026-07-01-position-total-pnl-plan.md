# 持仓总盈亏汇总实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在交易页面的持仓表格底部添加当前持仓总盈亏和全部持仓总盈亏的汇总展示。

**Architecture:** 纯前端改动，在 `PositionsTable.svelte` 中新增两个响应式计算属性，并在表格底部添加汇总展示区域。

**Tech Stack:** Svelte 4

**变更文件：**
- Modify: `client/src/components/PositionsTable.svelte`

---
### Task 1: 新增汇总计算属性和展示 UI

**Files:**
- Modify: `client/src/components/PositionsTable.svelte`

- [ ] **Step 1: 在 script 段添加计算属性**

在 `let showClosed = false` 之后追加：

```ts
$: totalOpenPnl = openPositions.reduce((sum, p) => {
  const unrealized =
    (Number(p.current_price ?? 0) - Number(p.cost_price ?? 0)) *
    Number(p.quantity ?? 0)
  return sum + unrealized + Number(p.realized_pnl ?? 0)
}, 0)

$: totalAllPnl =
  totalOpenPnl +
  closedPositions.reduce((sum, p) => sum + Number(p.realized_pnl ?? 0), 0)
```

- [ ] **Step 2: 在模板底部添加汇总展示**

在最后一个 `{/if}`（第 237 行 `{/if}` — 包裹已平仓 toggle 的那个）和 `{/if}`（第 238 行 `{/if}` — 包裹 `positions.length === 0` 判断的）**之间**插入汇总栏：

```svelte
    <!-- Summary: total P&L -->
    <div class="mt-4 flex items-center gap-8 border-t border-gray-200 pt-3 text-sm">
      <div class="flex items-center gap-2">
        <span class="text-gray-500">{$_('currentTotalPnl') || '当前持仓总盈亏'}:</span>
        <span
          class="font-mono font-medium"
          class:text-red-600={totalOpenPnl > 0}
          class:text-green-600={totalOpenPnl < 0}>
          {totalOpenPnl > 0 ? '+' : ''}{totalOpenPnl.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-gray-500">{$_('allTotalPnl') || '全部持仓总盈亏'}:</span>
        <span
          class="font-mono font-medium"
          class:text-red-600={totalAllPnl > 0}
          class:text-green-600={totalAllPnl < 0}>
          {totalAllPnl > 0 ? '+' : ''}{totalAllPnl.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
```

- [ ] **Step 3: 在中文语言包中添加 i18n 键值**

将 `/Users/haoli/workspace/source_code/wealth-tracker/client/src/lang/zh.json` 中追加：

```json
  "currentTotalPnl": "当前持仓总盈亏",
  "allTotalPnl": "全部持仓总盈亏"
```

并在其他语言包（en.json, zh-tw.json, ja.json, fr.json）中添加对应翻译（或用英文回退）。

- [ ] **Step 4: 验证构建不报错**

```bash
cd client && npm run check
```

- [ ] **Step 5: 提交**

```bash
git add client/src/components/PositionsTable.svelte client/src/lang/
git commit -m "feat: 持仓表底部增加当前总盈亏和全部总盈亏汇总"
```
