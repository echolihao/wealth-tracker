# 交易记录批量导入功能 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为交易记录页面新增 CSV 批量导入功能，支持模板下载、文件上传、服务端解析校验并自动更新持仓。

**Architecture:** 服务端新增 `POST /api/assets/:assetType/trades/import` 端点，使用 `csv-parse` 解析 CSV，先校验再事务执行（复用 `createTrade` 核心逻辑）。前端新增 `BatchImport.svelte` 弹窗组件，集成在 `Trade.svelte` 的交易历史上方。

**Tech Stack:** Fastify + Sequelize + SQLite (server), Svelte 4 + Flowbite + Tailwind (client), csv-parse (new dep)

## Global Constraints

- CSV 模板列头固定：交易日期,操作类型,证券代码,证券名称,数量,价格,金额,备注（金额可选）
- 仅支持 UTF-8 编码 CSV 文件
- 必须按照 `trade_date` 升序排列后事务处理
- 先校验全部行再执行，任意行失败则整体回滚
- 最大支持 1000 行，超出则提示分批导入
- 证券账户（asset_type）在页面上选择，不在 CSV 中
- Prettier 格式化：single quotes, no semicolons, 2-space indent, print width 100

---

### Task 1: 服务端 — 安装 csv-parse 并实现 importTrades 控制器

**Files:**
- Create: (no new files)
- Modify: `server/package.json` (add dependency)
- Modify: `server/src/controllers/trades.ts` (add importTrades)

**Interfaces:**
- Consumes: `createTrade` 中的 `applyTradeEffect` helper、`Trade` 和 `Position` 模型、`sequelize` 实例
- Produces: `importTrades` 函数，导出后被路由注册引用

- [ ] **Step 1: 安装 csv-parse 依赖**

```bash
cd /Users/haoli/workspace/source_code/wealth-tracker/server && pnpm add csv-parse
```

- [ ] **Step 2: 在 controllers/trades.ts 末尾添加 importTrades 函数**

在文件末尾（`applyTradeEffect` 之后）添加 `importTrades`。注意 csv-parse 需要用 `{ from: 2 }` 跳过 CSV 列头行。

