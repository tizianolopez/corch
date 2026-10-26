/**
 * @module cascadePuzzleGenerator
 *
 * Generador en cascada recursivo para Corchetes (Metodología Claudàtors).
 *
 * Flujo determinista por capas:
 *  1. Frase Literaria: Genera o recibe la cita histórica base en español noble.
 *  2. Escáner Continuo de Caracteres (Nivel 0):
 *     Indexa la frase como flujo continuo contra spanish_words.txt y selecciona
 *     las palabras/subcadenas raíz sin solapamiento (ej. 8-10 palabras).
 *  3. Generación en Lote de Pistas Padre (Nivel 1):
 *     Gemini genera pistas crípticas breves (expresiones, dobles sentidos, colocaciones)
 *     para las palabras raíz.
 *  4. Escáner Continuo sobre las Pistas Padre:
 *     Cada pista padre se indexa como flujo de caracteres para descubrir qué palabras
 *     contiene y seleccionar las palabras hijas (ej. 6-7 palabras).
 *  5. Generación en Lote de Pistas Hijo (Nivel 2):
 *     Gemini genera pistas (anagramas declarados, charadas, dobles sentidos) para las hijas.
 *  6. Recursión Opcional para Nietos (Nivel 3):
 *     Se repite sobre 2-3 pistas hijo para crear la profundidad máxima (nietos).
 *  7. Ensamblador Concéntrico Determinista:
 *     Reemplaza con corchetes en las posiciones exactas de caracteres de dentro hacia afuera.
 *     Garantía absoluta de concordancia sintáctica (0 fallos gramaticales).
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import type { ClueType } from '@corchetes/core'
import { config } from '../config'
import type { EphemerisEvent } from './ephemeris'
import {
  scanCharacterStream,
  selectNonOverlappingSpans,
  findBestChildCandidate,
  type TextSpan,
} from './characterStreamScanner'
import type { GeneratedPuzzleDraft, GeneratedNode } from './puzzleValidator'

export interface CascadeGeneratorOptions {
  apiKey?: string
  modelName?: string
  /** Total objetivo de preguntas en el árbol (default: 20 estilo Claudàtors, o 8 express) */
  targetNodes?: number
  /** Nodos raíz en la cita original (default: 10) */
  targetRoots?: number
  /** Nodos hijos dentro de pistas padre (default: 7) */
  targetChildren?: number
  /** Nodos nietos dentro de pistas hijo (default: 3) */
  targetGrandchildren?: number
}

interface BatchClueResult {
  id: string
  word: string
  clueText: string
  type: ClueType
  reasoning: string
}

// ─── Generación de la Cita Literaria ──────────────────────────────────────────

async function generateLiteraryQuote(
  event: EphemerisEvent,
  genAI: GoogleGenerativeAI,
  modelName: string,
): Promise<{ quote: string; author: string; work: string; year: number; note: string }> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: `Eres un distinguido cronista histórico y literato en español.
Tu tarea es redactar una crónica histórica literaria fluida y solemne a partir de una efeméride histórica para el juego de corchetes.

REGLAS DE ORO:
1. PROHIBIDAS muletillas mecánicas como «Un día como hoy», «En este día», «Un día como este», etc.
2. Comienza directamente con la narración histórica (por ejemplo indicando el lugar, los protagonistas o el hecho).
3. Longitud requerida: entre 140 y 170 caracteres (~22-28 palabras). Debe tener cuerpo suficiente para narrar el acontecimiento con ritmo, riqueza léxica y elegancia histórica.
4. Menciona con naturalidad el año (${event.year}), los protagonistas y el lugar o acontecimiento.
5. En 'work', pon el título temático del hito (ej. "Tratado de Paz de Aravá").
6. En 'author', pon cadena vacía "" (a menos que sea una cita textual literal de un escritor).
7. En 'note', incluye una breve reseña explicativa y rigurosa para la pantalla final de victoria.`,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          quote: { type: SchemaType.STRING },
          author: { type: SchemaType.STRING },
          work: { type: SchemaType.STRING },
          year: { type: SchemaType.INTEGER },
          note: { type: SchemaType.STRING },
        },
        required: ['quote', 'author', 'work', 'year', 'note'],
      },
    },
  })

  const prompt = `Efeméride histórica:
Año: ${event.year}
Hecho: ${event.text}
${event.extract ? `Contexto enciclopédico: ${event.extract}` : ''}

Redacta la crónica histórica literaria (140-170 caracteres) y la ficha temática.`

  const res = await model.generateContent(prompt)
  return JSON.parse(res.response.text())
}

