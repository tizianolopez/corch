import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { buildApp } from '../app'
import { InMemoryRedisClient } from '../plugins/redis'

describe('Fastify 5 App & Setup (Tarea 2.1)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp({
      configOverrides: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
      },
    })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  // ── 1. Inicialización y decoradores ───────────────────────────────────────
  it('inicializa Fastify 5 con decoradores de db y redis', () => {
    expect(app).toBeDefined()
    expect(app.redis).toBeDefined()
    expect(typeof app.redis.ping).toBe('function')
    expect('db' in app).toBe(true)
  })

  // ── 2. Endpoint Health Check ──────────────────────────────────────────────
  it('GET /health devuelve 200 con status ok y metadatos de servicios', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.status).toBe('ok')
    expect(body.version).toBe('0.0.1')
    expect(body.services).toBeDefined()
    expect(body.services.redis).toBe('connected')
    expect(body.services.database).toBe('not_configured')
    expect(typeof body.uptime).toBe('number')
    expect(typeof body.timestamp).toBe('string')
  })

  it('GET /api/health también devuelve 200 con la misma estructura', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe('ok')
  })

  // ── 3. Manejo Global de 404 (Not Found) ────────────────────────────────────
  it('devuelve 404 estructurado cuando la ruta no existe', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ruta-inexistente-12345',
    })

    expect(response.statusCode).toBe(404)
    const body = response.json()
    expect(body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Ruta GET /ruta-inexistente-12345 no encontrada',
    })
  })

  // ── 4. CORS ───────────────────────────────────────────────────────────────
  it('incluye cabeceras CORS para el origen configurado', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      },
    })

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    )
  })
})

describe('Fastify 5 Manejo de Errores Global (Pino + ErrorHandler)', () => {
  it('captura errores 500 no controlados y devuelve formato JSON estructurado', async () => {
    const testApp = await buildApp({
      configOverrides: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
    })

    // Registramos la ruta que lanza error antes de llamar a ready()
    testApp.get('/error-test', async () => {
      throw new Error('Fallo crítico simulado')
    })
    await testApp.ready()

    const response = await testApp.inject({
      method: 'GET',
      url: '/error-test',
    })

    expect(response.statusCode).toBe(500)
    const body = response.json()
    expect(body.statusCode).toBe(500)
    expect(body.error).toBe('Internal Server Error')
    expect(body.message).toContain('Fallo crítico simulado')

    await testApp.close()
  })

  it('captura errores de validación Zod y responde 400 con detalles', async () => {
    const testApp = await buildApp({
      configOverrides: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
    })

    const TestSchema = z.object({
      answer: z.string().min(3),
    })

    testApp.post('/zod-test', async (req) => {
      const data = TestSchema.parse(req.body)
      return { ok: true, data }
    })
    await testApp.ready()

    const response = await testApp.inject({
      method: 'POST',
      url: '/zod-test',
      payload: { answer: 'a' }, // demasiado corto (< 3 chars)
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.statusCode).toBe(400)
    expect(body.error).toBe('Bad Request')
    expect(body.message).toContain('validación')
    expect(body.details).toBeDefined()

    await testApp.close()
  })
})

describe('InMemoryRedisClient (Plugin Redis)', () => {
  it('gestiona operaciones sorted set (zadd, zcount, zrange)', async () => {
    const client = new InMemoryRedisClient()

    await client.zadd('leaderboard', { score: 120, member: 'user_1' })
    await client.zadd('leaderboard', { score: 90, member: 'user_2' })
    await client.zadd('leaderboard', { score: 200, member: 'user_3' })

    const count = await client.zcount('leaderboard', '-inf', 150)
    expect(count).toBe(2) // user_2 (90) y user_1 (120)

    const range = await client.zrange('leaderboard', 0, -1)
    expect(range).toEqual(['user_2', 'user_1', 'user_3'])

    const revRange = await client.zrange('leaderboard', 0, 1, { rev: true })
    expect(revRange).toEqual(['user_3', 'user_1'])
  })

  it('gestiona operaciones clave-valor (set, get, del)', async () => {
    const client = new InMemoryRedisClient()

    await client.set('puzzle:today', { id: 'p1', author: 'Cervantes' })
    const data = await client.get<{ id: string; author: string }>('puzzle:today')
    expect(data?.author).toBe('Cervantes')

    await client.del('puzzle:today')
    const deleted = await client.get('puzzle:today')
    expect(deleted).toBeNull()

    const ping = await client.ping()
    expect(ping).toBe('PONG')
  })
})
