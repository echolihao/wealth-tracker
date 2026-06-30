# 交易记录批量导入功能设计

## 概述

为交易记录页面（`/trade`）增加 CSV 批量导入功能，用户下载固定模板填写后上传，服务端解析并自动创建交易记录及更新持仓。

## CSV 模板

| 列名 | 必填 | 格式/说明 | 示例 |
|---|---|---|---|
| 交易日期 | ✅ | YYYY-MM-DD | `2024-01-15` |
| 操作类型 | ✅ | BUY 或 SELL | `BUY` |
| 证券代码 | ✅ | 股票代码 | `0700.HK` |
| 证券名称 | ✅ | 股票名称 | `腾讯控股` |
| 数量 | ✅ | 正数 | `100` |
| 价格 | ✅ | 每股价格 | `388.50` |
| 金额 | ❌ | 可选，不填则自动计算为 数量 × 价格 | `38850.00` |
| 备注 | ❌ | 可选 | `首次建仓` |

- 证券账户（`asset_type`）在页面上选择，不在 CSV 中
- 金额可选：若填写则校验 ≈ 数量 × 价格（±0.01）；不填则自动计算
- 模板第一行为列头，无示例行/说明行
- 模板在客户端用 JavaScript Blob 生成并下载，无需服务端提供文件

## 服务端 API

### 新增端点

`POST /api/assets/:assetType/trades/import`

- 使用 `@fastify/multipart` 接收 CSV 文件上传
- 新增 npm 依赖：`csv-parse`

### 处理流程

1. 接收 CSV 文件 → 读取内容为字符串
2. 用 `csv-parse` 解析为行记录
3. 先校验全部行，收集所有错误
4. 若有错误 → 直接返回错误列表，不执行导入
5. 全部校验通过后：
   - 按 `trade_date` 升序排列
   - 开启数据库事务
   - 逐条复用 `createTrade` 核心逻辑（applyTradeEffect + Trade.create）
   - 全部成功 → 提交事务；任一失败 → 回滚
6. 返回导入结果

### 校验规则（逐行）

- 日期格式必须为 `YYYY-MM-DD`
- 操作类型必须是 `BUY` 或 `SELL`
- 证券代码、名称不能为空
- 数量、价格必须为正数
- 金额（若填写）必须在 `数量 × 价格` 的 ±0.01 范围内
- 卖出时持仓必须有足够数量（由事务逻辑保证）

### 响应格式

成功：
```json
{
  "success": true,
  "imported": 25,
  "errors": [],
  "details": "成功导入 25 条交易记录（共 25 条）"
}
```

失败：
```json
{
  "success": false,
  "imported": 0,
  "errors": [
    { "row": 3, "field": "价格", "message": "价格必须为正数" },
    { "row": 7, "field": "股票", "message": "卖出数量超出持仓" }
  ],
  "details": "导入失败：第 3、7 行有错误"
}
```

## 前端 UI

### 新增组件：`BatchImport.svelte`

放在 `client/src/components/BatchImport.svelte`。

### 界面布局（弹窗 Modal）

- **入口按钮**：在 TradeHistory 上方右侧，文字"批量导入"
- **弹窗内容**：
  - 模板下载链接（生成 CSV 模板供下载）
  - 文件选择区域（支持点击选择，显示已选文件名）
  - 导入按钮（确认上传）
  - 加载状态
  - 结果反馈（成功计数 / 逐行错误列表）
- **字体图标**：使用 Flowbite/Flowbite-svelte 内联 SVG 图标（不上传额外图标库）

### 交互流程

```
点击"批量导入" → Modal 打开
  → 用户可下载模板
  → 选择 CSV 文件
  → 点击"导入"
  → 上传到 POST /api/assets/:assetType/trades/import
  → 显示导入结果
    → 成功：Toast 通知 → 自动刷新交易列表和持仓
    → 失败：弹窗内显示错误详情
  → 关闭弹窗
```

### 集成到 Trade.svelte

- 在 `<TradeHistory>` 上方添加导入按钮
- 引入 `<BatchImport>` 组件
- 导入成功后调用与 `handleTradeCreated` 相同的刷新逻辑

### 新增 API 调用

在 `client/src/helper/apis.ts` 中新增：
```typescript
importTrades(assetType: string, file: File): Promise<ImportResult>
```
- 使用 `FormData` 上传文件
- Content-Type: `multipart/form-data`

## i18n 新增键值

在 `client/src/lang/*.json` 中新增：

| 键 | 中文 |
|---|---|
| `batchImport` | 批量导入 |
| `downloadTemplate` | 下载模板 |
| `selectFile` | 选择文件 |
| `import` | 导入 |
| `importSuccess` | 成功导入 {count} 条交易记录 |
| `importFailed` | 导入失败 |
| `importDetails` | 详情 |
| `close` | 关闭 |
| `selectCsvFile` | 请选择 CSV 文件 |
| `noFileSelected` | 未选择文件 |

## 错误处理

- **网络错误**：显示"网络连接失败，请重试"
- **文件过大**：服务端限制后返回错误信息
- **空文件**：提示"文件为空"
- **编码问题**：仅支持 UTF-8 编码 CSV 文件
- **行数过多**：设置合理上限（如 1000 条），超限提示分批导入

## 风险与注意事项

- **事务完整性**：all-or-nothing 策略确保数据一致性，但大批量导入时事务可能长时间占用数据库锁，需控制在合理行数内
- **排序重要性**：按 `trade_date` 排序后才能正确计算加权平均成本和已实现盈亏