// ─── Generación de Pistas en Lote ─────────────────────────────────────────────

async function generateClueBatch(
  words: { id: string; word: string; original: string }[],
  role: 'padre' | 'hijo' | 'nieto',
  genAI: GoogleGenerativeAI,
  modelName: string,
): Promise<Record<string, BatchClueResult>> {
  if (words.length === 0) return {}

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: `Eres un maestro creador de Claudàtors (crucigramas crípticos de alta literatura y pensamiento lateral en español).
Tu tarea es crear una pista ingeniosa para cada una de las palabras proporcionadas.

REGLAS DE ORO:
1. PROHIBIDAS DEFINICIONES DE DICCIONARIO ESCOLAR (nada de "persona que...", "acción de...", "sinónimo de...").
2. EMPLEA MECÁNICAS DE PENSAMIENTO LATERAL:
   - Expresiones o frases hechas ("Precede a...", "Acompaña a...", "Junto a...").
   - Dobles sentidos y polisemia ("Lo que estudian los que no están sentados" -> derecho).
   - Anagramas declarados con la palabra en mayúsculas ("El revuelto y caótico AMOR" -> Roma).
   - Referencias poéticas o culturales selectas ("Aquel precursor que sumergía en las aguas del Jordán" -> Bautista).
3. RESTRICCIÓN DE LONGITUD: La pista ('clueText') debe ser una frase breve (entre 5 y 12 palabras), fluida y sin puntos finales.`,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            word: { type: SchemaType.STRING },
            clueText: { type: SchemaType.STRING },
            type: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: [
                'definition',
                'anagram',
                'reference',
                'container',
                'polysemy',
                'reverse',
                'palindrome',
                'morphological',
              ],
            },
            reasoning: { type: SchemaType.STRING },
          },
          required: ['id', 'word', 'clueText', 'type', 'reasoning'],
        },
      },
    },
  })

  const prompt =
    `Genera pistas crípticas ingeniosas para las siguientes palabras (${role}):\n` +
    words
      .map(
        (w) =>
          `- ID: ${w.id} | Término: "${w.word}" (forma en el texto: "${w.original}")`,
      )
      .join('\n')

  const res = await model.generateContent(prompt)
  const items = JSON.parse(res.response.text()) as BatchClueResult[]

  const map: Record<string, BatchClueResult> = {}
  for (const item of items) {
    map[item.id] = item
  }
  return map
}

// ─── Estructuras internas del Árbol ───────────────────────────────────────────

interface TreeNodeInternal {
  id: string
  word: string
  originalText: string
  clueText: string
  type: ClueType
  reasoning: string
  parentId: string | null
  children: TreeNodeInternal[]
  spanInParent?: TextSpan
}

// ─── Función Principal de Generación en Cascada ───────────────────────────────