```typescript
import { parse } from 'csv-parse/sync'

// ... existing code ...

export const importTrades = async (request, reply) => {
  const { assetType } = request.params

  if (!assetType) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Asset type is required.',
    })
  }

  // Validate account is securities account
  const account = await Assets.findByPk(assetType)
  const isSecurities =
    account &&
    (account.type.startsWith('securities:') ||
      account.alias?.startsWith('securities:'))
  if (!isSecurities) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'Invalid securities account type.',
    })
  }

  try {
    // 1. Read uploaded file
    const data = await request.file()
    if (!data) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'No file uploaded.',
      })
    }

    const buffer = await data.toBuffer()
    const content = buffer.toString('utf-8').trim()

    if (!content) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'File is empty.',
      })
    }

    // 2. Parse CSV
    let records: any[]
    try {
      records = parse(content, {
        columns: [
          'trade_date',
          'type',
          'security_symbol',
          'security_name',
          'quantity',
          'price',
          'amount',
          'note',
        ],
        from: 2, // skip header row
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      })
    } catch (parseErr: any) {
      return reply.code(400).send({
        success: false,
        imported: 0,
        errors: [{ row: 0, field: 'CSV', message: `CSV 解析失败: ${parseErr.message}` }],
        details: 'CSV 文件格式错误，请检查后重试。',
      })
    }

    if (records.length === 0) {
      return reply.code(400).send({
        success: false,
        imported: 0,
        errors: [],
        details: 'CSV 文件中没有数据行。',
      })
    }

    if (records.length > 1000) {
      return reply.code(400).send({
        success: false,
        imported: 0,
        errors: [],
        details: `CSV 文件包含 ${records.length} 行，超过 1000 行上限，请分批导入。`,
      })
    }

    // 3. Validate all rows
    const errors: Array<{ row: number; field: string; message: string }> = []
    const validated: Array<{
      trade_date: string
      type: string
      security_symbol: string
      security_name: string
      quantity: number
      price: number
      amount: number
      note: string
    }> = []

    records.forEach((row: any, idx: number) => {
      const rowNum = idx + 2 // CSV row number (1-indexed, +1 for header)

      // trade_date
      if (!row.trade_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.trade_date)) {
        errors.push({ row: rowNum, field: '交易日期', message: '日期格式必须为 YYYY-MM-DD' })
        return
      }

      // type
      const tradeType = row.type?.toUpperCase()
      if (!tradeType || !['BUY', 'SELL'].includes(tradeType)) {
        errors.push({ row: rowNum, field: '操作类型', message: '操作类型必须为 BUY 或 SELL' })
        return
      }

      // symbol
      if (!row.security_symbol || !row.security_symbol.trim()) {
        errors.push({ row: rowNum, field: '证券代码', message: '证券代码不能为空' })
        return
      }

      // name
      if (!row.security_name || !row.security_name.trim()) {
        errors.push({ row: rowNum, field: '证券名称', message: '证券名称不能为空' })
        return
      }

      // quantity
      const qty = Number(row.quantity)
      if (!qty || qty <= 0) {
        errors.push({ row: rowNum, field: '数量', message: '数量必须为正数' })
        return
      }

      // price
      const p = Number(row.price)
      if (!p || p <= 0) {
        errors.push({ row: rowNum, field: '价格', message: '价格必须为正数' })
        return
      }

      // amount (optional — use qty * price if not provided or empty)
      let amt: number
      if (row.amount === undefined || row.amount === null || row.amount === '') {
        amt = qty * p
      } else {
        amt = Number(row.amount)
        if (Math.abs(amt - qty * p) > 0.01) {
          errors.push({ row: rowNum, field: '金额', message: '金额必须等于数量 × 价格' })
          return
        }
      }

      validated.push({
        trade_date: row.trade_date,
        type: tradeType,
        security_symbol: row.security_symbol.trim(),
        security_name: row.security_name.trim(),
        quantity: qty,
        price: p,
        amount: amt,
        note: row.note?.trim() || '',
      })
    })

    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        imported: 0,
        errors,
        details: `导入失败：共 ${errors.length} 行有错误。`,
      })
    }

    // 4. Sort by trade_date ascending
    validated.sort(
      (a, b) => a.trade_date.localeCompare(b.trade_date),
    )

    // 5. Execute in transaction
    await sequelize.transaction(async (t) => {
      for (const v of validated) {
        await applyTradeEffect(
          assetType,
          v.type,
          v.security_symbol,
          v.security_name,
          v.quantity,
          v.price,
          t,
        )

        // Look up position for realized_pnl calculation
        const existing = await Position.findOne({
          where: { asset_type: assetType, security_symbol: v.security_symbol },
          transaction: t,
        })
        const costPrice = existing ? Number(existing.cost_price) : v.price

        await Trade.create(
          {
            asset_type: assetType,
            security_symbol: v.security_symbol,
            security_name: v.security_name,
            type: v.type,
            quantity: v.quantity,
            price: v.price,
            amount: v.amount,
            trade_date: v.trade_date,
            note: v.note,
            realized_pnl:
              v.type === 'SELL' && existing
                ? (v.price - costPrice) * v.quantity
                : null,
            created: new Date(),
          },
          { transaction: t },
        )
      }
    })

    return reply.send({
      success: true,
      imported: validated.length,
      errors: [],
      details: `成功导入 ${validated.length} 条交易记录（共 ${validated.length} 条）。`,
    })
  } catch (error: any) {
    return reply.code(400).send({
      success: false,
      imported: 0,
      errors: [{ row: 0, field: '系统', message: error.message }],
      details: `导入失败：${error.message}`,
    })
  }
}
```

- [ ] **Step 3: 验证编译通过**

```bash
cd /Users/haoli/workspace/source_code/wealth-tracker/server && npx tsc --noEmit
```
Expected: No type errors. (Note: `csv-parse` types may need `@types/csv-parse` — if type errors occur, add `// @ts-ignore` above the parse import or install `@types/csv-parse`.)

