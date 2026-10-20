import { describe, it, expect } from 'vitest'
import { onSubmit, applyHint, generateCronica } from '../engine.js'
import type { HashFn, DecryptFn } from '../engine.js'
import type { PuzzleState } from '../types.js'

// Mocks para hashing y descifrado en tests
const mockHash: HashFn = async (input: string) => `HASH[${input}]`
const mockDecrypt: DecryptFn = async (cipher: string, _key: string) => cipher.replace('CIPHER[', '').replace(']', '')

function createTestState(): PuzzleState {
  return {
    puzzleId: 'puzzle-test',
    editionNumber: 42,
    publishDate: '2026-10-20',
    rootTemplate: 'Inicio {{n1}} fin',
    nodes: {
      n1: {
        id: 'n1',
        clueText: 'Pista padre [ {{n2}} ]',
        children: ['n2'],
        parent: null,
        type: 'definition',
        isActive: false,
        isResolved: false,
        resolvedText: null,
        revealedWithHint: false,
        // HASH[padre:puzzle-test:n1:salt123]
        solutionHash: 'HASH[padre:puzzle-test:n1:salt123]',
        solutionCipher: 'CIPHER[Padre]',
      },
      n2: {
        id: 'n2',
        clueText: 'Pista hoja',
        children: [],
        parent: 'n1',
        type: 'definition',
        isActive: true,
        isResolved: false,
        resolvedText: null,
        revealedWithHint: false,
        // HASH[hoja:puzzle-test:n2:salt123]
        solutionHash: 'HASH[hoja:puzzle-test:n2:salt123]',
        solutionCipher: 'CIPHER[Hoja]',
      },
    },
    startedAt: 10000,
    completedAt: null,
    mistakesCount: 0,
    hintsUsed: [],
    score: 100,
  }
}

describe('onSubmit', () => {
  const salt = 'salt123'

  it('input vacío retorna success: false sin alterar errores', async () => {
    const state = createTestState()
    const [result, newState] = await onSubmit('', state, salt, mockHash, mockDecrypt)
    expect(result.success).toBe(false)
    expect(newState.mistakesCount).toBe(0)
    expect(newState.score).toBe(100)
  })

  it('input incorrecto incrementa errores y penaliza puntuación', async () => {
    const state = createTestState()
    const [result, newState] = await onSubmit('error', state, salt, mockHash, mockDecrypt)
    expect(result.success).toBe(false)
    expect(newState.mistakesCount).toBe(1)
    expect(newState.score).toBe(95)
  })

  it('intento con la respuesta del padre cuando aún no está activo falla', async () => {
    const state = createTestState()
    // 'padre' solo es válido para n1, pero n1 tiene isActive = false
    const [result, newState] = await onSubmit('padre', state, salt, mockHash, mockDecrypt)
    expect(result.success).toBe(false)
    expect(newState.mistakesCount).toBe(1)
  })

  it('acierto de nodo hoja: lo resuelve, activa el padre en cascada', async () => {
    const state = createTestState()
    const [result, newState] = await onSubmit('hoja', state, salt, mockHash, mockDecrypt)
    expect(result.success).toBe(true)
    expect(result.resolvedNodeId).toBe('n2')
    expect(result.resolvedText).toBe('Hoja')
    expect(result.isComplete).toBe(false)

    expect(newState.nodes['n2']?.isResolved).toBe(true)
    expect(newState.nodes['n2']?.resolvedText).toBe('Hoja')
    // El padre n1 ahora debe haber pasado a isActive = true
    expect(newState.nodes['n1']?.isActive).toBe(true)
    expect(newState.completedAt).toBeNull()
  })

  it('resolución completa del puzle: marca completedAt y calcula score final', async () => {
    const state = createTestState()
    // Resolver n2
    const [, stateAfterN2] = await onSubmit('hoja', state, salt, mockHash, mockDecrypt)
    // Resolver n1
    const [resultN1, finalState] = await onSubmit('padre', stateAfterN2, salt, mockHash, mockDecrypt)

    expect(resultN1.success).toBe(true)
    expect(resultN1.resolvedNodeId).toBe('n1')
    expect(resultN1.isComplete).toBe(true)
    expect(finalState.completedAt).not.toBeNull()
    expect(typeof finalState.score).toBe('number')
  })
})

