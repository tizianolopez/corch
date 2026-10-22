/**
 * @module anonymousSession
 *
 * Gestión de identidad de sesión anónima para Corchetes.
 * Permite a los lectores jugar inmediatamente sin registro previo,
 * persistiendo su identificador en localStorage y cookies para conservar
 * su progreso y racha diaria en el dispositivo.
 *
 * Fuente de verdad: docs/tasks.md §4.1 y docs/spec.md
 */

export const ANONYMOUS_ID_COOKIE = 'corchetes_anonymous_id'
export const ANONYMOUS_ID_STORAGE_KEY = 'corchetes_anonymous_id'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id)
}

/**
 * Lee la cookie de sesión anónima en el navegador si está disponible.
 */
export function getAnonymousIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, val] = cookie.trim().split('=')
    if (name === ANONYMOUS_ID_COOKIE && val && isValidUuid(val)) {
      return val
    }
  }
  return null
}

/**
 * Guarda el anonymousId en cookie con duración de 1 año (31536000 s).
 */
export function setAnonymousIdCookie(id: string): void {
  if (typeof document === 'undefined') return
  const oneYearSeconds = 31536000
  document.cookie = `${ANONYMOUS_ID_COOKIE}=${id}; path=/; max-age=${oneYearSeconds}; SameSite=Lax`
}

/**
 * Obtiene el anonymousId persistido o genera uno nuevo de forma determinista.
 * Sincroniza tanto localStorage como document.cookie.
 */
export function getOrCreateAnonymousId(): string {
  if (typeof window === 'undefined') {
    return '00000000-0000-4000-8000-000000000000'
  }

  // 1. Intentar leer de localStorage
  let currentId: string | null = null
  try {
    const stored = localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY)
    if (stored && isValidUuid(stored)) {
      currentId = stored
    }
  } catch {
    // Modo privado o storage bloqueado
  }

  // 2. Si no estaba en localStorage, intentar leer de cookie
  if (!currentId) {
    currentId = getAnonymousIdFromCookie()
  }

  // 3. Si no existe o es inválido, generar un nuevo UUIDv4 criptográfico
  if (!currentId) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      currentId = crypto.randomUUID()
    } else {
      currentId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    }
  }

  // 4. Sincronizar en ambos almacenes
  try {
    localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, currentId)
  } catch {
    // Ignorar fallo de storage
  }
  setAnonymousIdCookie(currentId)

  return currentId
}