- [ ] **Step 4: Commit**

```bash
cd /Users/haoli/workspace/source_code/wealth-tracker
git add server/src/controllers/trades.ts server/package.json
git commit -m "feat: add importTrades controller for CSV batch import

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 服务端 — 注册 import 路由

**Files:**
- Modify: `server/src/routes/trades.ts`

**Interfaces:**
- Produces: `POST /api/assets/:assetType/trades/import` 端点可用

- [ ] **Step 1: 在 routes/trades.ts 中添加 import 路由**

在文件顶部导入 `importTrades`，在 routes 数组末尾添加新路由：

```typescript
import {
  getSecuritiesAccounts,
  getPositions,
  updatePositionPrice,
  getTrades,
  createTrade,
  updateTrade,
  deleteTrade,
  importTrades,
} from '../controllers/trades'

export default [
  // ... existing routes ...
  {
    method: 'POST',
    url: '/api/assets/:assetType/trades/import',
    handler: importTrades,
  },
]
```

- [ ] **Step 2: 验证路由注册**

```bash
cd /Users/haoli/workspace/source_code/wealth-tracker/server && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/trades.ts
git commit -m "feat: register POST /api/assets/:assetType/trades/import route

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 客户端 — 新增 importTrades API 调用和 i18n 键值

**Files:**
- Modify: `client/src/helper/apis.ts`
- Modify: `client/src/lang/zh.json`
- Modify: `client/src/lang/en.json`
- Modify: `client/src/lang/ja.json`
- Modify: `client/src/lang/fr.json`
- Modify: `client/src/lang/zh-tw.json`

**Interfaces:**
- Produces: 可供 BatchImport.svelte 使用的 `importTrades(assetType, file)` 函数和 `$_('batchImport')` 等翻译

- [ ] **Step 1: 在 apis.ts 末尾添加 importTrades 函数**

```typescript
export const importTrades = (assetType: string, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return $ajax.post(genApiPath(`assets/${assetType}/trades/import`), formData)
}
```

注意：`ajax.ts` 的 `post` 方法使用 `axios`，会默认将 data 转为 JSON。需要确认 `FormData` 能被 axios 自动识别并设置正确的 Content-Type（multipart/form-data）。Axios 会自动检测 FormData 并设置正确的 Content-Type 和 boundary。

- [ ] **Step 2: 在所有语言文件的 trade 段落末尾添加新键值**

**zh.json** (添加在 `holdingCount` 行后):
```json
  "batchImport": "批量导入",
  "downloadTemplate": "下载模板",
  "selectFile": "选择文件",
  "import": "导入",
  "importSuccess": "成功导入 {count} 条交易记录",
  "importFailed": "导入失败",
  "importDetails": "详情",
  "selectCsvFile": "请选择 CSV 文件",
  "noFileSelected": "未选择文件"
```

**en.json** (添加在 `holdingCount` 行后):
```json
  "batchImport": "Batch Import",
  "downloadTemplate": "Download Template",
  "selectFile": "Select File",
  "import": "Import",
  "importSuccess": "Successfully imported {count} trade records",
  "importFailed": "Import Failed",
  "importDetails": "Details",
  "selectCsvFile": "Please select a CSV file",
  "noFileSelected": "No file selected"
```

对于 ja.json、fr.json、zh-tw.json，结构相同，翻译可以先用英文占位或简单翻译。以下为统一格式，添加到每个语言文件的 `holdingCount` 行后：

```json
  "batchImport": "批量导入",
  "downloadTemplate": "下载模板",
  "selectFile": "选择文件",
  "import": "导入",
  "importSuccess": "成功导入 {count} 条交易记录",
  "importFailed": "导入失败",
  "importDetails": "详情",
  "selectCsvFile": "请选择 CSV 文件",
  "noFileSelected": "未选择文件"
```

注意：ja.json、fr.json、zh-tw.json 中 `holdingCount` 可能使用不同的键名（中文翻译略有不同），需要读取确认。在这些文件中找到 trade 段的最后一行，在 `}` 前插入新键值对，注意 JSON 格式（最后一个键值对不能有尾逗号）。

