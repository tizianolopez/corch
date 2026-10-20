import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { loadConfig, type AppConfig } from './config'
import { dbPlugin } from './plugins/db'
import { redisPlugin, type IRedisClient } from './plugins/redis'
import { errorHandlerPlugin } from './plugins/error-handler'
import { healthRoutes } from './routes/health'
import { puzzleRoutes } from './routes/puzzle'
import { sessionRoutes } from './routes/session'

export interface BuildAppOptions {
  /** Sobrescribe valores de configuración para tests o entornos específicos */
  configOverrides?: Partial<AppConfig>
  /** Opciones de logger para Fastify (deshabilitado en tests si se pasa false) */
  logger?: FastifyServerOptions['logger']
  /** Cliente Redis específico (mock o preconfigurado) */
  redisClient?: IRedisClient
}

/**
 * Factoría de la aplicación Fastify 5 para Corchetes.
 * Permite instanciar la app tanto para ejecución de servidor como para pruebas
 * mediante `app.inject()` sin necesidad de abrir sockets de red.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const appConfig = loadConfig(options.configOverrides)

  const isTest = appConfig.NODE_ENV === 'test'

  const loggerConfig: FastifyServerOptions['logger'] =
    options.logger !== undefined
      ? options.logger
      : isTest
        ? false
        : {
            level: appConfig.LOG_LEVEL,
          }

  const app = fastify({
    logger: loggerConfig,
  })

  // ── Plugins base ──────────────────────────────────────────────────────────
  // 1. CORS
  const allowedOrigins = appConfig.CORS_ORIGIN.split(',').map((o) => o.trim())
  await app.register(cors, {
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })

  // 2. Rate Limit global (100 req/min por IP)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: ['/health', '/api/health'],
  })

  // 3. Manejo de errores global y logging
  await app.register(errorHandlerPlugin, { config: appConfig })

  // 4. Base de datos Drizzle ORM
  await app.register(dbPlugin, { config: appConfig })

  // 5. Upstash Redis
  await app.register(redisPlugin, {
    config: appConfig,
    client: options.redisClient,
  })

  // ── Rutas ─────────────────────────────────────────────────────────────────
  await app.register(healthRoutes)
  await app.register(puzzleRoutes)
  await app.register(sessionRoutes)

  return app
}
