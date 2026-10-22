import { describe, it, expect } from 'vitest'
import {
  analyzeManualPuzzle,
  type EditorNodeInput,
} from '../lib/manualEditorAnalyzer'

describe('Manual Editor Analyzer (Fase 4.4)', () => {
  it('detecta errores de sintaxis en corchetes desbalanceados', () => {
    const analysis = analyzeManualPuzzle('Frase con corchete abierto [sin cerrar', [])
    expect(analysis.isValid).toBe(false)
    expect(analysis.hasSyntaxError).toBe(true)
    expect(analysis.alerts.some((a) => a.id === 'syntax_error')).toBe(true)
  })

  it('detecta alerta «Solo 1 nodo activo inicial» cuando solo hay una hoja', () => {
    // [n1 con [n2]] -> n2 es la única hoja inicial (1 sola hoja activa)
    const markup = 'Texto con [pista externa [pista interna profunda]]'
    const nodes: EditorNodeInput[] = [
      { id: 'n1', solution: 'externa', type: 'definition' },
      { id: 'n2', solution: 'interna', type: 'morphological' },
    ]

    const analysis = analyzeManualPuzzle(markup, nodes)
    expect(analysis.initialLeaves).toBe(1)
    expect(analysis.maxDepth).toBe(2)
    expect(analysis.alerts.some((a) => a.id === 'single_leaf')).toBe(true)
    expect(
      analysis.alerts.find((a) => a.id === 'single_leaf')?.message,
    ).toContain('Solo 1 nodo activo inicial')
  })

  it('detecta alerta «2 nodos con solución idéntica» tras normalización', () => {
    const markup = 'Texto con [pista [anidada]] y [otra hoja]'
    const nodes: EditorNodeInput[] = [
      { id: 'n1', solution: 'Madrid', type: 'definition' },
      { id: 'n2', solution: 'MÁDRID', type: 'morphological' }, // Misma solución normalizada
      { id: 'n3', solution: 'Barcelona', type: 'reference' },
    ]

    const analysis = analyzeManualPuzzle(markup, nodes)
    expect(analysis.alerts.some((a) => a.id.startsWith('duplicate_solution'))).toBe(true)
    expect(
      analysis.alerts.find((a) => a.id.startsWith('duplicate_solution'))?.message,
    ).toContain('2 nodos con solución idéntica')
  })

  it('reporta soluciones faltantes para corchetes recién añadidos', () => {
    const markup = 'Texto con [pista uno [pista dos]] y [pista tres]'
    const nodes: EditorNodeInput[] = [
      { id: 'n1', solution: 'uno', type: 'charade' },
      // Falta n2 y n3
    ]

    const analysis = analyzeManualPuzzle(markup, nodes)
    expect(analysis.isValid).toBe(false)
    expect(analysis.alerts.some((a) => a.id === 'missing_solution_n2')).toBe(true)
    expect(analysis.alerts.some((a) => a.id === 'missing_solution_n3')).toBe(true)
  })

  it('valida con éxito un puzle correctamente anidado y balanceado', () => {
    const markup = 'En [1969] la [misión [espacial]] pisó la Luna.'
    const nodes: EditorNodeInput[] = [
      { id: 'n1', solution: '1969', type: 'historical' },
      { id: 'n2', solution: 'Apolo 11', type: 'charade' },
      { id: 'n3', solution: 'lunar', type: 'nested' },
    ]

    const analysis = analyzeManualPuzzle(markup, nodes)
    expect(analysis.hasSyntaxError).toBe(false)
    expect(analysis.totalNodes).toBe(3)
    expect(analysis.maxDepth).toBe(2)
    expect(analysis.initialLeaves).toBe(2) // n1 y n3
    expect(analysis.isValid).toBe(true)
  })
})
