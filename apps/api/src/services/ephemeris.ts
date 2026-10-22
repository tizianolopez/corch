/**
 * @module ephemeris
 *
 * Servicio extractor de efemérides históricas usando la API oficial de Wikimedia:
 *   GET https://api.wikimedia.org/feed/v1/wikipedia/es/onthisday/selected/{MM}/{DD}
 *
 * Las respuestas se cachean en Redis con TTL de 24 h para no repetir llamadas
 * a la API externa más de una vez por día.
 */

import type { IRedisClient } from '../plugins/redis'

// ─── Tipos de la respuesta Wikimedia ─────────────────────────────────────────

/** Un artículo de Wikipedia referenciado dentro de un evento */
export interface WikiPage {
  title: string
  extract: string
  content_urls?: {
    desktop?: { page?: string }
  }
}

/** Un evento histórico tal como lo devuelve la API de Wikimedia */
export interface WikiEvent {
  /** Año del evento */
  year: number
  /** Texto descriptivo del evento en el idioma solicitado */
  text: string
  /** Páginas de Wikipedia relacionadas con el evento */
  pages?: WikiPage[]
}

/** Respuesta cruda de la API de Wikimedia (campo `selected`) */
interface WikimediaOnThisDayResponse {
  selected?: WikiEvent[]
  events?: WikiEvent[]
  births?: WikiEvent[]
  deaths?: WikiEvent[]
}

// ─── Tipos exportables del servicio ──────────────────────────────────────────

/**
 * Evento histórico normalizado listo para ser consumido por el agente generador.
 */
export interface EphemerisEvent {
  /** Año en que ocurrió el evento */
  year: number
  /** Descripción del evento en español */
  text: string
  /** URL del artículo principal de Wikipedia (si está disponible) */
  wikipediaUrl?: string
  /** Fragmento de contexto del artículo principal (primeras líneas del extract) */
  extract?: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Duración de la caché en segundos (24 horas) */
const CACHE_TTL_SECONDS = 24 * 60 * 60

/** Longitud mínima de texto para considerar un evento editorialmente relevante */
const MIN_TEXT_LENGTH = 40

/** Longitud máxima del extracto de Wikipedia que se almacena */
const MAX_EXTRACT_LENGTH = 400

/** Número máximo de eventos a devolver tras el filtrado */
const MAX_EVENTS = 10

// ─── Utilidades internas ──────────────────────────────────────────────────────

/**
 * Construye la clave de caché de Redis para una fecha concreta.
 * Formato: `ephemeris:es:{MM}:{DD}`
 */
function buildCacheKey(month: number, day: number): string {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `ephemeris:es:${mm}:${dd}`
}

/**
 * Construye la URL de la API de Wikimedia para un día y mes concretos.
 */
function buildWikimediaUrl(
  month: number,
  day: number,
  baseUrl: string,
): string {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${baseUrl}/feed/v1/wikipedia/es/onthisday/selected/${mm}/${dd}`
}

/**
 * Filtra eventos por relevancia editorial:
 *  - Descarta textos demasiado cortos (poco informativos).
 *  - Descarta eventos sin año definido.
 *  - Prioriza eventos que tengan artículo de Wikipedia asociado.
 */
function filterByRelevance(events: WikiEvent[]): WikiEvent[] {
  return events
    .filter(
      (e) =>
        typeof e.year === 'number' &&
        typeof e.text === 'string' &&
        e.text.trim().length >= MIN_TEXT_LENGTH,
    )
    .sort((a, b) => {
      // Priorizar eventos con páginas de Wikipedia (más contexto disponible)
      const aHasPage = (a.pages?.length ?? 0) > 0 ? 1 : 0
      const bHasPage = (b.pages?.length ?? 0) > 0 ? 1 : 0
      return bHasPage - aHasPage
    })
    .slice(0, MAX_EVENTS)
}

/**
 * Normaliza un WikiEvent a un EphemerisEvent limpio.
 */
function normalizeEvent(event: WikiEvent): EphemerisEvent {
  const mainPage = event.pages?.[0]
  const extract = mainPage?.extract
    ? mainPage.extract.slice(0, MAX_EXTRACT_LENGTH).trim()
    : undefined

  const wikipediaUrl =
    mainPage?.content_urls?.desktop?.page ?? undefined

  return {
    year: event.year,
    text: event.text.trim(),
    wikipediaUrl,
    extract,
  }
}

// ─── Función principal ────────────────────────────────────────────────────────

export interface EphemerisOptions {
  /** Cliente Redis para caché (puede ser InMemoryRedisClient en tests) */
  redis: IRedisClient
  /** URL base de la API de Wikimedia. Por defecto: https://api.wikimedia.org */
  wikimediaBaseUrl?: string
  /** Función fetch inyectable (para tests sin red) */
  fetchFn?: typeof fetch
}

/**
 * Obtiene los eventos históricos del día, usando la caché de Redis cuando
 * ya existe una respuesta almacenada para ese día.
 *
 * @param month  Mes del año (1-12)
 * @param day    Día del mes (1-31)
 * @param opts   Opciones: cliente Redis, URL base de la API, fetch inyectable
 * @returns      Lista de EphemerisEvent ordenados por relevancia editorial
 */
export async function getEphemerisEvents(
  month: number,
  day: number,
  opts: EphemerisOptions,
): Promise<EphemerisEvent[]> {
  const {
    redis,
    wikimediaBaseUrl = 'https://api.wikimedia.org',
    fetchFn = fetch,
  } = opts

  const cacheKey = buildCacheKey(month, day)

  // 1. Intentar leer desde la caché de Redis
  const cached = await redis.get<EphemerisEvent[]>(cacheKey)
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return cached
  }

  // 2. Llamar a la API de Wikimedia
  const url = buildWikimediaUrl(month, day, wikimediaBaseUrl)
  const response = await fetchFn(url, {
    headers: {
      // Cabecera recomendada por Wikimedia para identificar el cliente
      'User-Agent': 'Corchetes/1.0 (https://corchetes.es; hola@corchetes.es)',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Wikimedia API respondió con ${response.status} para ${url}`,
    )
  }

  const data = (await response.json()) as WikimediaOnThisDayResponse

  // 3. Extraer y normalizar eventos
  const rawEvents: WikiEvent[] = data.selected ?? []
  if (rawEvents.length === 0) {
    // Fallback a eventos generales si `selected` está vacío
    rawEvents.push(...(data.events ?? []))
  }

  const filtered = filterByRelevance(rawEvents)
  const normalized = filtered.map(normalizeEvent)

  // 4. Guardar en caché para el resto del día
  if (normalized.length > 0) {
    await redis.set(cacheKey, normalized, { ex: CACHE_TTL_SECONDS })
  }

  return normalized
}

/**
 * Construye una frase semilla con el formato «Un día como hoy» a partir de
 * un EphemerisEvent. Esta frase se pasa al agente generador como punto de
 * partida para crear el markup de corchetes.
 *
 * Ejemplo de salida:
 *   «Un día como hoy, pero en 1962, John F. Kennedy anunció el bloqueo
 *    naval a Cuba durante la Crisis de los Misiles.»
 */
export function buildSeedPhrase(event: EphemerisEvent): string {
  return `Un día como hoy, pero en ${event.year}, ${event.text}`
}
