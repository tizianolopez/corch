/**
 * @module characterStreamScanner
 *
 * Escáner de caracteres continuo para Corchetes (estilo Claudàtors).
 *
 * Analiza un texto completo (frase de efeméride o texto de una pista)
 * tratándolo como un flujo continuo de caracteres para descubrir todas
 * las palabras y subcadenas posibles que existen en el diccionario español.
 *
 * Permite encontrar:
 *  - Palabras completas del texto (ej. «paz», «mano», «sellar»).
 *  - Palabras telescópicas/ocultas dentro de otras (ej. «venta» en «noventa», «cien» en «novecientos»).
 *  - Palabras que cruzan espacios entre términos contiguos.
 */

import * as fs from 'fs'
import * as path from 'path'
import { stripAccentsPreservingEnhe } from './windowScanner'

export interface TextSpan {
  /** Posición de inicio en la cadena original (inclusive) */
  start: number
  /** Posición de fin en la cadena original (exclusive) */
  end: number
  /** Texto literal recortado de la cadena original */
  text: string
  /** Término normalizado (minúsculas sin tilde) para evaluación en diccionario */
  normalized: string
  /** Si coincide exactamente con límites de palabra completa en el texto */
  isExactWord: boolean
  /** Longitud en caracteres */
  length: number
  /** Puntuación de idoneidad enigmística */
  score: number
}

// ─── Diccionario en Memoria ──────────────────────────────────────────────────

class StreamDictionary {
  public normalizedSet = new Set<string>()
  private loaded = false

  public load(): void {
    if (this.loaded) return

    const possiblePaths = [
      path.resolve(process.cwd(), 'data', 'spanish_words.txt'),
      path.resolve(process.cwd(), '..', '..', 'data', 'spanish_words.txt'),
      path.resolve(__dirname, '..', '..', '..', '..', 'data', 'spanish_words.txt'),
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8')
        const lines = content.split(/\r?\n/)
        for (const line of lines) {
          const w = line.trim()
          if (w.length >= 2) {
            this.normalizedSet.add(stripAccentsPreservingEnhe(w))
          }
        }
        this.loaded = true
        return
      }
    }

    // Fallback mínimo si no se encuentra el archivo
    const fallback = [
      'paz', 'amor', 'roma', 'mano', 'sellar', 'pacto', 'tratado', 'estados',
      'naciones', 'guerra', 'vida', 'tierra', 'tarde', 'camino', 'fuego',
      'cielo', 'tiempo', 'siglo', 'mundo', 'casa', 'agua', 'sol', 'oro'
    ]
    for (const w of fallback) {
      this.normalizedSet.add(stripAccentsPreservingEnhe(w))
    }
    this.loaded = true
  }

  public has(word: string): boolean {
    if (!this.loaded) this.load()
    return this.normalizedSet.has(word)
  }
}

export const streamDictionary = new StreamDictionary()

// Palabras funcionales gramaticales que desaconsejamos como corchetes principales
const STOPWORDS = new Set([
  'del', 'los', 'las', 'les', 'por', 'con', 'para', 'pero', 'como', 'este',
  'esta', 'unos', 'unas', 'hacia', 'desde', 'sobre', 'entre', 'ante', 'bajo',
  'tras', 'cada', 'todo', 'toda', 'otro', 'otra', 'cual', 'quien', 'donde'
])

// ─── Funciones del escáner continuo ──────────────────────────────────────────

export interface ScanOptions {
  minLength?: number
  maxLength?: number
  allowSubwords?: boolean
}

/**
 * Escanea un texto recorriendo todas las subcadenas de caracteres posibles
 * y devuelve todas las coincidencias con palabras válidas del diccionario.
 */
export function scanCharacterStream(
  text: string,
  options: ScanOptions = {},
): TextSpan[] {
  const minLength = options.minLength ?? 3
  const maxLength = options.maxLength ?? 12
  const spans: TextSpan[] = []

  const len = text.length

  for (let i = 0; i < len; i++) {
    const char = text[i]
    // Si el caracter inicial no es una letra alfabética, saltar
    if (!char || !/[a-záéíóúüñÁÉÍÓÚÜÑ]/i.test(char)) continue

    for (let l = minLength; l <= maxLength && i + l <= len; l++) {
      const rawSlice = text.slice(i, i + l)

      // Solo consideramos subcadenas formadas estrictamente por letras
      if (!/^[a-záéíóúüñÁÉÍÓÚÜÑ]+$/i.test(rawSlice)) continue

      const normalized = stripAccentsPreservingEnhe(rawSlice)

      if (streamDictionary.has(normalized)) {
        const prevChar = i > 0 ? text[i - 1] : undefined
        const nextChar = i + l < len ? text[i + l] : undefined
        const isLeftBoundary = i === 0 || !prevChar || !/[a-záéíóúüñÁÉÍÓÚÜÑ]/i.test(prevChar)
        const isRightBoundary = i + l === len || !nextChar || !/[a-záéíóúüñÁÉÍÓÚÜÑ]/i.test(nextChar)
        const isExactWord = isLeftBoundary && isRightBoundary

        // Puntuación de calidad:
        // - Favorecer palabras completas frente a subpalabras
        // - Penalizar palabras muy cortas (3 letras) y stopwords
        // - Premiar palabras de 4 a 7 letras
        let score = isExactWord ? 10 : 5
        score += Math.min(l, 7)

        if (STOPWORDS.has(normalized)) {
          score -= 9
        }
        if (l < 4) {
          score -= 3
        }

        spans.push({
          start: i,
          end: i + l,
          text: rawSlice,
          normalized,
          isExactWord,
          length: l,
          score,
        })
      }
    }
  }

  return spans
}

/**
 * Selecciona una cantidad N de tramos (spans) sin solapamiento entre sí,
 * garantizando que cubran el texto de forma distribuida.
 */
export function selectNonOverlappingSpans(
  spans: TextSpan[],
  count: number,
): TextSpan[] {
  if (spans.length === 0) return []

  // Ordenar primero por puntuación descendente y longitud
  const sorted = [...spans].sort((a, b) => b.score - a.score || b.length - a.length)

  const selected: TextSpan[] = []

  for (const candidate of sorted) {
    // Comprobar si solapa con alguno ya elegido
    const overlaps = selected.some(
      (sel) => !(candidate.end <= sel.start || candidate.start >= sel.end),
    )

    if (!overlaps) {
      selected.push(candidate)
      if (selected.length >= count) {
        break
      }
    }
  }

  // Devolver ordenados cronológicamente por posición en la frase original
  return selected.sort((a, b) => a.start - b.start)
}

/**
 * Encuentra el mejor candidato dentro de un texto breve (por ejemplo, el texto de una pista)
 * para convertirlo en corchete hijo.
 */
export function findBestChildCandidate(
  clueText: string,
  forbiddenWords: Set<string> = new Set(),
): TextSpan | null {
  const spans = scanCharacterStream(clueText, { minLength: 3, maxLength: 8 })

  // Filtrar palabras prohibidas (para evitar duplicar soluciones en el puzle)
  const valid = spans.filter((s) => !forbiddenWords.has(s.normalized))

  if (valid.length === 0) return null

  // Priorizar palabras de 4-6 letras exactas
  valid.sort((a, b) => b.score - a.score || b.length - a.length)
  return valid[0] ?? null
}
