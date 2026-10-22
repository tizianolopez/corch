import { describe, it, expect, vi } from 'vitest'
import {
  generatePuzzleFromEvent,
  buildUserPrompt,
  buildRetryPrompt,
  type ILlmModel,
} from '../services/puzzleGenerator'
import type { EphemerisEvent } from '../services/ephemeris'
import type { GeneratedPuzzleDraft } from '../services/puzzleValidator'

describe('puzzleGenerator (3.2 Agente Gemini & Reintentos)', () => {
  const sampleEvent: EphemerisEvent = {
    year: 1962,
    text: 'El presidente John F. Kennedy anunció el bloqueo naval a Cuba durante la Crisis de los Misiles.',
    extract:
      'La crisis de los misiles de Cuba fue un conflicto de 13 días entre Estados Unidos y la Unión Soviética.',
    wikipediaUrl: 'https://es.wikipedia.org/wiki/Crisis_de_los_misiles_de_Cuba',
  }

  const validDraft: GeneratedPuzzleDraft = {
    originalQuote:
      'Un día como hoy, pero en 1962, John F. Kennedy anunció el bloqueo naval a Cuba.',
    markup:
      'Un día como hoy, pero en 1962, [el presidente que gestionó la crisis de [la isla caribeña gobernada por Fidel]] anunció el [cerco marítimo] a Cuba.',
    nodes: [
      { id: 'n1', solution: 'John F. Kennedy', type: 'reference' },
      { id: 'n2', solution: 'Cuba', type: 'definition' },
      { id: 'n3', solution: 'bloqueo naval', type: 'definition' },
    ],
    quoteAuthor: 'John F. Kennedy',
    quoteWork: 'Discurso sobre la crisis de los misiles',
    quoteYear: 1962,
    editorialNote: 'Episodio histórico decisivo de la Guerra Fría.',
  }

  it('construye el prompt del usuario con todos los datos del evento', () => {
    const prompt = buildUserPrompt(sampleEvent)
    expect(prompt).toContain('1962')
    expect(prompt).toContain('John F. Kennedy')
    expect(prompt).toContain('Crisis de los Misiles')
    expect(prompt).toContain('https://es.wikipedia.org')
  })

  it('construye el prompt de reintento con los errores específicos', () => {
    const errors = ['Corchetes desbalanceados', 'Solución duplicada']
    const prompt = buildRetryPrompt(errors, '{"invalid": true}')
    expect(prompt).toContain('Corchetes desbalanceados')
    expect(prompt).toContain('Solución duplicada')
    expect(prompt).toContain('{"invalid": true}')
  })

  it('genera un puzle exitoso en el primer intento cuando el modelo responde válidamente', async () => {
    const mockModel: ILlmModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(validDraft),
        },
      }),
    }

    const result = await generatePuzzleFromEvent(sampleEvent, {
      model: mockModel,
      maxAttempts: 3,
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.attempts).toBe(1)
    expect(result.draft.originalQuote).toBe(validDraft.originalQuote)
    expect(result.validation.valid).toBe(true)
    expect(result.validation.rawPuzzle.nodes['n1']?.solution).toBe('John F. Kennedy')
    expect(mockModel.generateContent).toHaveBeenCalledTimes(1)
  })

  it('reintenta automáticamente cuando el primer intento falla la validación determinista', async () => {
    // Primer intento: puzle plano sin anidamiento (profundidad 1)
    const invalidFirstDraft: GeneratedPuzzleDraft = {
      ...validDraft,
      markup: 'Texto plano [uno], [dos] y [tres].',
      nodes: [
        { id: 'n1', solution: 'a', type: 'definition' },
        { id: 'n2', solution: 'b', type: 'definition' },
        { id: 'n3', solution: 'c', type: 'definition' },
      ],
    }

    const generateContentMock = vi
      .fn()
      .mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(invalidFirstDraft),
        },
      })
      .mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(validDraft),
        },
      })

    const mockModel: ILlmModel = {
      generateContent: generateContentMock,
    }

    const result = await generatePuzzleFromEvent(sampleEvent, {
      model: mockModel,
      maxAttempts: 3,
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.attempts).toBe(2)
    expect(generateContentMock).toHaveBeenCalledTimes(2)
    // El segundo prompt debe contener el mensaje de corrección de profundidad insuficiente
    const secondCallPrompt = generateContentMock.mock.calls[1][0] as string
    expect(secondCallPrompt).toContain('Profundidad de anidamiento insuficiente')
  })

  it('devuelve success: false si se agotan todos los reintentos', async () => {
    const invalidDraft: GeneratedPuzzleDraft = {
      ...validDraft,
      markup: 'Texto [sin cerrar corchete',
      nodes: [],
    }

    const mockModel: ILlmModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(invalidDraft),
        },
      }),
    }

    const result = await generatePuzzleFromEvent(sampleEvent, {
      model: mockModel,
      maxAttempts: 3,
    })

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.attempts).toBe(3)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(mockModel.generateContent).toHaveBeenCalledTimes(3)
  })

  it('lanza un error explícito si no hay API key ni modelo inyectado', async () => {
    await expect(
      generatePuzzleFromEvent(sampleEvent, {
        apiKey: undefined,
        model: undefined,
      }),
    ).rejects.toThrow('GEMINI_API_KEY no está configurada')
  })
})
