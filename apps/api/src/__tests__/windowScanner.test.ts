import { describe, it, expect } from 'vitest'
import {
  scanSentence,
  stripAccentsPreservingEnhe,
  findCrossBoundaries,
  findCharades,
  findAnagrams,
  getLexicon,
} from '../services/windowScanner'

describe('Motor de Ventana Deslizante (Window Scanner)', () => {
  it('stripAccentsPreservingEnhe elimina tildes pero conserva la letra eñe', () => {
    expect(stripAccentsPreservingEnhe('CamióN')).toBe('camion')
    expect(stripAccentsPreservingEnhe('Año')).toBe('año')
    expect(stripAccentsPreservingEnhe('Ñandú')).toBe('ñandu')
    expect(stripAccentsPreservingEnhe('ÁÉÍÓÚ')).toBe('aeiou')
  })

  it('detecta cruces entre palabras a través del espacio', () => {
    const lex = getLexicon()
    const text = 'santiago lento como hoy'
    const crosses = findCrossBoundaries(text, lex)

    // En 'como hoy' debe detectar 'moho'
    const hasMoho = crosses.some((c) => c.hiddenWord === 'moho')
    expect(hasMoho).toBe(true)
  })

  it('detecta charadas morfológicas (soldado -> sol + dado)', () => {
    const lex = getLexicon()
    const text = 'el valiente soldado luchó'
    const charades = findCharades(text, lex)

    const hasSoldado = charades.some(
      (c) => c.compoundWord === 'soldado' && c.part1 === 'sol' && c.part2 === 'dado',
    )
    expect(hasSoldado).toBe(true)
  })

  it('detecta anagramas exactos (roma -> amor)', () => {
    const lex = getLexicon()
    const text = 'viajó a roma'
    const anagrams = findAnagrams(text, lex)

    const hasAmor = anagrams.some(
      (a) => a.sourceWord === 'roma' && a.anagramWord === 'amor',
    )
    expect(hasAmor).toBe(true)
  })

  it('scanSentence devuelve estructura completa con total de oportunidades', () => {
    const result = scanSentence(
      'Un día como hoy el soldado desafiaba al bloqueo naval en Roma.',
    )

    expect(result.totalOpportunities).toBeGreaterThan(0)
    expect(result.crossBoundaries.length).toBeGreaterThan(0)
    expect(result.charades.length).toBeGreaterThan(0)
    expect(result.anagrams.length).toBeGreaterThan(0)
  })
})
