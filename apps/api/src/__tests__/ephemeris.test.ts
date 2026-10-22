/**
 * Tests unitarios del servicio de efemérides (Fase 3.1)
 *
 * Todos los tests usan:
 *  - InMemoryRedisClient (sin conexión real a Redis)
 *  - fetchFn mockeada (sin llamadas reales a la API de Wikimedia)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getEphemerisEvents,
  buildSeedPhrase,
  type EphemerisEvent,
  type WikiEvent,
} from '../services/ephemeris'
import { InMemoryRedisClient } from '../plugins/redis'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Respuesta típica de la API de Wikimedia para el 22 de octubre */
function buildMockWikimediaResponse(events: WikiEvent[]) {
  return {
    selected: events,
  }
}

/** Crea un WikiEvent válido con valores por defecto sobreescribibles */
function buildWikiEvent(overrides: Partial<WikiEvent> = {}): WikiEvent {
  return {
    year: 1962,
    text: 'El presidente John F. Kennedy anunció el bloqueo naval a Cuba durante la Crisis de los Misiles.',
    pages: [
      {
        title: 'Crisis de los misiles de Cuba',
        extract:
          'La crisis de los misiles de Cuba fue un conflicto de 13 días entre la Unión Soviética y Cuba por un lado, y los Estados Unidos por el otro.',
        content_urls: {
          desktop: {
            page: 'https://es.wikipedia.org/wiki/Crisis_de_los_misiles_de_Cuba',
          },
        },
      },
    ],
    ...overrides,
  }
}

