/**
 * Utilidades de tiempo para Corchetes (Zona horaria Europe/Madrid)
 */

/**
 * Devuelve la fecha actual en hora peninsular española (Europe/Madrid)
 * en formato ISO 'YYYY-MM-DD'.
 */
export function getTodayDateMadrid(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now) // ej: "2026-10-20"
}

/**
 * Calcula los segundos restantes hasta la próxima medianoche (00:00:00 h)
 * en hora peninsular española (Europe/Madrid).
 *
 * Utilizado para el encabezado Cache-Control de Cloudflare, asegurando
 * que la caché del puzle diario expire exactamente al cambiar el día.
 */
export function getSecondsUntilMidnightMadrid(now: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const map: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = parseInt(part.value, 10)
    }
  }

  const hours = map['hour'] ?? 0
  const minutes = map['minute'] ?? 0
  const seconds = map['second'] ?? 0

  // 24 h en formato 24 puede llegar como 24 o 0
  const normHours = hours === 24 ? 0 : hours
  const secondsPassedToday = normHours * 3600 + minutes * 60 + seconds
  const totalSecondsInDay = 86400
  const secondsRemaining = totalSecondsInDay - secondsPassedToday

  // Garantizar un valor entre 60 s y 86400 s
  return Math.max(60, Math.min(totalSecondsInDay, secondsRemaining))
}

/**
 * Genera la clave canónica de Redis para el sorted set de tiempos de resolución
 * de una edición diaria (p. ej. 'stats:edition:2026-10-20:times').
 */
export function getTimesRedisKey(dateStr: string = getTodayDateMadrid()): string {
  return `stats:edition:${dateStr}:times`
}
