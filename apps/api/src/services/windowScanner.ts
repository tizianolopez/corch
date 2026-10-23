/**
 * @module windowScanner
 *
 * Motor de Ventana Deslizante (Window Scanner) para Enigmas Crípticos de Corchetes.
 * Analiza frases en español para detectar oportunidades enigmísticas mediante fuerza bruta:
 * 1. Cruces entre palabras (Cross-boundary words que cruzan espacios).
 * 2. Palabras telescópicas / Inclusiones (Palabras dentro de palabras).
 * 3. Charadas morfológicas (Partición de una palabra en dos términos válidos).
 * 4. Anagramas válidos (Reordenación exacta de letras en otra palabra del diccionario).
 *
 * Fuente de verdad: Documento de Arquitectura y Flujo de Datos "Motor Un día como hoy"
 */

import * as fs from 'fs'
import * as path from 'path'

export interface CrossBoundaryOpportunity {
  type: 'cruce_espacio'
  hiddenWord: string
  leftWord: string
  rightWord: string
  context: string
  length: number
  explanation: string
}

export interface TelescopeOpportunity {
  type: 'palabra_telescopica'
  hiddenWord: string
  parentWord: string
  context: string
  length: number
  explanation: string
}

export interface CharadeOpportunity {
  type: 'charada_morfologica'
  compoundWord: string
  part1: string
  part2: string
  context: string
  length: number
  explanation: string
}

export interface AnagramOpportunity {
  type: 'anagrama'
  sourceWord: string
  anagramWord: string
  context: string
  length: number
  explanation: string
}

export interface CrypticScanResult {
  sentence: string
  totalOpportunities: number
  crossBoundaries: CrossBoundaryOpportunity[]
  telescopes: TelescopeOpportunity[]
  charades: CharadeOpportunity[]
  anagrams: AnagramOpportunity[]
}

// ─── Normalización con preservación de Ñ ──────────────────────────────────────

export function stripAccentsPreservingEnhe(text: string): string {
  const safe = text.replace(/ñ/g, '###ENE_MIN###').replace(/Ñ/g, '###ENE_MAY###')
  const unaccented = safe.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return unaccented.replace(/###ENE_MIN###/g, 'ñ').replace(/###ENE_MAY###/g, 'ñ').toLowerCase()
}

// ─── Lexicón en Memoria Singleton ────────────────────────────────────────────

class SpanishLexicon {
  public words = new Set<string>()
  public normalizedWords = new Set<string>()
  public normToOriginal = new Map<string, string[]>()
  public anagramMap = new Map<string, string[]>()
  private loaded = false

  public load(customPath?: string): void {
    if (this.loaded) return

    const possiblePaths = [
      customPath,
      path.resolve(process.cwd(), 'data', 'spanish_words.txt'),
      path.resolve(process.cwd(), '..', '..', 'data', 'spanish_words.txt'),
      path.resolve(__dirname, '..', '..', '..', '..', 'data', 'spanish_words.txt'),
    ].filter(Boolean) as string[]

    let dictPath: string | null = null
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        dictPath = p
        break
      }
    }

    if (!dictPath) {
      // Fallback básico si no se encuentra el archivo físico
      const fallbackList = [
        'amor', 'roma', 'moho', 'como', 'hoy', 'sol', 'dado', 'soldado',
        'cuba', 'bloqueo', 'naval', 'ona', 'eon', 'quijote', 'mancha',
        'molinos', 'ida', 'dia', 'peor', 'pero', 'etica', 'diabetica',
        'caminante', 'camino', 'andar', 'gol', 'santiago', 'lento',
      ]
      this.populateFromList(fallbackList)
      this.loaded = true
      return
    }

    const content = fs.readFileSync(dictPath, 'utf-8')
    const lines = content.split(/\r?\n/)
    this.populateFromList(lines)
    this.loaded = true
  }

  private populateFromList(lines: string[]): void {
    for (const line of lines) {
      const w = line.trim().toLowerCase()
      if (w.length < 3) continue
      this.words.add(w)

      const norm = stripAccentsPreservingEnhe(w)
      this.normalizedWords.add(norm)

      const existingNorm = this.normToOriginal.get(norm) ?? []
      existingNorm.push(w)
      this.normToOriginal.set(norm, existingNorm)

      const sortedKey = norm.split('').sort().join('')
      const existingAnagrams = this.anagramMap.get(sortedKey) ?? []
      existingAnagrams.push(w)
      this.anagramMap.set(sortedKey, existingAnagrams)
    }
  }
}

const lexiconInstance = new SpanishLexicon()

export function getLexicon(customPath?: string): SpanishLexicon {
  lexiconInstance.load(customPath)
  return lexiconInstance
}

// ─── Escáneres de Oportunidades ───────────────────────────────────────────────

function cleanTokens(sentence: string): string[] {
  const matches = sentence.match(/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+/g)
  return matches ? matches.map((t) => t.toLowerCase()) : []
}

