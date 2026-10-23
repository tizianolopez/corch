import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'
import { memoryCommunityPuzzles } from '../routes/community'

describe('Retos de la Comunidad UGC (Fase 6.2)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    memoryCommunityPuzzles.clear()
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

  it('POST /api/community/create rechaza markup sin corchetes con código 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/community/create',
      payload: {
        markup: 'Frase común sin ningún tipo de corchete ni pista',
        creatorAlias: 'Test Lector',
      },
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toBe('Validation Error')
    expect(body.message).toContain('al menos un corchete')
  })

  it('POST /api/community/create rechaza corchetes desbalanceados con código 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/community/create',
      payload: {
        markup: 'Texto con [corchete abierto sin cerrar',
        creatorAlias: 'Test Lector',
      },
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toBe('Validation Error')
    expect(body.message).toContain('Parser')
  })

  it('POST /api/community/create compila puzle con soluciones en nodo y devuelve shortId y url', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/community/create',
      payload: {
        markup: 'En un lugar de la [región donde cabalgaba el [hidalgo]]',
        creatorAlias: 'Lector Cervantino',
        quoteAuthor: 'Miguel de Cervantes',
        quoteWork: 'Don Quijote',
        quoteYear: 1605,
        nodes: [
          { id: 'n1', solution: 'Mancha', type: 'definition' },
          { id: 'n2', solution: 'Quijote', type: 'definition' },
        ],
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.shortId).toBeDefined()
    expect(body.shortId).toHaveLength(8)
    expect(body.url).toBe(`/r/${body.shortId}`)
    expect(body.creatorAlias).toBe('Lector Cervantino')
  })

  it('POST /api/community/create compila puzle con formato inline [pista|solución]', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/community/create',
      payload: {
        markup: 'El río [Guadalquivir|río que cruza Sevilla] desemboca en Sanlúcar',
        creatorAlias: 'Andaluz',
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.shortId).toBeDefined()
    expect(body.url).toBe(`/r/${body.shortId}`)
  })

  it('GET /api/community/:shortId devuelve 404 para identificador inexistente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/community/inexistente123',
    })

    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.message).toContain('no existe')
  })

  it('GET /api/community/:shortId devuelve el payload ofuscado sin revelar soluciones en texto plano', async () => {
    // 1. Crear el puzle
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/community/create',
      payload: {
        markup: 'Caminante no hay [camino|senda por donde transitar], se hace camino al andar',
        creatorAlias: 'Antonio Machado',
        nodes: [{ id: 'n1', solution: 'camino' }],
      },
    })
    const { shortId } = createRes.json<{ shortId: string }>()

    // 2. Obtener el puzle
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/community/${shortId}`,
    })

    expect(getRes.statusCode).toBe(200)
    const body = getRes.json()
    expect(body.id).toBe(shortId)
    expect(body.creatorAlias).toBe('Antonio Machado')
    expect(body.clientPayload).toBeDefined()
    expect(body.clientPayload.nodes.n1).toBeDefined()
    expect(body.clientPayload.nodes.n1.solutionHash).toBeDefined()
    expect(body.clientPayload.nodes.n1.solutionCipher).toBeDefined()
    // CRÍTICO: nunca debe tener el campo solution en texto plano
    expect(body.clientPayload.nodes.n1.solution).toBeUndefined()
  })
})
