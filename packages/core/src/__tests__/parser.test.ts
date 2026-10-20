/**
 * Tests del parser de Corchetes.
 * Verifica: casos simples, anidamiento múltiple, corchetes no balanceados,
 * initPuzzleState, getActiveNodes y recalculateActiveNodes.
 */

import { describe, it, expect } from 'vitest'
import {
  parsePuzzleMarkup,
  initPuzzleState,
  getActiveNodes,
  recalculateActiveNodes,
  resolveNode,
  isPuzzleComplete,
} from '../parser.js'
import type { ClientPayload } from '../types.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Genera un ClientPayload mínimo para tests */
function makePayload(
  rootTemplate: string,
  nodes: ClientPayload['nodes'],
): ClientPayload {
  return {
    puzzleId: 'test-puzzle',
    editionNumber: 1,
    publishDate: '2026-10-20',
    rootTemplate,
    nodes,
    dailySalt: 'test-salt',
    quoteAuthor: 'Autor Test',
    quoteWork: 'Obra Test',
    quoteYear: 2026,
    editorialNote: 'Nota editorial de prueba.',
  }
}

// ─── Tests del parser ─────────────────────────────────────────────────────────

describe('parsePuzzleMarkup', () => {
  it('markup sin corchetes devuelve solo rootTemplate y nodes vacío', () => {
    const result = parsePuzzleMarkup('Texto sin corchetes')
    expect(result.rootTemplate).toBe('Texto sin corchetes')
    expect(Object.keys(result.nodes)).toHaveLength(0)
  })

  it('un único corchete de nivel 0', () => {
    const result = parsePuzzleMarkup('El [río famoso] es largo')
    expect(result.rootTemplate).toBe('El {{n1}} es largo')
    expect(result.nodes['n1']).toBeDefined()
    expect(result.nodes['n1']?.clueText).toBe('río famoso')
    expect(result.nodes['n1']?.children).toHaveLength(0)
    expect(result.nodes['n1']?.parent).toBeNull()
  })

  it('dos corchetes de nivel 0 independientes', () => {
    const result = parsePuzzleMarkup('[uno] y [dos]')
    expect(result.rootTemplate).toBe('{{n1}} y {{n2}}')
    expect(result.nodes['n1']?.clueText).toBe('uno')
    expect(result.nodes['n2']?.clueText).toBe('dos')
    expect(result.nodes['n1']?.parent).toBeNull()
    expect(result.nodes['n2']?.parent).toBeNull()
  })

  it('anidamiento de un nivel (hijo dentro de padre)', () => {
    const result = parsePuzzleMarkup('texto [pista padre [pista hija]] fin')
    // Nodo de nivel 0 (padre)
    expect(result.rootTemplate).toBe('texto {{n1}} fin')
    // n1 contiene un placeholder de n2
    expect(result.nodes['n1']?.clueText).toContain('{{n2}}')
    expect(result.nodes['n1']?.children).toContain('n2')
    // n2 es hijo de n1
    expect(result.nodes['n2']?.parent).toBe('n1')
    expect(result.nodes['n2']?.children).toHaveLength(0)
    expect(result.nodes['n2']?.clueText).toBe('pista hija')
  })

  it('anidamiento de tres niveles (A > B > C)', () => {
    const result = parsePuzzleMarkup('[A [B [C]]]')
    expect(result.rootTemplate).toBe('{{n1}}')
    expect(result.nodes['n1']?.children).toContain('n2')
    expect(result.nodes['n2']?.children).toContain('n3')
    expect(result.nodes['n3']?.children).toHaveLength(0)
    expect(result.nodes['n3']?.parent).toBe('n2')
  })

  it('preserva texto literal dentro de pistas', () => {
    const result = parsePuzzleMarkup('[La ciudad de [la reina] del Mediterráneo]')
    expect(result.nodes['n1']?.clueText).toContain('La ciudad de')
    expect(result.nodes['n1']?.clueText).toContain('del Mediterráneo')
    expect(result.nodes['n1']?.clueText).toContain('{{n2}}')
  })

  it('lanza error con corchete de cierre sin abrir', () => {
    expect(() => parsePuzzleMarkup('texto] más texto')).toThrow(/balanceado/)
  })

  it('lanza error con corchete abierto sin cerrar', () => {
    expect(() => parsePuzzleMarkup('texto [sin cerrar')).toThrow(/sin cerrar/)
  })

  it('lanza error con corchetes cruzados', () => {
    expect(() => parsePuzzleMarkup('[A [B]')).toThrow()
  })
})

