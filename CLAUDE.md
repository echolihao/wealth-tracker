# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Wealth Tracker（生财有迹）是一个 monorepo，包含 Svelte 前端、Fastify + SQLite 后端和 Electron 桌面壳。保持此文件简洁，聚焦于 Claude 无法可靠推断的规则。

## Hard Rules

- **不能编辑构建产物**：`server/public/**` 和 `client/dist/**` 由构建生成，手动修改会被覆盖。
- **不能硬编码密钥**：使用环境变量或 `.env`。
- **新 API 路由必须注册**：在 `server/src/routes/index.ts` 中导入并展开数组，否则不会生效。
- **新 Sequelize 模型必须导入**：在 `server/src/index.ts` 的 `loadServerModules()` 中 `import`，且必须在 `sequelize.sync()` 之前。
- **数据库迁移必须向后兼容**：SQLite 不支持 `ALTER TABLE DROP COLUMN` 或大部分 `ALTER` 操作。新增列使用 `ALTER TABLE ADD COLUMN`（参考 `server/src/index.ts` 中的 `addColumnIfNotExists` 模式），不要修改或删除已有列。
- **不要在 Prettier 覆盖范围外手动格式化**：Prettier 是权威格式工具。
- **盈亏颜色遵循国内金融惯例**：红涨绿跌。盈利/正数为红色（`text-red-500`），亏损/负数为绿色（`text-green-600`）。与国际惯例相反，不要用 green 表示盈利。

## 常用命令

### 依赖管理
- `pnpm i` — 安装所有 workspace 依赖（根目录推荐做法）。根 scripts 使用 yarn，确保 yarn 可用。

### 开发
- `cd server && npm run dev` — 启动后端开发服务器（`tsx watch`，热重启，默认 :8888）
- `cd client && npm run dev` — 启动前端开发服务器（Vite，默认 :5173，代理 API 到 :8888）
- 访问 `http://localhost:5173` 进行开发

### 构建
- `yarn build` — 构建全部（client → `server/public`，server → `server/dist`）
- 独立构建：`cd client && npm run build` 或 `cd server && npm run build`

### 生产部署
- `yarn start` — 通过 PM2 启动（`cd server && npm run deploy`）
- `yarn stop` / `yarn restart` / `yarn logs` — PM2 管理命令

### 格式化和类型检查
- `yarn prettier` — Prettier 格式化全部
- `cd client && npm run prettier` — 仅前端
- `cd client && npm run check` — Svelte 类型检查（`svelte-check`）

### 测试
- `cd server && npm run test` — 运行一次 Vitest 测试
- `cd server && npm run test:watch` — 监听模式
- 测试文件：`server/src/controllers/trades.test.ts`（模拟 Sequelize 模型）

### 桌面应用（Electron）
- `yarn desktop:dev` — 构建 Web 后启动 Electron 开发模式
- `yarn desktop:dist` — 打包分发版（macOS/Linux/Windows）
- `yarn desktop:dist:mac` — 仅打包 macOS

## 架构概览

```
wealth-tracker/
├── client/        # Svelte 4 + Vite + Tailwind + Flowbite 前端
├── server/        # Fastify + TypeScript + Sequelize + SQLite 后端（数据库在 server/data/）
├── desktop/       # Electron 桌面壳
├── data/          # （旧）SQLite 数据库文件，已废弃
└── docs/          # 文档/规划
```

### 前端（client/）

**路由**：使用 `@roxi/routify` 基于文件系统的路由。`client/src/routes/` 下的文件自动映射：
- `/` → `Index.svelte`（仪表盘）
- `/detail` → `Detail.svelte`（变更记录历史）
- `/trade` → `Trade.svelte`（交易/持仓管理）
- `/insights` → `Insights.svelte`（财富见解 + 日历热力图）
- `/advice` → `Advice.svelte`（AI 财务建议，SSE 流式）
- `/status` → `Status.svelte`（资产状态树状图）

