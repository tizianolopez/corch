/**
 * @module puzzleGenerator
 *
 * Servicio de generación de puzles automáticos utilizando la API de Google Gemini
 * con Structured Outputs (JSON Schema estricto).
 *
 * Implementa:
 *  - System prompt con técnicas de enigmística y claudàtor
 *  - ResponseSchema formal de @google/generative-ai
 *  - Bucle de reintentos determinista (hasta 3 intentos): si el borrador falla
 *    la validación de puzzleValidator, se retroalimenta el error específico al modelo.
 *
 * Fuente de verdad: docs/tasks.md §3.2
 */

import { GoogleGenerativeAI, type ResponseSchema } from '@google/generative-ai'
import { config } from '../config'
import type { EphemerisEvent } from './ephemeris'
import {
  PUZZLE_GENERATOR_SYSTEM_PROMPT,
  PUZZLE_RESPONSE_SCHEMA,
} from './puzzleGeneratorPrompt'
import {
  validatePuzzleDraft,
  type GeneratedPuzzleDraft,
  type ValidationSuccess,
} from './puzzleValidator'

// ─── Tipos e interfaces ───────────────────────────────────────────────────────

/** Interfaz mínima de cliente LLM para permitir inyección y tests unitarios sin red */
export interface ILlmModel {
  generateContent(prompt: string): Promise<{
    response: {
      text(): string
    }
  }>
}

export interface PuzzleGeneratorOptions {
  /** Cliente o modelo inyectable (para tests unitarios) */
  model?: ILlmModel
  /** Clave API de Gemini (usa config.GEMINI_API_KEY por defecto) */
  apiKey?: string
  /** Nombre del modelo Gemini (usa config.GEMINI_MODEL por defecto) */
  modelName?: string
  /** Temperatura de muestreo (default: 0.7 para balancear creatividad y fidelidad de esquema) */
  temperature?: number
  /** Máximo de intentos en caso de error de validación (default: 3) */
  maxAttempts?: number
}

export interface GenerationSuccessResult {
  success: true
  draft: GeneratedPuzzleDraft
  validation: ValidationSuccess
  attempts: number
}

export interface GenerationFailureResult {
  success: false
  errors: string[]
  attempts: number
  lastRawResponse?: string
}

export type GenerationResult = GenerationSuccessResult | GenerationFailureResult

import * as fs from 'fs'
import * as path from 'path'
import { scanSentence } from './windowScanner'

// ─── Helpers de construcción de prompts ───────────────────────────────────────

/**
 * Construye el prompt inicial para el agente a partir de un evento de efemérides,
 * enriquecido con las oportunidades de la ventana deslizante y Few-Shot de Claudàtors.
 */
export function buildUserPrompt(event: EphemerisEvent): string {
  let prompt = `Genera un puzle de corchetes concéntricos anidados («claudàtors») de alta dificultad lingüística para la siguiente efeméride:\n\n`
  prompt += `- Año: ${event.year}\n`
  prompt += `- Hecho histórico: ${event.text}\n`

  if (event.extract) {
    prompt += `- Contexto enciclopédico de Wikipedia: ${event.extract}\n`
  }
  if (event.wikipediaUrl) {
    prompt += `- Referencia: ${event.wikipediaUrl}\n`
  }

  prompt += `\nINSTRUCCIÓN EDITORIAL:
1. Toma este hecho como semilla histórica y redacta una frase fluida, noble y literaria («originalQuote») que comience con «Un día como hoy, pero en ${event.year}...». Si la descripción original es escueta, expándela con elegancia.
2. Transforma entre 3 y 5 términos de esa frase en corchetes anidados («markup») de dentro hacia afuera.
3. Prohibido usar definiciones escolares directas (nada de «país de...», «sinónimo de...», «persona que...»). Emplea pensamiento lateral, juegos morfológicos, dobles sentidos o dependencias reales.
`

  // 1. Escaneo complementario de ventana deslizante como sugerencias opcionales
  const fullTextToScan = `${event.text} ${event.extract || ''}`
  try {
    const scanResult = scanSentence(fullTextToScan)
    if (scanResult.totalOpportunities > 0) {
      prompt += `\n--- SUGERENCIAS LINGÜÍSTICAS (OPCIONALES) ---
Si alguna de estas palabras descubiertas por el análisis morfológico encaja de manera natural en tu redacción, puedes aprovecharla para crear pistas de telescopio o anagrama:
`
      if (scanResult.telescopes.length > 0) {
        for (const item of scanResult.telescopes.slice(0, 3)) {
          prompt += `• Inclusión: '${item.hiddenWord}' dentro de '${item.parentWord}'\n`
        }
      }
      if (scanResult.anagrams.length > 0) {
        for (const item of scanResult.anagrams.slice(0, 3)) {
          prompt += `• Anagrama: '${item.sourceWord}' ↔ '${item.anagramWord}'\n`
        }
      }
    }
  } catch {
    // Si no se puede escanear, continuar con prompt estándar
  }

  // 2. Ejemplos maestros Few-Shot en español
  prompt += `\n--- EJEMPLOS DE PISTAS MAESTRAS EN ESPAÑOL (FEW-SHOT LEARNING) ---
Aprende del ingenio críptico y el tono de Claudàtors:
- Anagrama declarado con caos: "El caótico y revuelto AMOR" -> Roma (indicador: caótico/revuelto)
- Inclusión / Ocultamiento: "La diabética siempre reflexiona sobre la moral" -> ética (diab-ÉTICA)
- Charada morfológica: "[Astro rey][pieza de seis caras del parchís]" -> sol + dado = soldado
- Polisemia / Doble sentido: "Lo que estudian los que no están sentados" -> derecho
- Dependencia concéntrica: "[El mandatario que ordenó el cerco naval a [la isla gobernada por Fidel]]" -> hoja: Cuba, padre: Kennedy

REQUISITOS ESTRUCTURALES ESTRICTOS:
- Exactamente entre 3 y 5 corchetes en total (n1 a n3, n4 o n5).
- Entre 2 y 3 niveles de profundidad concéntrica.
- Al menos 2 nodos hoja iniciales independientes.
- Soluciones únicas (sin duplicados tras normalizar, preservando la 'ñ').
- La lista 'nodes' debe tener una entrada correlativa ("n1", "n2", ...) para cada corchete '[' abierto.`

  return prompt
}