export async function generateCascadePuzzle(
  eventOrQuote: EphemerisEvent | string,
  options: CascadeGeneratorOptions = {},
): Promise<GeneratedPuzzleDraft> {
  const apiKey = options.apiKey || config.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('generateCascadePuzzle: GEMINI_API_KEY no está configurada.')
  }

  const modelName = options.modelName || config.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const genAI = new GoogleGenerativeAI(apiKey)

  const targetRoots = options.targetRoots ?? (options.targetNodes === 8 ? 4 : 8)
  const targetChildren = options.targetChildren ?? (options.targetNodes === 8 ? 3 : 8)
  const targetGrandchildren = options.targetGrandchildren ?? (options.targetNodes === 8 ? 1 : 4)

  // 1. Obtener la frase literaria y metadatos
  let originalQuote = ''
  let quoteAuthor = ''
  let quoteWork = 'Efeméride histórica'
  let quoteYear = 2026
  let editorialNote = ''

  console.log('   [1/6] 📜 Obteniendo crónica histórica literaria...')
  if (typeof eventOrQuote === 'string') {
    originalQuote = eventOrQuote.trim()
  } else {
    const meta = await generateLiteraryQuote(eventOrQuote, genAI, modelName)
    originalQuote = meta.quote
    quoteAuthor = meta.author || ''
    quoteWork = meta.work || `Efeméride de ${eventOrQuote.year}`
    quoteYear = meta.year || eventOrQuote.year
    editorialNote = meta.note || eventOrQuote.text
  }
  console.log(`         Crónica: «${originalQuote}»`)

  // 2. Nivel 0: Escanear la frase literaria como flujo continuo
  console.log('   [2/6] 🔍 Escaneando flujo continuo de caracteres (Nivel 0)...')
  const rootSpansAll = scanCharacterStream(originalQuote)
  const rootSpans = selectNonOverlappingSpans(rootSpansAll, targetRoots)
  console.log(`         ${rootSpans.length} palabras raíz seleccionadas: ${rootSpans.map(s => s.text).join(', ')}`)

  if (rootSpans.length === 0) {
    throw new Error('No se encontraron suficientes palabras candidatas en la frase literaria.')
  }

  const usedSolutions = new Set<string>()

  // 3. Nivel 1: Generar pistas padre para las raíces
  console.log(`   [3/6] 🤖 Generando pistas para las ${rootSpans.length} raíces con Gemini...`)
  const rootWordInputs = rootSpans.map((span, idx) => {
    usedSolutions.add(span.normalized)
    return {
      id: `r_${idx + 1}`,
      word: span.normalized,
      original: span.text,
      span,
    }
  })

  const rootCluesMap = await generateClueBatch(
    rootWordInputs.map((r) => ({ id: r.id, word: r.word, original: r.original })),
    'padre',
    genAI,
    modelName,
  )

  const rootNodes: TreeNodeInternal[] = rootWordInputs.map((r) => {
    const clue = rootCluesMap[r.id]
    return {
      id: r.id,
      word: r.word,
      originalText: r.original,
      clueText: clue?.clueText || `Término que alude a ${r.original}`,
      type: clue?.type || 'definition',
      reasoning: clue?.reasoning || 'Pista raíz directa',
      parentId: null,
      children: [],
      spanInParent: r.span,
    }
  })

  // 4. Nivel 2: Escanear textos de las pistas padre para extraer los hijos
  console.log('   [4/6] 🔍 Escaneando textos de pistas padre para extraer términos hijos...')
  const childInputs: {
    id: string
    word: string
    original: string
    parentNode: TreeNodeInternal
    span: TextSpan
  }[] = []

  let childIdx = 1
  for (const parentNode of rootNodes) {
    if (childInputs.length >= targetChildren) break

    const childSpan = findBestChildCandidate(parentNode.clueText, usedSolutions)
    if (childSpan) {
      usedSolutions.add(childSpan.normalized)
      childInputs.push({
        id: `c_${childIdx++}`,
        word: childSpan.normalized,
        original: childSpan.text,
        parentNode,
        span: childSpan,
      })
    }
  }

  // Segunda pasada si aún hay cupo para hijos
  if (childInputs.length < targetChildren) {
    for (const parentNode of rootNodes) {
      if (childInputs.length >= targetChildren) break
      const existingSpans = childInputs
        .filter((c) => c.parentNode === parentNode)
        .map((c) => c.span)
      const allSpans = scanCharacterStream(parentNode.clueText, { minLength: 3, maxLength: 8 })
        .filter((s) => !usedSolutions.has(s.normalized))
        .filter((s) => !existingSpans.some((ex) => !(s.end <= ex.start || s.start >= ex.end)))
        .sort((a, b) => b.score - a.score || b.length - a.length)

      if (allSpans.length > 0 && allSpans[0]) {
        const span = allSpans[0]
        usedSolutions.add(span.normalized)
        childInputs.push({
          id: `c_${childIdx++}`,
          word: span.normalized,
          original: span.text,
          parentNode,
          span,
        })
      }
    }
  }
  console.log(`         ${childInputs.length} hijos detectados: ${childInputs.map(c => c.original).join(', ')}`)

  // 5. Generar pistas para los hijos
  console.log(`   [5/6] 🤖 Generando pistas para los ${childInputs.length} hijos con Gemini...`)
  const childCluesMap = await generateClueBatch(
    childInputs.map((c) => ({ id: c.id, word: c.word, original: c.original })),
    'hijo',
    genAI,
    modelName,
  )

  const childNodes: TreeNodeInternal[] = childInputs.map((c) => {
    const clue = childCluesMap[c.id]
    const childNode: TreeNodeInternal = {
      id: c.id,
      word: c.word,
      originalText: c.original,
      clueText: clue?.clueText || `Acertijo para ${c.original}`,
      type: clue?.type || 'definition',
      reasoning: clue?.reasoning || 'Pista hija concéntrica',
      parentId: c.parentNode.id,
      children: [],
      spanInParent: c.span,
    }
    c.parentNode.children.push(childNode)
    return childNode
  })

  // 6. Nivel 3: Escanear pistas de hijos para extraer 2-3 nietos si corresponde
  if (targetGrandchildren > 0 && childNodes.length > 0) {
    console.log('   [6/6] 🔍 Escaneando pistas de hijos para extraer nietos (Nivel 3)...')
    const grandchildInputs: {
      id: string
      word: string
      original: string
      parentNode: TreeNodeInternal
      span: TextSpan
    }[] = []

    let grandIdx = 1
    for (const childNode of childNodes) {
      if (grandchildInputs.length >= targetGrandchildren) break

      const grandSpan = findBestChildCandidate(childNode.clueText, usedSolutions)
      if (grandSpan) {
        usedSolutions.add(grandSpan.normalized)
        grandchildInputs.push({
          id: `g_${grandIdx++}`,
          word: grandSpan.normalized,
          original: grandSpan.text,
          parentNode: childNode,
          span: grandSpan,
        })
      }
    }
    console.log(`         ${grandchildInputs.length} nietos detectados: ${grandchildInputs.map(g => g.original).join(', ')}`)

    if (grandchildInputs.length > 0) {
      console.log(`         🤖 Generando pistas para los ${grandchildInputs.length} nietos con Gemini...`)
      const grandCluesMap = await generateClueBatch(
        grandchildInputs.map((g) => ({ id: g.id, word: g.word, original: g.original })),
        'nieto',
        genAI,
        modelName,
      )

      for (const g of grandchildInputs) {
        const clue = grandCluesMap[g.id]
        const grandNode: TreeNodeInternal = {
          id: g.id,
          word: g.word,
          originalText: g.original,
          clueText: clue?.clueText || `Acertijo para ${g.original}`,
          type: clue?.type || 'anagram',
          reasoning: clue?.reasoning || 'Pista nieta hoja',
          parentId: g.parentNode.id,
          children: [],
          spanInParent: g.span,
        }
        g.parentNode.children.push(grandNode)
      }
    }
  }

  // 7. Ensamblado Concéntrico Determinista en Corchetes
  console.log('   ✨ Ensamblando marcado concéntrico determinista...')
  let globalNodeCounter = 1
  const finalNodes: GeneratedNode[] = []

  function processNode(node: TreeNodeInternal): string {
    const currentId = `n${globalNodeCounter++}`
    node.id = currentId

    finalNodes.push({
      id: currentId,
      solution: node.originalText,
      type: node.type,
      reasoning: node.reasoning,
    })

    if (node.children.length === 0) {
      return `[${node.clueText}]`
    }

    // Ordenar hijos de izquierda a derecha (ascendente) para procesar en orden de lectura
    const childrenAsc = [...node.children].sort(
      (a, b) => (a.spanInParent?.start || 0) - (b.spanInParent?.start || 0),
    )

    // Generar el markup de cada hijo recursivamente en orden de lectura
    const childMarkups = new Map<TreeNodeInternal, string>()
    for (const child of childrenAsc) {
      childMarkups.set(child, processNode(child))
    }

    // Reemplazar en clueText de derecha a izquierda (descendente) para no desfasar índices de caracteres
    const childrenDesc = [...node.children].sort(
      (a, b) => (b.spanInParent?.start || 0) - (a.spanInParent?.start || 0),
    )

    let composedClue = node.clueText
    for (const child of childrenDesc) {
      if (!child.spanInParent) continue
      const markup = childMarkups.get(child) || `[${child.clueText}]`
      composedClue =
        composedClue.slice(0, child.spanInParent.start) +
        markup +
        composedClue.slice(child.spanInParent.end)
    }

    return `[${composedClue}]`
  }

  // Procesar raíces en orden ascendente (de izquierda a derecha en la frase)
  const rootsAsc = [...rootNodes].sort(
    (a, b) => (a.spanInParent?.start || 0) - (b.spanInParent?.start || 0),
  )

  const rootMarkups = new Map<TreeNodeInternal, string>()
  for (const root of rootsAsc) {
    rootMarkups.set(root, processNode(root))
  }

  // Reemplazar en originalQuote en orden descendente para no desfasar índices
  const rootsDesc = [...rootNodes].sort(
    (a, b) => (b.spanInParent?.start || 0) - (a.spanInParent?.start || 0),
  )

  let finalMarkup = originalQuote
  for (const root of rootsDesc) {
    if (!root.spanInParent) continue
    const markupSnippet = rootMarkups.get(root) || `[${root.clueText}]`
    finalMarkup =
      finalMarkup.slice(0, root.spanInParent.start) +
      markupSnippet +
      finalMarkup.slice(root.spanInParent.end)
  }

  return {
    originalQuote,
    markup: finalMarkup,
    nodes: finalNodes,
    quoteAuthor,
    quoteWork,
    quoteYear,
    editorialNote,
  }
}