- [ ] **Step 3: 验证文件格式**

```bash
cd /Users/haoli/workspace/source_code/wealth-tracker/client && npx tsc --noEmit --skipLibCheck
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/helper/apis.ts client/src/lang/*.json
git commit -m "feat: add importTrades API and i18n keys for batch import

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 客户端 — 创建 BatchImport.svelte 组件

**Files:**
- Create: `client/src/components/BatchImport.svelte`

**Interfaces:**
- Consumes: `importTrades(assetType, file)` from apis.ts, `$_('batchImport')` etc. from i18n
- Produces: `<BatchImport>` 组件，emit `imported` 事件通知父组件刷新

- [ ] **Step 1: 创建 BatchImport.svelte**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  import SvgIcon from './SvgIcon.svelte'
  import { importTrades } from '../helper/apis'
  import { alert, notice } from '../stores'

  const dispatch = createEventDispatcher()

  export let assetType = ''
  export let show = false

  let selectedFile: File | null = null
  let importing = false
  let result: {
    success: boolean
    imported: number
    errors: Array<{ row: number; field: string; message: string }>
    details: string
  } | null = null

  // CSV template content
  const CSV_HEADER = '交易日期,操作类型,证券代码,证券名称,数量,价格,金额,备注'

  const handleDownloadTemplate = () => {
    const blob = new Blob(['﻿' + CSV_HEADER], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'trade-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      selectedFile = target.files[0]
      result = null
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      alert.set($_('selectCsvFile'))
      return
    }

    importing = true
    result = null
    try {
      const res = await importTrades(assetType, selectedFile)
      result = res
      if (res.success) {
        notice.set(
          $_('importSuccess', { values: { count: res.imported } }),
        )
        dispatch('imported')
      }
    } catch (error: any) {
      const errData = error?.response?.data
      if (errData && errData.errors) {
        result = errData
      } else {
        const msg = error?.response?.data?.message || error.message || 'Network error'
        result = {
          success: false,
          imported: 0,
          errors: [{ row: 0, field: '系统', message: msg }],
          details: `导入失败：${msg}`,
        }
      }
    } finally {
      importing = false
    }
  }

  const handleClose = () => {
    show = false
    selectedFile = null
    result = null
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    on:click={handleClose}>
    <div
      class="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
      on:click|stopPropagation>
      <!-- Header -->
      <div class="mb-4 flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-lg font-medium">
          <SvgIcon name="adjustment" width={20} height={20} color="#1e293b" />
          {$_('batchImport')}
        </h3>
        <button on:click={handleClose} class="text-gray-400 hover:text-gray-600">
          <SvgIcon name="close" width={20} height={20} />
        </button>
      </div>

      <!-- Template download -->
      <div class="mb-4">
        <button
          on:click={handleDownloadTemplate}
          class="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
          <SvgIcon name="download" width={16} height={16} />
          {$_('downloadTemplate')}
        </button>
      </div>

      <!-- File select -->
      <div class="mb-4">
        <label class="custom-label block mb-1">{$_('selectFile')}</label>
        <input
          type="file"
          accept=".csv"
          on:change={handleFileSelect}
          class="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100" />
        {#if selectedFile}
          <p class="mt-1 text-xs text-gray-500">
            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </p>
        {:else}
          <p class="mt-1 text-xs text-gray-400">{$_('noFileSelected')}</p>
        {/if}
      </div>

      <!-- Import button -->
      <button
        on:click={handleImport}
        disabled={importing || !selectedFile}
        class="w-full rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50
          {result?.success ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}">
        {importing
          ? $_('persist') + '...'
          : result?.success
            ? $_('close')
            : $_('import')}
      </button>

      <!-- Result display -->
      {#if result && !result.success && result.errors.length > 0}
        <div class="mt-4 max-h-60 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3">
          <p class="mb-2 text-sm font-medium text-red-700">{$_('importFailed')}</p>
          <p class="mb-2 text-xs text-red-600">{result.details}</p>
          {#each result.errors as err}
            <div class="mb-1 rounded bg-white px-2 py-1 text-xs text-red-600">
              {#if err.row > 0}
                <span class="font-mono">第 {err.row} 行</span>
                <span class="mx-1">·</span>
              {/if}
              <span class="font-medium">{err.field}:</span> {err.message}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
```

