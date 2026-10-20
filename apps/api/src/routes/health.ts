import type { FastifyPluginAsync } from 'fastify'

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = async () => {
    let redisStatus = 'not_configured'
    try {
      if (fastify.redis) {
        const ping = await fastify.redis.ping()
        redisStatus = ping === 'PONG' ? 'connected' : 'error'
      }
    } catch {
      redisStatus = 'error'
    }

    const dbStatus = fastify.db ? 'connected' : 'not_configured'

    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: '0.0.1',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    }
  }

  fastify.get('/health', handler)
  fastify.get('/api/health', handler)
}
