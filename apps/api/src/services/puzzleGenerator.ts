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

// ─── Helpers de construcción de prompts ───────────────────────────────────────

/**
 * Construye el prompt inicial para el agente a partir de un evento de efemérides.
 */
export function buildUserPrompt(event: EphemerisEvent): string {
  let prompt = `Genera un puzle de corchetes anidados de alta dificultad lingüística para la siguiente efeméride:\n\n`
  prompt += `- Año: ${event.year}\n`
  prompt += `- Hecho histórico: ${event.text}\n`

  if (event.extract) {
    prompt += `- Contexto enciclopédico de Wikipedia: ${event.extract}\n`
  }
  if (event.wikipediaUrl) {
    prompt += `- Referencia: ${event.wikipediaUrl}\n`
  }

  prompt += `\nRecuerda aplicar al menos 2 técnicas enigmísticas (dependencia anidada, charadas morfológicas, polisemia, etc.), garantizar entre 2 y 4 niveles de profundidad y al menos 2 nodos hoja iniciales.`

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
  const {
    apiKey = config.GEMINI_API_KEY,
    modelName = config.GEMINI_MODEL,
    temperature = 0.7,
    maxAttempts = 3,
  } = options

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