- [ ] **Step 2: 验证组件语法**

```bash
cd /Users/haoli/workspace/source_code/wealth-tracker/client && npm run check
```
Expected: No errors. (If Svelte check fails on SvgIcon name, verify `SvgIcon` has a `download` icon name or adjust to use an existing icon like `chevron-down`.)

- [ ] **Step 3: Commit**

```bash
git add client/src/components/BatchImport.svelte
git commit -m "feat: create BatchImport component for CSV upload and import

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 客户端 — 将 BatchImport 集成到 TradeHistory 组件

直接在 TradeHistory 组件内添加导入按钮和 BatchImport 弹窗，这样更内聚，TradeHistory 自行管理标题和导入功能。

**Files:**
- Modify: `client/src/components/TradeHistory.svelte`
- Modify: `client/src/routes/Trade.svelte`

**Interfaces:**
- TradeHistory 新增 prop: `assetType`、`showImportButton`；新增 `imported` 事件
- Trade.svelte 传递新 prop 并监听 `imported` 事件

- [ ] **Step 1: 修改 TradeHistory.svelte 添加导入按钮和 BatchImport 组件**

在 `<script>` 中添加：
```svelte
<script lang="ts">
  // ... existing imports ...
  import BatchImport from './BatchImport.svelte'

  // ... existing props ...
  export let assetType = ''
  export let showImportButton = false

  let showBatchImport = false
</script>
```

将模板中的 `<h3 class="mb-3 text-base font-medium">{$_('recordDetails')}</h3>` 替换为：
```svelte
  <div class="mb-3 flex items-center justify-between">
    <h3 class="text-base font-medium">{$_('recordDetails')}</h3>
    {#if showImportButton}
      <button
        on:click={() => (showBatchImport = true)}
        class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
        {$_('batchImport')}
      </button>
    {/if}
  </div>
```

在模板末尾（`</div>` 闭合前）添加 BatchImport 组件：
```svelte
<BatchImport
  {assetType}
  show={showBatchImport}
  on:imported={() => {
    showBatchImport = false
    dispatch('imported')
  }} />
```

- [ ] **Step 2: 修改 Trade.svelte 传递新 prop**

将 `<TradeHistory>` 调用修改为：
```svelte
<TradeHistory
  {trades}
  total={tradeTotal}
  page={tradePage}
  size={tradeSize}
  loading={loadingTrades}
  assetType={selectedAccount.type}
  showImportButton={true}
  on:deleted={handleTradeDeleted}
  on:pageChange={handlePageChange}
  on:imported={handleTradeCreated} />
```

- [ ] **Step 3: 验证编译**

```bash
cd /Users/haoli/workspace/source_code/wealth-tracker/client && npm run check
```
Expected: No errors.

- [ ] **Step 4: 手动端到端验证**

```bash
# 启动服务端
cd /Users/haoli/workspace/source_code/wealth-tracker/server && npm run dev &

# 启动客户端
cd /Users/haoli/workspace/source_code/wealth-tracker/client && npm run dev
```
验证步骤：
1. 打开浏览器访问 /trade 页面
2. 选择一个证券账户
3. 看到"批量导入"按钮在交易历史标题旁
4. 点击下载模板，确认 CSV 文件包含正确列头
5. 准备测试 CSV 文件（2-3 行有效数据）
6. 选择文件并点击导入
7. 验证成功提示和交易列表刷新
8. 测试错误场景：空文件、格式错误、超过 1000 行

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TradeHistory.svelte client/src/routes/Trade.svelte
git commit -m "feat: integrate batch import into trade page

Co-Authored-By: Claude <noreply@anthropic.com>"
```
