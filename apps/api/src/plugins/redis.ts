import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Redis } from '@upstash/redis'
import type { AppConfig } from '../config'

/**
 * Interfaz mínima para interactuar con Redis en Corchetes
 * (compatible tanto con @upstash/redis como con el fallback en memoria).
 */
export interface IRedisClient {
  /** Añade uno o más miembros con puntuación a un sorted set */
  zadd: (key: string, member: { score: number; member: string }) => Promise<number | null>
  /** Cuenta miembros en un sorted set con puntuación entre min y max */
  zcount: (key: string, min: number | string, max: number | string) => Promise<number>
  /** Obtiene rango de miembros de un sorted set */
  zrange: (
    key: string,
    start: number,
    stop: number,
    options?: { withScores?: boolean; rev?: boolean },
  ) => Promise<string[] | { score: number; member: string }[]>
  /** Obtiene un valor por clave */
  get: <T = string>(key: string) => Promise<T | null>
  /** Guarda un valor con opciones opcionales (ex, etc.) */
  set: (key: string, value: unknown, options?: { ex?: number }) => Promise<string | null>
  /** Elimina una o más claves */
  del: (...keys: string[]) => Promise<number>
  /** Devuelve la cardinalidad total de un sorted set */
  zcard: (key: string) => Promise<number>
  /** Ping de comprobación de salud */
  ping: () => Promise<string>
}

declare module 'fastify' {
  interface FastifyInstance {
    redis: IRedisClient
  }
}

/**
 * Cliente Redis en memoria para desarrollo local sin conexión y tests unitarios.
 */
export class InMemoryRedisClient implements IRedisClient {
  private kv = new Map<string, string>()
  private zsets = new Map<string, { score: number; member: string }[]>()

  async zadd(key: string, member: { score: number; member: string }): Promise<number> {
    const list = this.zsets.get(key) ?? []
    const existingIndex = list.findIndex((item) => item.member === member.member)
    if (existingIndex >= 0) {
      list[existingIndex] = member
    } else {
      list.push(member)
    }
    // Ordenar por score ascendente
    list.sort((a, b) => a.score - b.score)
    this.zsets.set(key, list)
    return 1
  }

  async zcount(key: string, min: number | string, max: number | string): Promise<number> {
    const list = this.zsets.get(key) ?? []
    const minVal = min === '-inf' ? -Infinity : Number(min)
    const maxVal = max === '+inf' ? Infinity : Number(max)
    return list.filter((item) => item.score >= minVal && item.score <= maxVal).length
  }

  async zrange(
    key: string,
    start: number,
    stop: number,
    options?: { withScores?: boolean; rev?: boolean },
  ): Promise<string[] | { score: number; member: string }[]> {
    const list = [...(this.zsets.get(key) ?? [])]
    if (options?.rev) {
      list.reverse()
    }
    const end = stop === -1 ? list.length : stop + 1
    const sliced = list.slice(start, end)

    if (options?.withScores) {
      return sliced
    }
    return sliced.map((i) => i.member)
  }

  async get<T = string>(key: string): Promise<T | null> {
    const val = this.kv.get(key)
    if (val === undefined) return null
    try {
      return JSON.parse(val) as T
    } catch {
      return val as unknown as T
    }
  }

  async set(key: string, value: unknown, _options?: { ex?: number }): Promise<'OK'> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    this.kv.set(key, serialized)
    return 'OK'
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0
    for (const k of keys) {
      if (this.kv.delete(k) || this.zsets.delete(k)) {
        count++
      }
    }
    return count
  }

  async zcard(key: string): Promise<number> {
    return this.zsets.get(key)?.length ?? 0
  }

  async ping(): Promise<string> {
    return 'PONG'
  }
}

export interface RedisPluginOptions {
  config: AppConfig
  client?: IRedisClient
}

/**
 * Plugin de conexión a Redis (Upstash Redis o fallback en memoria).
 * Decora la instancia raíz de Fastify con `fastify.redis`.
 */
const redisPluginFn: FastifyPluginAsync<RedisPluginOptions> = async (
  fastify,
  options,
) => {
  // Si se pasa un cliente explícito (por ejemplo en tests)
  if (options.client) {
    fastify.decorate('redis', options.client)
    fastify.log.info('Cliente Redis personalizado inyectado')
    return
  }

  const { UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN } = options.config

  if (UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN) {
    try {
      const upstashClient = new Redis({
        url: UPSTASH_REDIS_URL,
        token: UPSTASH_REDIS_TOKEN,
      })

      // Envolver con compatibilidad tipada
      const wrapped: IRedisClient = {
        zadd: (key, member) => upstashClient.zadd(key, member),
        zcount: (key, min, max) => upstashClient.zcount(key, min, max),
        zrange: (key, start, stop, opts) => upstashClient.zrange(key, start, stop, opts),
        get: (key) => upstashClient.get(key),
        set: async (key, val, opts) => {
          if (opts?.ex !== undefined) {
            const res = await upstashClient.set(key, val, { ex: opts.ex })
            return typeof res === 'string' ? res : 'OK'
          }
          const res = await upstashClient.set(key, val)
          return typeof res === 'string' ? res : 'OK'
        },
        del: (...keys) => upstashClient.del(...keys),
        zcard: (key) => upstashClient.zcard(key),
        ping: () => upstashClient.ping(),
      }

      fastify.decorate('redis', wrapped)
      fastify.log.info('Conexión con Upstash Redis inicializada')
      return
    } catch (err) {
      fastify.log.error({ err }, 'Error al inicializar Upstash Redis')
      if (options.config.NODE_ENV === 'production') {
        throw err
      }
    }
  }

  // Fallback en memoria si no hay credenciales de Upstash en dev/test
  fastify.log.warn(
    'UPSTASH_REDIS_URL/TOKEN no configurados. Usando InMemoryRedisClient para desarrollo/test local.',
  )
  const memoryClient = new InMemoryRedisClient()
  fastify.decorate('redis', memoryClient)
}

export const redisPlugin = fp(redisPluginFn, {
  name: 'corchetes-redis',
  fastify: '5.x',
})
