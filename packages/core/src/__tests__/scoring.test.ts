import { describe, it, expect } from 'vitest'
import { calculateScore, getRank, applyMistakePenalty } from '../scoring.js'
import type { PuzzleState } from '../types.js'

function makeMockState(overrides: Partial<PuzzleState> = {}): PuzzleState {
  const now = 1000000000000
  return {
    puzzleId: 'p-1',
    editionNumber: 1,
    publishDate: '2026-10-20',
    rootTemplate: 'Frase con {{n1}}',
    nodes: {
      n1: {
        id: 'n1',
        clueText: 'Pista',
        children: [],
        parent: null,
        type: 'standard',
        state: 'RESOLVED',
        resolvedText: 'Solución',
        revealedWithHint: false,
        solutionHash: 'hash',
        solutionCipher: 'cipher',
      },
    },
    startedAt: now,
    completedAt: now + 60000, // 1 min (dentro de los 3 min de gracia)
    mistakesCount: 0,
    hintsUsed: [],
    score: 100,
    ...overrides,
  }
}

describe('calculateScore', () => {
  it('lanza error si la partida no ha terminado (completedAt null)', () => {
    const state = makeMockState({ completedAt: null })
    expect(() => calculateScore(state)).toThrow('calculateScore: la partida no ha terminado')
  })

  it('partida perfecta dentro del tiempo de gracia da 100 puntos', () => {
    const state = makeMockState({
      mistakesCount: 0,
      hintsUsed: [],
      startedAt: 1000,
      completedAt: 1000 + 120 * 1000, // 2 min
    })
    expect(calculateScore(state)).toBe(100)
  })

  it('penaliza errores a -5 pts hasta un máximo acumulable de -40', () => {
    const state3 = makeMockState({ mistakesCount: 3 })
    expect(calculateScore(state3)).toBe(85) // 100 - 15

    const state10 = makeMockState({ mistakesCount: 10 })
    expect(calculateScore(state10)).toBe(60) // 100 - 40 (tope alcanzado)
  })

  it('penaliza ayudas de matriz (-8) y revelar término (-15)', () => {
    const state = makeMockState({
      hintsUsed: [
        { nodeId: 'n1', type: 'matrix', at: 1000 },
        { nodeId: 'n2', type: 'reveal', at: 2000 },
      ],
    })
    expect(calculateScore(state)).toBe(100 - 8 - 15) // 77
  })

  it('penaliza tiempo: 180s de gracia, luego -1 pt por cada 30s hasta máx -10', () => {
    const started = 10000
    // 180s + 60s extra = 2 intervalos de 30s -> -2 puntos
    const state2 = makeMockState({
      startedAt: started,
      completedAt: started + (180 + 65) * 1000,
    })
    expect(calculateScore(state2)).toBe(98)

    // Mucho tiempo extra (> 300s extra) -> máximo penalización -10
    const stateMax = makeMockState({
      startedAt: started,
      completedAt: started + 1000 * 1000,
    })
    expect(calculateScore(stateMax)).toBe(90)
  })

  it('la puntuación nunca es menor que 0', () => {
    const stateCalamity = makeMockState({
      mistakesCount: 15, // -40
      hintsUsed: [
        { nodeId: 'n1', type: 'reveal', at: 1 }, // -15
        { nodeId: 'n2', type: 'reveal', at: 2 }, // -15
        { nodeId: 'n3', type: 'reveal', at: 3 }, // -15
        { nodeId: 'n4', type: 'reveal', at: 4 }, // -15
        { nodeId: 'n5', type: 'reveal', at: 5 }, // -15
      ], // total ayudas: -75
      startedAt: 1000,
      completedAt: 1000 + 1000 * 1000, // -10 tiempo
      // 100 - 40 - 75 - 10 = -25 -> clamp a 0
    })
    expect(calculateScore(stateCalamity)).toBe(0)
  })
})

describe('applyMistakePenalty', () => {
  it('resta 5 puntos mientras no se sobrepase el límite de penalizaciones', () => {
    expect(applyMistakePenalty(100, 1)).toBe(95)
    expect(applyMistakePenalty(95, 2)).toBe(90)
  })

  it('no resta puntos si los errores superan el máximo computable (8 errores = 40 pts)', () => {
    expect(applyMistakePenalty(60, 9)).toBe(60)
    expect(applyMistakePenalty(60, 15)).toBe(60)
  })

  it('no baja de 0', () => {
    expect(applyMistakePenalty(3, 1)).toBe(0)
  })
})

describe('getRank', () => {
  it('asigna los rangos correctos según la puntuación', () => {
    expect(getRank(100)).toBe('Gran Maestro')
    expect(getRank(99)).toBe('Maestro')
    expect(getRank(85)).toBe('Maestro')
    expect(getRank(84)).toBe('Cronista')
    expect(getRank(65)).toBe('Cronista')
    expect(getRank(64)).toBe('Escriba')
    expect(getRank(40)).toBe('Escriba')
    expect(getRank(39)).toBe('Aprendiz')
    expect(getRank(0)).toBe('Aprendiz')
  })
})