// ─── Tests de initPuzzleState ─────────────────────────────────────────────────

describe('initPuzzleState', () => {
  it('inicializa correctamente con nodos hoja activos', () => {
    const payload = makePayload('{{n1}} y {{n2}}', {
      n1: {
        id: 'n1', clueText: 'pista 1', children: [], parent: null,
        type: 'definition', solutionHash: 'h1', solutionCipher: 'c1',
      },
      n2: {
        id: 'n2', clueText: 'pista 2', children: [], parent: null,
        type: 'definition', solutionHash: 'h2', solutionCipher: 'c2',
      },
    })

    const state = initPuzzleState(payload)

    expect(state.nodes['n1']?.isActive).toBe(true)
    expect(state.nodes['n2']?.isActive).toBe(true)
    expect(state.nodes['n1']?.isResolved).toBe(false)
    expect(state.nodes['n2']?.isResolved).toBe(false)
    expect(state.score).toBe(100)
    expect(state.completedAt).toBeNull()
    expect(state.mistakesCount).toBe(0)
  })

  it('nodo con hijos no está activo al inicio', () => {
    const payload = makePayload('{{n1}}', {
      n1: {
        id: 'n1', clueText: 'pista padre {{n2}}', children: ['n2'], parent: null,
        type: 'definition', solutionHash: 'h1', solutionCipher: 'c1',
      },
      n2: {
        id: 'n2', clueText: 'pista hija', children: [], parent: 'n1',
        type: 'definition', solutionHash: 'h2', solutionCipher: 'c2',
      },
    })

    const state = initPuzzleState(payload)

    expect(state.nodes['n1']?.isActive).toBe(false) // tiene hijos sin resolver
    expect(state.nodes['n2']?.isActive).toBe(true)  // es hoja
  })
})

// ─── Tests de getActiveNodes ──────────────────────────────────────────────────

describe('getActiveNodes', () => {
  it('devuelve solo los nodos activos no resueltos', () => {
    const payload = makePayload('{{n1}} {{n2}}', {
      n1: {
        id: 'n1', clueText: 'p1', children: [], parent: null,
        type: 'definition', solutionHash: 'h1', solutionCipher: 'c1',
      },
      n2: {
        id: 'n2', clueText: 'p2', children: [], parent: null,
        type: 'definition', solutionHash: 'h2', solutionCipher: 'c2',
      },
    })
    const state = initPuzzleState(payload)
    const active = getActiveNodes(state)

    expect(active).toHaveLength(2)
    expect(active.map((n) => n.id)).toContain('n1')
    expect(active.map((n) => n.id)).toContain('n2')
  })

  it('excluye nodos ya resueltos', () => {
    const payload = makePayload('{{n1}} {{n2}}', {
      n1: {
        id: 'n1', clueText: 'p1', children: [], parent: null,
        type: 'definition', solutionHash: 'h1', solutionCipher: 'c1',
      },
      n2: {
        id: 'n2', clueText: 'p2', children: [], parent: null,
        type: 'definition', solutionHash: 'h2', solutionCipher: 'c2',
      },
    })
    let state = initPuzzleState(payload)
    state = resolveNode(state, 'n1', 'solución1')

    const active = getActiveNodes(state)
    expect(active).toHaveLength(1)
    expect(active[0]?.id).toBe('n2')
  })
})

// ─── Tests de recalculateActiveNodes (cascade) ────────────────────────────────

