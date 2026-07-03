import fs from 'fs/promises'
import path from 'path'
import Fastify, { FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
// Fix Bug: [fetch is not defined](Ubuntu16 Cannot Upgrade Node to v18.*)
import 'isomorphic-fetch'
import { Sequelize } from 'sequelize'
import { applyRuntimeOptions, getRuntimeOptions, ServerRuntimeOptions } from './helper/runtime'

let fastify: FastifyInstance | null = null
let sequelize: Sequelize | null = null
let serverAddress = ''
let appPromise: Promise<FastifyInstance> | null = null

const ensureDatabaseDirectory = async (dbPath: string) => {
  await fs.mkdir(path.dirname(dbPath), { recursive: true })
}

const connectToSqlite = async () => {
  if (!sequelize) {
    throw new Error('Sequelize has not been initialized.')
  }

  try {
    await ensureDatabaseDirectory(getRuntimeOptions().dbPath)

    // 重建 assets / record / position / trade 四表（按外键依赖顺序 DROP）
    const tablesToRebuild = ['trades', 'positions', 'record', 'assets']
    for (const table of tablesToRebuild) {
      await sequelize.query(`DROP TABLE IF EXISTS "${table}"`)
    }

    await sequelize.sync()

    // 向后兼容迁移：新增列（SQLite 不支持 DROP COLUMN 或 ALTER 大部分操作）
    const addColumnIfNotExists = async (table: string, column: string, def: string) => {
      const [info] = await sequelize.query(`PRAGMA table_info('${table}')`)
      const columns = (info as any[]).map((c: any) => c.name)
      if (!columns.includes(column)) {
        await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN ${column} ${def}`)
        console.log(`  → Added column "${column}" to "${table}"`)
      }
    }
    await addColumnIfNotExists('positions', 'open_date', 'DATE')
    await addColumnIfNotExists('positions', 'close_date', 'DATE')
    await addColumnIfNotExists('trades', 'fee', 'DECIMAL(14,2) NOT NULL DEFAULT 0')
    await addColumnIfNotExists('trades', 'position_id', 'INTEGER')

    console.log('🎊 Database synced!')
  } catch (err) {
    console.error('Failed to sync database:', err)
    throw err
  }
}

const setupStaticFiles = (app: FastifyInstance, publicDir: string) => {
  app.register(fastifyStatic, {
    root: publicDir,
    prefix: '',
  })
}

const setupNotFoundHandler = (app: FastifyInstance, publicDir: string) => {
  app.setNotFoundHandler(async (request, reply) => {
    if (!request.url.includes('/api/')) {
      const indexHtmlContent = await fs.readFile(path.join(publicDir, 'index.html'), 'utf-8')
      reply.type('text/html').send(indexHtmlContent)
    } else {
      reply.code(404).send({ error: 'Oops , Page Not Found.' })
    }
  })
}

const loadServerModules = async () => {
  const [registerModule, routesModule, modelsModule] = await Promise.all([
    import('./register'),
    import('./routes'),
    import('./models'),
    import('./models/customCurrency'),
    import('./models/userSettings'),
    import('./models/assets'),
    import('./models/records'),
    import('./models/insights'),
    import('./models/goals'),
    import('./models/password'),
    import('./models/session'),
    import('./models/positions'),
    import('./models/trades'),
  ])

  sequelize = modelsModule.sequelize

  return {
    registerPlugins: registerModule.default,
    routes: routesModule.default,
  }
}

export const createApp = async (options: ServerRuntimeOptions = {}) => {
  if (fastify) {
    return fastify
  }

  if (appPromise) {
    return appPromise
  }

  appPromise = (async () => {
    const runtimeOptions = applyRuntimeOptions(options)
    const app = Fastify({ logger: true })
    const { registerPlugins, routes } = await loadServerModules()

    await connectToSqlite()
    await registerPlugins(app)
    routes.forEach((route: any) => app.route(route))
    setupStaticFiles(app, runtimeOptions.publicDir)
    setupNotFoundHandler(app, runtimeOptions.publicDir)

    fastify = app
    return app
  })()

  try {
    return await appPromise
  } catch (error) {
    appPromise = null
    throw error
  }
}

export const startServer = async (options: ServerRuntimeOptions = {}) => {
  const app = await createApp(options)
  const runtimeOptions = getRuntimeOptions()

  if (!app.server.listening) {
    serverAddress = await app.listen({
      host: runtimeOptions.host,
      port: runtimeOptions.port,
    })
    app.log.info(`server listening on ${serverAddress}`)
  }

  return {
    address: serverAddress,
    app,
    options: runtimeOptions,
  }
}

export const stopServer = async () => {
  if (fastify) {
    await fastify.close()
  }

  if (sequelize) {
    await sequelize.close()
  }

  fastify = null
  sequelize = null
  serverAddress = ''
  appPromise = null
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
