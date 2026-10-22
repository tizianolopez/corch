/**
 * Tests de EndScreen (renderToStaticMarkup)
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EndScreen } from '../components/EndScreen/EndScreen'
import type { PuzzleState } from '@corchetes/core'

function makeCompletedState(overrides: Partial<PuzzleState> = {}): PuzzleState {
  const now = Date.now()
  return {
    puzzleId: 'test-001',
    editionNumber: 1,
    publishDate: '2026-10-20',
    rootTemplate: 'El {{n1}} era un hidalgo.',
    nodes: {
      n1: {
        id: 'n1',
        clueText: 'hidalgo de La Mancha',
        children: [],
        parent: null,
        type: 'definition',
        solutionHash: 'hash1',
        solutionCipher: 'cipher1',
        isActive: false,
        isResolved: true,
        revealedWithHint: false,
        resolvedText: 'Quijote',
      },
    },
    startedAt: now - 138000, // 2m18s
    completedAt: now,
    hintsUsed: [],
    mistakesCount: 0,
    score: 100,
    quoteAuthor: 'Miguel de Cervantes',
    quoteWork: 'Don Quijote de la Mancha',
    quoteYear: 1605,
    editorialNote: 'Una obra maestra de la literatura universal.',
    ...overrides,
  }
}

describe('EndScreen', () => {
  it('renderiza la atribución de la cita correctamente', () => {
    const html = renderToStaticMarkup(<EndScreen state={makeCompletedState()} />)
    expect(html).toContain('Miguel de Cervantes')
    expect(html).toContain('Don Quijote de la Mancha')
    expect(html).toContain('1605')
  })

  it('muestra la nota editorial cuando está presente', () => {
    const html = renderToStaticMarkup(<EndScreen state={makeCompletedState()} />)
    expect(html).toContain('Una obra maestra de la literatura universal.')
  })

  it('no muestra la nota editorial si está vacía', () => {
    const html = renderToStaticMarkup(
      <EndScreen state={makeCompletedState({ editorialNote: '' })} />,
    )
    expect(html).not.toContain('Una obra maestra')
  })

  it('muestra el rango del jugador', () => {
    const html = renderToStaticMarkup(
      <EndScreen state={makeCompletedState({ score: 100 })} />,
    )
    expect(html).toContain('Gran Maestro')
  })

  it('muestra el botón «Copiar crónica»', () => {
    const html = renderToStaticMarkup(<EndScreen state={makeCompletedState()} />)
    expect(html).toContain('Copiar crónica')
  })

  it('muestra el placeholder del percentil si no se proporciona', () => {
    const html = renderToStaticMarkup(<EndScreen state={makeCompletedState()} />)
    expect(html).toContain('pr\u00f3ximamente')
  })

  it('muestra el percentil real y el mensaje de comparación si se proporciona', () => {
    const html = renderToStaticMarkup(
      <EndScreen state={makeCompletedState()} percentile={84} />,
    )
    expect(html).toContain('84 %')
    expect(html).toContain('m\u00e1s r\u00e1pido que el')
    expect(html).not.toContain('pr\u00f3ximamente')
  })

  it('muestra métricas: Tiempo, Precisión, Rango', () => {
    const html = renderToStaticMarkup(<EndScreen state={makeCompletedState()} />)
    expect(html).toContain('Tiempo')
    expect(html).toContain('Precisi\u00f3n')
    expect(html).toContain('Rango')
  })

  it('usa el quoteText personalizado si se proporciona', () => {
    const html = renderToStaticMarkup(
      <EndScreen
        state={makeCompletedState()}
        quoteText="El Quijote era un hidalgo."
      />,
    )
    expect(html).toContain('El Quijote era un hidalgo.')
  })
})
