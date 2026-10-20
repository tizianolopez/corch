/**
 * Normalización de input del jugador.
 *
 * Reglas específicas del español definidas en arquitectura_corchetes.md §5.4:
 * - Mayúsculas → minúsculas
 * - Tildes → vocal base (á→a, é→e, í→i, ó→o, ú→u)
 * - EXCEPCIÓN: Ñ se preserva siempre (nunca Ñ→N)
 * - Diéresis: ü→u (pingüino → pinguino), pero Ñ no se toca
 * - Signos de apertura ¿ y ¡ → se eliminan
 * - Signos de cierre ? y ! → se eliminan
 * - Espacios múltiples → espacio simple
 * - Números como palabras → dígitos (uno→1, dos→2, ... diez→10)
 *
 * IMPORTANTE: Esta función es la fuente de verdad de normalización.
 * El mismo algoritmo se usa en el servidor (packages/crypto) para
 * generar los hashes del payload. Cualquier cambio aquí debe replicarse
 * en la compilación de puzles.
 */

// ─── Mapa de números en palabras → dígitos ───────────────────────────────────

const NUMBER_WORDS: Record<string, string> = {
  cero: '0',
  uno: '1',
  una: '1',
  dos: '2',
  tres: '3',
  cuatro: '4',
  cinco: '5',
  seis: '6',
  siete: '7',
  ocho: '8',
  nueve: '9',
  diez: '10',
  once: '11',
  doce: '12',
  trece: '13',
  catorce: '14',
  quince: '15',
  veinte: '20',
  cien: '100',
  mil: '1000',
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Normaliza el input del jugador para la comparación con el hash de la solución.
 *
 * @param input - Texto tal como lo escribe el jugador
 * @returns Cadena normalizada lista para hashear
 *
 * @example
 * normalize("CAÑÓN")    → "cañon"  (tilde quitada, Ñ preservada, minúsculas)
 * normalize("Canción")  → "cancion"
 * normalize("¿Dónde?")  → "donde"
 * normalize("pingüino") → "pinguino"
 * normalize("TRES")     → "3"
 * normalize("canon")    → "canon"  (≠ "cañon" → error esperado)
 */
export function normalize(input: string): string {
  let result = input
    // 1. Minúsculas
    .toLowerCase()
    // 2. Eliminar signos de puntuación de apertura y cierre
    .replace(/[¿¡?!]/g, '')
    // 3. Normalizar tildes PRESERVANDO la Ñ
    //    Estrategia: proteger ñ antes de normalizar, luego restaurar
    .replace(/ñ/g, '__ENIE_MARKER__') // proteger ñ minúscula
    // Descomponer caracteres Unicode y eliminar diacríticos (tildes, diéresis)
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '') // eliminar marcas diacríticas (category Mn)
    // Restaurar ñ
    .replace(/__ENIE_MARKER__/g, 'ñ')
    // 4. Limpiar espacios múltiples
    .replace(/\s+/g, ' ')
    .trim()

  // 5. Sustituir números en palabras por dígitos (palabras completas)
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g')
    result = result.replace(regex, digit)
  }

  return result
}

// ─── Helpers de validación ────────────────────────────────────────────────────

/**
 * Devuelve true si dos cadenas son iguales tras normalizar ambas.
 * Útil para tests y para el CMS al verificar colisiones.
 */
export function normalizedEquals(a: string, b: string): boolean {
  return normalize(a) === normalize(b)
}
