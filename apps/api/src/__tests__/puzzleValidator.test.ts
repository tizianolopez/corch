import { describe, it, expect } from 'vitest'
import {
  validatePuzzleDraft,
  type GeneratedPuzzleDraft,
} from '../services/puzzleValidator'

describe('validatePuzzleDraft (3.3 Validador determinista)', () => {
  const validDraft: GeneratedPuzzleDraft = {
    originalQuote:
      'Un día como hoy, pero en 1962, John F. Kennedy anunció el bloqueo naval a Cuba.',
    markup:
      'Un día como hoy, pero en 1962, [el presidente que enfrentó la crisis de [la isla caribeña gobernada por Fidel]] anunció el [cerco marítimo] a Cuba.',
    nodes: [
      {
        id: 'n1',
        solution: 'John F. Kennedy',
        type: 'reference',
      },
      {
        id: 'n2',
        solution: 'Cuba',
        type: 'definition',
      },
      {
        id: 'n3',
        solution: 'bloqueo naval',
        type: 'definition',
      },
    ],
    quoteAuthor: 'John F. Kennedy',
    quoteWork: 'Discurso sobre la crisis de los misiles',
    quoteYear: 1962,
    editorialNote: 'Episodio histórico decisivo de la Guerra Fría.',
  }

  it('valida con éxito un borrador bien estructurado y genera RawPuzzle', () => {
    const result = validatePuzzleDraft(validDraft)

    expect(result.valid).toBe(true)
    if (!result.valid) return

    expect(result.errors).toHaveLength(0)
    expect(result.totalNodes).toBe(3)
    expect(result.initialLeaves).toBe(2) // n2 y n3 son hojas iniciales
    expect(result.maxDepth).toBe(2) // n2 es hijo de n1

    expect(result.rawPuzzle.nodes['n1']?.children).toEqual(['n2'])
    expect(result.rawPuzzle.nodes['n2']?.parent).toBe('n1')
    expect(result.rawPuzzle.nodes['n3']?.parent).toBeNull()
    expect(result.rawPuzzle.nodes['n1']?.solution).toBe('John F. Kennedy')
  })

  it('rechaza markup con corchetes desbalanceados', () => {
    const invalid = {
      ...validDraft,
      markup: 'Un texto con corchetes [sin cerrar',
    }

    const result = validatePuzzleDraft(invalid)
    expect(result.valid).toBe(false)
    if (result.valid) return

    expect(result.errors.some((e) => e.includes('sin cerrar'))).toBe(true)
  })

  it('rechaza puzles sin anidamiento (profundidad 1)', () => {
    const flatDraft: GeneratedPuzzleDraft = {
      ...validDraft,
      markup: 'Un día con [pista uno], [pista dos] y [pista tres].',
      nodes: [
        { id: 'n1', solution: 'sol1', type: 'definition' },
        { id: 'n2', solution: 'sol2', type: 'definition' },
        { id: 'n3', solution: 'sol3', type: 'definition' },
      ],
    }

    const result = validatePuzzleDraft(flatDraft)
    expect(result.valid).toBe(false)
    if (result.valid) return

    expect(
      result.errors.some((e) => e.includes('Profundidad de anidamiento insuficiente')),
    ).toBe(true)
  })

  it('rechaza soluciones duplicadas tras normalización', () => {
    const dupDraft: GeneratedPuzzleDraft = {
      ...validDraft,
      nodes: [
        { id: 'n1', solution: 'Cuba', type: 'reference' },
        { id: 'n2', solution: 'cuba', type: 'definition' }, // Duplicada
        { id: 'n3', solution: 'bloqueo naval', type: 'definition' },
      ],
    }

    const result = validatePuzzleDraft(dupDraft)
    expect(result.valid).toBe(false)
    if (result.valid) return

    expect(
      result.errors.some((e) => e.includes('Solución duplicada detectada')),
    ).toBe(true)
  })

  it('rechaza puzles con menos de 2 hojas iniciales', () => {
    // Cadena lineal: n1 -> n2 -> n3 (solo 1 hoja: n3)
    const linearDraft: GeneratedPuzzleDraft = {
      ...validDraft,
      markup: 'Texto [nivel uno [nivel dos [nivel tres]]].',
      nodes: [
        { id: 'n1', solution: 'uno', type: 'definition' },
        { id: 'n2', solution: 'dos', type: 'definition' },
        { id: 'n3', solution: 'tres', type: 'definition' },
      ],
    }

    const result = validatePuzzleDraft(linearDraft)
    expect(result.valid).toBe(false)
    if (result.valid) return

    expect(
      result.errors.some((e) => e.includes('nodo(s) inicial(es) activo(s)')),
    ).toBe(true)
  })

  it('rechaza puzles donde falta la solución de algún nodo', () => {
    const missingNodeDraft: GeneratedPuzzleDraft = {
      ...validDraft,
      nodes: [
        { id: 'n1', solution: 'John F. Kennedy', type: 'reference' },
        // Falta n2
        { id: 'n3', solution: 'bloqueo naval', type: 'definition' },
      ],
    }

    const result = validatePuzzleDraft(missingNodeDraft)
    expect(result.valid).toBe(false)
    if (result.valid) return

    expect(
      result.errors.some((e) => e.includes("Falta la solución para el corchete con identificador 'n2'")),
    ).toBe(true)
  })
})