describe('applyHint', () => {
  it('tipo matrix registra la ayuda sin resolver el nodo', () => {
    const state = createTestState()
    const newState = applyHint('n2', 'matrix', state)
    expect(newState.hintsUsed).toHaveLength(1)
    expect(newState.hintsUsed[0]?.type).toBe('matrix')
    expect(newState.hintsUsed[0]?.nodeId).toBe('n2')
    expect(newState.nodes['n2']?.isResolved).toBe(false)
  })

  it('tipo reveal resuelve el nodo marcándolo con revealedWithHint: true', () => {
    const state = createTestState()
    const newState = applyHint('n2', 'reveal', state, 'Solución Revelada')
    expect(newState.hintsUsed).toHaveLength(1)
    expect(newState.hintsUsed[0]?.type).toBe('reveal')
    expect(newState.nodes['n2']?.isResolved).toBe(true)
    expect(newState.nodes['n2']?.resolvedText).toBe('Solución Revelada')
    expect(newState.nodes['n2']?.revealedWithHint).toBe(true)
    // Se activa el padre
    expect(newState.nodes['n1']?.isActive).toBe(true)
  })

  it('tipo reveal que completa el último nodo marca completedAt y calcula score', () => {
    const state = createTestState()
    // Resolver n2 primero
    const stateAfterN2 = applyHint('n2', 'reveal', state, 'Hoja')
    // Resolver n1 con reveal completando el puzzle
    const finalState = applyHint('n1', 'reveal', stateAfterN2, 'Padre')
    expect(finalState.completedAt).not.toBeNull()
    expect(finalState.nodes['n1']?.isResolved).toBe(true)
    expect(typeof finalState.score).toBe('number')
  })
})

describe('generateCronica', () => {
  it('lanza error si la partida no está completada', () => {
    const state = createTestState()
    expect(() => generateCronica(state)).toThrow('generateCronica: la partida no ha terminado')
  })

  it('genera el texto tipográfico con la estructura y métricas correctas', () => {
    const state: PuzzleState = {
      ...createTestState(),
      editionNumber: 142,
      publishDate: '2026-10-20',
      startedAt: 100000,
      completedAt: 100000 + 138 * 1000, // 02m 18s
      score: 95,
      mistakesCount: 1,
      hintsUsed: [{ nodeId: 'n1', type: 'matrix', at: 105000 }],
      nodes: {
        n1: {
          id: 'n1',
          clueText: 'padre',
          children: ['n2'],
          parent: null,
          type: 'definition',
          isActive: false,
          isResolved: true,
          resolvedText: 'Padre',
          revealedWithHint: false,
          solutionHash: 'h1',
          solutionCipher: 'c1',
        },
        n2: {
          id: 'n2',
          clueText: 'hijo',
          children: [],
          parent: 'n1',
          type: 'definition',
          isActive: false,
          isResolved: true,
          resolvedText: 'Hijo',
          revealedWithHint: true, // revelado con ayuda †
          solutionHash: 'h2',
          solutionCipher: 'c2',
        },
      },
    }

    const cronica = generateCronica(state)

    expect(cronica).toContain('CORCHETES — Edición N.º 142')
    expect(cronica).toContain('Martes, 20 de octubre de 2026')
    expect(cronica).toContain('──────────────────────────────')
    // El nodo padre tiene hijo n2 con † y él mismo es · -> [ [ † ] · ]
    expect(cronica).toContain('Estructura · [ [ † ] · ]')
    expect(cronica).toContain('Precisión  · 67 % (1 consulta al archivo)')
    expect(cronica).toContain('Tiempo     · 02m 18s')
    expect(cronica).toContain('Rango      · Maestro')
    expect(cronica).toContain('corchetes.es')
    // Asegurarse de que NUNCA revela palabras de soluciones
    expect(cronica).not.toContain('Padre')
    expect(cronica).not.toContain('Hijo')
  })
})
