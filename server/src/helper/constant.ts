import fs from 'fs'
import path from 'path'

const SERVER_ROOT = path.resolve(__dirname, '..', '..')
const ENV_CONFIG_PATH = path.join(SERVER_ROOT, 'env.config.json')

export const DEFAULT_SQLITE_DB = path.join(SERVER_ROOT, 'data', 'wealth_tracker.sqlite')

export const DEFAULT_PUBLIC_DIR = path.join(SERVER_ROOT, 'public')

export const DEFAULT_HOST = '0.0.0.0'

export const DEFAULT_PORT = 8888

export const parseBooleanEnv = (value: string | undefined, fallback = false) => {
  if (value === undefined) {
    return fallback
  }

  return value === 'true'
}

/** 环境配置文件的类型定义 */
interface EnvConfigItem {
  port: number
  database: string
}

/** 缓存的环境配置映射 */
let _envConfig: Record<string, EnvConfigItem> | null = null

/**
 * 加载 env.config.json，文件不存在或解析失败时返回空对象。
 * 结果会被缓存，避免重复读取文件。
 */
const loadEnvConfig = (): Record<string, EnvConfigItem> => {
  if (_envConfig !== null) {
    return _envConfig
  }
  try {
    return JSON.parse(fs.readFileSync(ENV_CONFIG_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

/**
 * 确定当前应用环境。
 * 优先级：APP_ENV > NODE_ENV 推断 > 'dev'（兜底）
 *
 * - APP_ENV=test → 'test'
 * - NODE_ENV=production → 'prod'
 * - 未设置 → 'dev'
 */
export const getCurrentEnv = (): string => {
  if (process.env.APP_ENV) {
    return process.env.APP_ENV
  }
  return process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
}

/**
 * 获取当前环境的配置项，未匹配到时返回 null。
 */
export const getEnvConfig = (): EnvConfigItem | null => {
  const env = getCurrentEnv()
  const config = loadEnvConfig()
  return config[env] ?? null
}

/**
 * 获取当前环境的默认端口号。
 * 优先级：PORT 环境变量 > env.config.json > DEFAULT_PORT(8888)
 */
export const getDefaultPort = (): number => {
  if (process.env.PORT) {
    return parseInt(process.env.PORT, 10)
  }
  return getEnvConfig()?.port ?? DEFAULT_PORT
}

/**
 * 获取当前环境的 SQLite 数据库路径。
 * 优先级：SQLITE_DB_PATH 环境变量 > env.config.json 中的 database > 模式兜底 > DEFAULT_SQLITE_DB
 *
 * 模式兜底：当 env.config.json 中无匹配项但能确定环境名时，
 * 使用 wealth_tracker_{env}.sqlite。
 */
export const getSqliteDbPath = (): string => {
  if (process.env.SQLITE_DB_PATH) {
    return process.env.SQLITE_DB_PATH
  }

  const envConfig = getEnvConfig()
  if (envConfig?.database) {
    return path.join(SERVER_ROOT, 'data', envConfig.database)
  }

  // 模式兜底：未知环境也用 wealth_tracker_{env}.sqlite
  const env = getCurrentEnv()
  if (env !== 'prod') {
    return path.join(SERVER_ROOT, 'data', `wealth_tracker_${env}.sqlite`)
  }

  return DEFAULT_SQLITE_DB
}

export const getPublicDir = () => {
  return process.env.PUBLIC_DIR || DEFAULT_PUBLIC_DIR
}