export function findCrossBoundaries(
  sentence: string,
  lexicon: SpanishLexicon,
  minLen = 3,
  maxLen = 7,
): CrossBoundaryOpportunity[] {
  const tokens = cleanTokens(sentence)
  const results: CrossBoundaryOpportunity[] = []

  for (let i = 0; i < tokens.length - 1; i++) {
    const w1 = tokens[i]!
    const w2 = tokens[i + 1]!
    const norm1 = stripAccentsPreservingEnhe(w1)
    const norm2 = stripAccentsPreservingEnhe(w2)

    for (let takeLeft = 1; takeLeft < norm1.length; takeLeft++) {
      const leftPart = norm1.slice(-takeLeft)
      for (let takeRight = 1; takeRight <= norm2.length; takeRight++) {
        const totalLen = takeLeft + takeRight
        if (totalLen >= minLen && totalLen <= maxLen) {
          const candidate = leftPart + norm2.slice(0, takeRight)
          if (lexicon.normalizedWords.has(candidate)) {
            const realWord = lexicon.normToOriginal.get(candidate)?.[0] ?? candidate
            results.push({
              type: 'cruce_espacio',
              hiddenWord: realWord,
              leftWord: w1,
              rightWord: w2,
              context: `...${w1} ${w2}...`,
              length: candidate.length,
              explanation: `El cruce entre '${w1}' y '${w2}' oculta la palabra '${realWord}'`,
            })
          }
        }
      }
    }
  }

  return results
}

export function findTelescopes(
  sentence: string,
  lexicon: SpanishLexicon,
  minLen = 3,
  maxLen = 7,
): TelescopeOpportunity[] {
  const tokens = cleanTokens(sentence)
  const results: TelescopeOpportunity[] = []
  const seen = new Set<string>()

  for (const word of tokens) {
    const norm = stripAccentsPreservingEnhe(word)
    if (norm.length <= minLen) continue

    for (let len = minLen; len <= Math.min(norm.length - 1, maxLen); len++) {
      for (let start = 0; start <= norm.length - len; start++) {
        const sub = norm.slice(start, start + len)
        if (sub === norm) continue

        if (lexicon.normalizedWords.has(sub)) {
          const realWord = lexicon.normToOriginal.get(sub)?.[0] ?? sub
          const key = `${realWord}:${word}`
          if (!seen.has(key) && realWord !== word) {
            seen.add(key)
            results.push({
              type: 'palabra_telescopica',
              hiddenWord: realWord,
              parentWord: word,
              context: `...${word}...`,
              length: realWord.length,
              explanation: `La palabra '${word}' contiene escondida en su interior la palabra '${realWord}'`,
            })
          }
        }
      }
    }
  }

  return results
}

export function findCharades(
  sentence: string,
  lexicon: SpanishLexicon,
): CharadeOpportunity[] {
  const tokens = cleanTokens(sentence)
  const results: CharadeOpportunity[] = []
  const seen = new Set<string>()

  for (const word of tokens) {
    const norm = stripAccentsPreservingEnhe(word)
    if (norm.length < 5) continue

    for (let splitIdx = 2; splitIdx < norm.length - 1; splitIdx++) {
      const left = norm.slice(0, splitIdx)
      const right = norm.slice(splitIdx)

      if (lexicon.normalizedWords.has(left) && lexicon.normalizedWords.has(right)) {
        const leftReal = lexicon.normToOriginal.get(left)?.[0] ?? left
        const rightReal = lexicon.normToOriginal.get(right)?.[0] ?? right
        const key = `${word}:${leftReal}:${rightReal}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({
            type: 'charada_morfologica',
            compoundWord: word,
            part1: leftReal,
            part2: rightReal,
            context: `...${word}...`,
            length: word.length,
            explanation: `'${word}' se compone de '${leftReal}' + '${rightReal}'`,
          })
        }
      }
    }
  }

  return results
}

export function findAnagrams(
  sentence: string,
  lexicon: SpanishLexicon,
): AnagramOpportunity[] {
  const tokens = cleanTokens(sentence)
  const results: AnagramOpportunity[] = []
  const seen = new Set<string>()

  for (const word of tokens) {
    const norm = stripAccentsPreservingEnhe(word)
    if (norm.length < 3 || norm.length > 7) continue

    const sortedKey = norm.split('').sort().join('')
    const matches = lexicon.anagramMap.get(sortedKey) ?? []

    for (const match of matches) {
      if (stripAccentsPreservingEnhe(match) !== norm) {
        const pairKey = [word, match].sort().join(':')
        if (!seen.has(pairKey)) {
          seen.add(pairKey)
          results.push({
            type: 'anagrama',
            sourceWord: word,
            anagramWord: match,
            context: `...${word}...`,
            length: word.length,
            explanation: `'${word}' es un anagrama exacto de '${match}'`,
          })
        }
      }
    }
  }

  return results
}

export function scanSentence(sentence: string, customPath?: string): CrypticScanResult {
  const lexicon = getLexicon(customPath)

  const crossBoundaries = findCrossBoundaries(sentence, lexicon)
  const telescopes = findTelescopes(sentence, lexicon)
  const charades = findCharades(sentence, lexicon)
  const anagrams = findAnagrams(sentence, lexicon)

  const total =
    crossBoundaries.length + telescopes.length + charades.length + anagrams.length

  return {
    sentence,
    totalOpportunities: total,
    crossBoundaries: crossBoundaries.slice(0, 10),
    telescopes: telescopes.slice(0, 10),
    charades: charades.slice(0, 10),
    anagrams: anagrams.slice(0, 10),
  }
}