**状态管理**：`client/src/stores.ts` — Svelte writable stores 承载认证、主题、语言、汇率等全局状态。

**API 通信层**：`client/src/helper/`：
- `ajax.ts` — Axios HTTP 客户端封装
- `apis.ts` — 所有 API 端点封装函数（约 19 个导出函数）
- `auth.ts` — 认证初始化与密码哈希（SHA-256）
- `settings.ts` — 用户设置加载/保存
- `utils.ts` — 工具函数（汇率获取、货币换算、AI 流式请求等）
- `constant.ts` — 常量定义

**国际化**：`client/src/lang/` — 支持 zh / zh-tw / en / ja / fr

**UI 组件**：`client/src/components/` — 按功能组织（布局、图表、交易、设置等）

### 后端（server/）

**入口**：`server/src/index.ts` 导出 `createApp()` / `startServer()` / `stopServer()`，既能独立运行也能被 Electron 编程控制。加载顺序：模块 → 连接 SQLite → 迁移 → 注册插件 → 注册路由 → 静态文件 → 404 处理。

**插件与中间件**（`server/src/register.ts`）：
- `@fastify/helmet` — 安全头
- `@fastify/cookie` — Cookie 解析（用于会话）
- `@fastify/rate-limit` — 600 req/min 限流
- `@fastify/multipart` — 文件上传（5MB 限制）
- 自定义认证中间件 — 检查除白名单（`/api/heart`、`/api/password/check`、`/api/password/verify`）外的所有 `/api/*` 路由，基于 httpOnly Cookie 会话

**数据库**：Sequelize ORM + SQLite。模型文件在 `server/src/models/`，包含 Assets、Record、Position、Trade、Insight、Goal、Password、Session、UserSettings、CustomCurrency。新增模型必须在 `server/src/index.ts` 的 `loadServerModules()` 中 import。

> ⚠️ 数据库文件实际路径是 `server/data/wealth_tracker.sqlite`（由 `server/src/helper/constant.ts` 中 `DEFAULT_SQLITE_DB` 定义）。根目录 `data/wealth_tracker.sqlite` 是旧版路径，已废弃。通过 `SQLITE_DB_PATH` 环境变量可覆盖。

**数据库迁移**：在 `server/src/index.ts` 的 `connectToSqlite()` 中内联执行。模式：用 `PRAGMA table_info` 检查列是否存在 → 不存在则 `ALTER TABLE ADD COLUMN`。这是 SQLite 向后兼容迁移的标准做法。

**路由与控制器**：
- 所有路由在 `server/src/routes/index.ts` 注册（展开各模块的路由数组）
- 控制器在 `server/src/controllers/`，处理实际业务逻辑
- 最复杂的控制器是 `trades.ts`（BUY/SELL 逻辑、加权平均成本、已实现盈亏、交易回滚、CSV 批量导入）

### 认证机制

基于会话的密码保护（可选，由 `ALLOW_PASSWORD` 环境变量控制）：
- 密码使用 bcrypt + `PEPPER_SECRET` 哈希
- 会话 15 分钟过期，httpOnly Cookie
- 客户端先调用 `GET /api/password/check` 检查是否需要密码

### 运行时配置

**服务端环境变量**：
- `PORT`（默认 8888）、`HOST`（默认 0.0.0.0）、`ALLOW_PASSWORD`、`CAN_BE_RESET`、`PEPPER_SECRET`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`SQLITE_DB_PATH`、`PUBLIC_DIR`

**客户端环境变量**（`client/.env`）：
- `VITE_GOOGLE_ANALYTICS_KEY`

## Docker

```bash
docker run -d -p 8888:8888 -v "$(pwd)/data:/app/data" nicejade/wealth-tracker:latest
```

## 数据流

```
用户 → Svelte SPA → Axios /api/* 调用 → Fastify → Auth 中间件 → 路由 → 控制器 → Sequelize → SQLite
                                                                              ↘ SSE（AI 建议流式推送）
```