describe('recalculateActiveNodes', () => {
  it('activa el nodo padre cuando todos sus hijos se resuelven', () => {
    const payload = makePayload('{{n1}}', {
      n1: {
        id: 'n1', clueText: 'padre {{n2}}', children: ['n2'], parent: null,
        type: 'definition', solutionHash: 'h1', solutionCipher: 'c1',
      },
      n2: {
        id: 'n2', clueText: 'hijo', children: [], parent: 'n1',
        type: 'definition', solutionHash: 'h2', solutionCipher: 'c2',
      },
    })

    let state = initPuzzleState(payload)
    expect(state.nodes['n1']?.isActive).toBe(false)

    // Resolver el hijo
    state = resolveNode(state, 'n2', 'texto hijo')
    state = recalculateActiveNodes(state)

    // El padre debe haberse activado
    expect(state.nodes['n1']?.isActive).toBe(true)
  })

  it('no activa el padre si aún quedan hijos sin resolver', () => {
    const payload = makePayload('{{n1}}', {
      n1: {
        id: 'n1', clueText: 'padre {{n2}} {{n3}}', children: ['n2', 'n3'], parent: null,
        type: 'definition', solutionHash: 'h1', solutionCipher: 'c1',
      },
      n2: {
        id: 'n2', clueText: 'hijo A', children: [], parent: 'n1',
        type: 'definition', solutionHash: 'h2', solutionCipher: 'c2',
      },
      n3: {
        id: 'n3', clueText: 'hijo B', children: [], parent: 'n1',
        type: 'definition', solutionHash: 'h3', solutionCipher: 'c3',
      },
    })

    let state = initPuzzleState(payload)
    state = resolveNode(state, 'n2', 'texto A')
    state = recalculateActiveNodes(state)

    // n3 aún no está resuelto → el padre sigue bloqueado
    expect(state.nodes['n1']?.isActive).toBe(false)
  })

  it('activa el padre cuando se resuelven TODOS los hijos', () => {
    const payload = makePayload('{{n1}}', {
      n1: {
        id: 'n1', clueText: 'padre {{n2}} {{n3}}', children: ['n2', 'n3'], parent: null,
        type: 'definition', solutionHash: 'h1', solutionCipher: 'c1',
      },
      n2: {
        id: 'n2', clueText: 'hijo A', children: [], parent: 'n1',
        type: 'definition', solutionHash: 'h2', solutionCipher: 'c2',
      },
      n3: {
        id: 'n3', clueText: 'hijo B', children: [], parent: 'n1',
        type: 'definition', solutionHash: 'h3', solutionCipher: 'c3',
      },
    })

    let state = initPuzzleState(payload)
    state = resolveNode(state, 'n2', 'texto A')
    state = recalculateActiveNodes(state)
    state = resolveNode(state, 'n3', 'texto B')
    state = recalculateActiveNodes(state)

    expect(state.nodes['n1']?.isActive).toBe(true)
  })
})

// ─── Tests de isPuzzleComplete ────────────────────────────────────────────────

describe('isPuzzleComplete', () => {
  it('devuelve false cuando hay nodos sin resolver', () => {
    const payload = makePayload('{{n1}}', {
      n1: {
        id: 'n1', clueText: 'p1', children: [], parent: null,
        type: 'definition', solutionHash: 'h1', solutionCipher: 'c1',
      },
    })
    const state = initPuzzleState(payload)
    expect(isPuzzleComplete(state)).toBe(false)
  })

  it('devuelve true cuando todos los nodos están resueltos', () => {
    const payload = makePayload('{{n1}}', {
      n1: {
        id: 'n1', clueText: 'p1', children: [], parent: null,
        type: 'definition', solutionHash: 'h1', solutionCipher: 'c1',
      },
    })
    let state = initPuzzleState(payload)
    state = resolveNode(state, 'n1', 'solución')
    expect(isPuzzleComplete(state)).toBe(true)
  })
})