/**
 * Construye el prompt de corrección cuando un borrador falla la validación determinista.
 */
export function buildRetryPrompt(
  errors: string[],
  previousDraftJson: string,
): string {
  return `Tu respuesta anterior no superó el validador estructural de Corchetes por los siguientes motivos:\n${errors
    .map((e) => `  - ${e}`)
    .join('\n')}\n\nRespuesta anterior con errores:\n${previousDraftJson}\n\nPor favor, corrige estos fallos respetando estrictamente las reglas sintácticas y el JSON Schema.`
}

// ─── Factoría de modelo Gemini real ───────────────────────────────────────────

function createGeminiModel(
  apiKey: string,
  modelName: string,
  temperature: number,
  schema: ResponseSchema,
): ILlmModel {
  const genAI = new GoogleGenerativeAI(apiKey)
  const generativeModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: PUZZLE_GENERATOR_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature,
    },
  })

  return {
    async generateContent(prompt: string) {
      return generativeModel.generateContent(prompt)
    },
  }
}

// ─── Función principal de generación ──────────────────────────────────────────

/**
 * Genera un puzle validado a partir de un evento de efemérides.
 * Si el primer intento no es válido, reenvía los errores al modelo hasta `maxAttempts` veces.
 *
 * @param event Evento histórico obtenido de la API de efemérides
 * @param options Opciones de modelo, API key, reintentos y mocks
 */
export async function generatePuzzleFromEvent(
  event: EphemerisEvent,
  options: PuzzleGeneratorOptions = {},
): Promise<GenerationResult> {
  const apiKey =
    'apiKey' in options ? options.apiKey : config.GEMINI_API_KEY
  const modelName = options.modelName ?? config.GEMINI_MODEL
  const temperature = options.temperature ?? 0.7
  const maxAttempts = options.maxAttempts ?? 3

  // Si no se pasa un modelo inyectado, inicializar el modelo real de Gemini
  let model = options.model
  if (!model) {
    if (!apiKey) {
      throw new Error(
        'generatePuzzleFromEvent: GEMINI_API_KEY no está configurada ni se proporcionó un modelo inyectable.',
      )
    }
    model = createGeminiModel(
      apiKey,
      modelName,
      temperature,
      PUZZLE_RESPONSE_SCHEMA,
    )
  }

  let prompt = buildUserPrompt(event)
  let lastRawResponse = ''
  let lastErrors: string[] = []

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const responseResult = await model.generateContent(prompt)
    const rawText = responseResult.response.text()
    lastRawResponse = rawText

    let draft: GeneratedPuzzleDraft
    try {
      draft = JSON.parse(rawText) as GeneratedPuzzleDraft
    } catch (parseError) {
      const msg =
        parseError instanceof Error ? parseError.message : String(parseError)
      lastErrors = [`Error al parsear JSON devuelto por Gemini: ${msg}`]
      prompt = buildRetryPrompt(lastErrors, rawText)
      continue
    }

    // Validación determinista del borrador
    const validation = validatePuzzleDraft(draft)

    if (validation.valid) {
      return {
        success: true,
        draft,
        validation,
        attempts: attempt,
      }
    }

    // Si falló la validación, retroalimentar los errores específicos
    lastErrors = validation.errors
    prompt = buildRetryPrompt(lastErrors, JSON.stringify(draft, null, 2))
  }

  return {
    success: false,
    errors: lastErrors,
    attempts: maxAttempts,
    lastRawResponse,
  }
}
