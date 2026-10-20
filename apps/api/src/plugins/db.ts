import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { createDb, type DbClient } from '@corchetes/db'
import type { AppConfig } from '../config'

declare module 'fastify' {
  interface FastifyInstance {
    db: DbClient | null
  }
}

export interface DbPluginOptions {
  config: AppConfig
}

/**
 * Plugin de conexión a base de datos PostgreSQL / Supabase mediante Drizzle ORM.
 * Decora la instancia raíz de Fastify con `fastify.db`.
 */
const dbPluginFn: FastifyPluginAsync<DbPluginOptions> = async (
  fastify,
  options,
) => {
  const databaseUrl = options.config.DATABASE_URL

  if (!databaseUrl) {
    fastify.log.warn(
      'DATABASE_URL no configurada. fastify.db inicializado como null (modo desarrollo/test sin base de datos)',
    )
    fastify.decorate('db', null)
    return
  }

  try {
    const db = createDb(databaseUrl)
    fastify.decorate('db', db)
    fastify.log.info('Conexión a base de datos Drizzle ORM inicializada')
  } catch (err) {
    fastify.log.error(
      { err },
      'Fallo al inicializar la conexión con la base de datos',
    )
    if (options.config.NODE_ENV === 'production') {
      throw err
    }
    fastify.decorate('db', null)
  }
}

export const dbPlugin = fp(dbPluginFn, {
  name: 'corchetes-db',
  fastify: '5.x',
})