/** Crea un mock de fetch que devuelve la respuesta dada */
function buildFetchMock(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

// ─── Suite principal ──────────────────────────────────────────────────────────

describe('getEphemerisEvents — Servicio de efemérides (3.1)', () => {
  let redis: InMemoryRedisClient

  beforeEach(() => {
    redis = new InMemoryRedisClient()
  })

  // ── Caso feliz ──────────────────────────────────────────────────────────────

  it('devuelve eventos normalizados cuando la API responde correctamente', async () => {
    const mockEvent = buildWikiEvent()
    const fetchFn = buildFetchMock(buildMockWikimediaResponse([mockEvent]))

    const events = await getEphemerisEvents(10, 22, {
      redis,
      wikimediaBaseUrl: 'https://api.wikimedia.org',
      fetchFn,
    })

    expect(fetchFn).toHaveBeenCalledOnce()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject<Partial<EphemerisEvent>>({
      year: 1962,
      text: 'El presidente John F. Kennedy anunció el bloqueo naval a Cuba durante la Crisis de los Misiles.',
      wikipediaUrl:
        'https://es.wikipedia.org/wiki/Crisis_de_los_misiles_de_Cuba',
    })
    expect(events[0].extract).toBeDefined()
    expect(events[0].extract!.length).toBeLessThanOrEqual(400)
  })

  // ── Caché ───────────────────────────────────────────────────────────────────

  it('guarda la respuesta en Redis y la reutiliza en la segunda llamada', async () => {
    const mockEvent = buildWikiEvent()
    const fetchFn = buildFetchMock(buildMockWikimediaResponse([mockEvent]))

    // Primera llamada — debe ir a la API
    await getEphemerisEvents(10, 22, { redis, fetchFn })
    // Segunda llamada — debe usar la caché
    await getEphemerisEvents(10, 22, { redis, fetchFn })

    // fetch solo se llama una vez
    expect(fetchFn).toHaveBeenCalledOnce()
  })

  it('la clave de caché incluye mes y día con ceros a la izquierda', async () => {
    const fetchFn = buildFetchMock(buildMockWikimediaResponse([buildWikiEvent()]))

    await getEphemerisEvents(1, 5, { redis, fetchFn })

    const cached = await redis.get('ephemeris:es:01:05')
    expect(cached).not.toBeNull()
    expect(Array.isArray(cached)).toBe(true)
  })

  // ── Filtro de relevancia ────────────────────────────────────────────────────

  it('descarta eventos con texto demasiado corto (< 40 caracteres)', async () => {
    const shortEvent = buildWikiEvent({ text: 'Evento irrelevante.' }) // < 40 chars
    const longEvent = buildWikiEvent({
      year: 1969,
      text: 'El módulo Eagle del Apolo 11 aterrizó en la Luna con Neil Armstrong y Buzz Aldrin a bordo.',
    })

    const fetchFn = buildFetchMock(
      buildMockWikimediaResponse([shortEvent, longEvent]),
    )

    const events = await getEphemerisEvents(7, 20, { redis, fetchFn })

    expect(events).toHaveLength(1)
    expect(events[0].year).toBe(1969)
  })

  it('descarta eventos sin año definido', async () => {
    const noYearEvent = { text: 'Un evento sin año registrado en los anales.', pages: [] } as unknown as WikiEvent
    const validEvent = buildWikiEvent()

    const fetchFn = buildFetchMock(
      buildMockWikimediaResponse([noYearEvent, validEvent]),
    )

    const events = await getEphemerisEvents(10, 22, { redis, fetchFn })

    expect(events).toHaveLength(1)
    expect(events[0].year).toBe(1962)
  })

  it('prioriza eventos con páginas de Wikipedia asociadas', async () => {
    const withPage = buildWikiEvent({
      year: 1969,
      text: 'El módulo Eagle del Apolo 11 aterrizó en la Luna con Neil Armstrong y Buzz Aldrin a bordo.',
    })
    const withoutPage = buildWikiEvent({ year: 1800, pages: [] })

    const fetchFn = buildFetchMock(
      buildMockWikimediaResponse([withoutPage, withPage]),
    )

    const events = await getEphemerisEvents(7, 20, { redis, fetchFn })

    // El evento con página debe aparecer primero
    expect(events[0].year).toBe(1969)
  })

  it('usa el campo `events` como fallback si `selected` está vacío', async () => {
    const event = buildWikiEvent()
    const fetchFn = buildFetchMock({
      selected: [],
      events: [event],
    })

    const events = await getEphemerisEvents(10, 22, { redis, fetchFn })

    expect(events).toHaveLength(1)
    expect(events[0].year).toBe(1962)
  })

  // ── Eventos sin páginas ─────────────────────────────────────────────────────

  it('normaliza eventos sin páginas de Wikipedia (campos opcionales quedan undefined)', async () => {
    const eventNoPaginas = buildWikiEvent({ pages: [] })
    const fetchFn = buildFetchMock(buildMockWikimediaResponse([eventNoPaginas]))

    const events = await getEphemerisEvents(10, 22, { redis, fetchFn })

    expect(events[0].wikipediaUrl).toBeUndefined()
    expect(events[0].extract).toBeUndefined()
  })

  // ── Errores de la API ───────────────────────────────────────────────────────

  it('lanza un error si la API de Wikimedia responde con un código de error', async () => {
    const fetchFn = buildFetchMock({}, 503)

    await expect(
      getEphemerisEvents(10, 22, { redis, fetchFn }),
    ).rejects.toThrow('Wikimedia API respondió con 503')
  })

  it('no guarda nada en caché si la respuesta está vacía', async () => {
    const fetchFn = buildFetchMock({ selected: [], events: [] })

    const events = await getEphemerisEvents(10, 22, { redis, fetchFn })

    expect(events).toHaveLength(0)
    const cached = await redis.get('ephemeris:es:10:22')
    expect(cached).toBeNull()
  })

  // ── Límite de resultados ────────────────────────────────────────────────────

  it('devuelve como máximo 10 eventos aunque la API envíe más', async () => {
    const manyEvents = Array.from({ length: 25 }, (_, i) =>
      buildWikiEvent({
        year: 1900 + i,
        text: `Evento histórico número ${i + 1} con suficiente texto para superar el filtro de longitud mínima requerido.`,
      }),
    )
    const fetchFn = buildFetchMock(buildMockWikimediaResponse(manyEvents))

    const events = await getEphemerisEvents(10, 22, { redis, fetchFn })

    expect(events.length).toBeLessThanOrEqual(10)
  })
})

// ─── buildSeedPhrase ──────────────────────────────────────────────────────────

describe('buildSeedPhrase', () => {
  it('construye la frase semilla con el formato correcto', () => {
    const event: EphemerisEvent = {
      year: 1962,
      text: 'Kennedy anunció el bloqueo naval a Cuba.',
    }
    const phrase = buildSeedPhrase(event)
    expect(phrase).toBe(
      'Un día como hoy, pero en 1962, Kennedy anunció el bloqueo naval a Cuba.',
    )
  })

  it('incluye siempre el año en la frase', () => {
    const event: EphemerisEvent = { year: 1969, text: 'El Apolo 11 llegó a la Luna.' }
    expect(buildSeedPhrase(event)).toContain('1969')
  })
})
