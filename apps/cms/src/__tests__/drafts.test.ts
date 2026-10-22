import { describe, it, expect } from 'vitest'
import { initPuzzleState } from '@corchetes/core'
import type { ClientPayload, ClientClueNode } from '@corchetes/core'
import type { DraftPuzzleItem } from '../../app/admin/page'

describe('Cola de Borradores y Vista Previa (Fase 4.2)', () => {
  const sampleClientPayload: ClientPayload = {
    puzzleId: 'puz-test-1',
    editionNumber: 1,
    publishDate: '2026-10-23',
    rootTemplate: 'Un día como hoy, pero en 1962, {{n1}} anunció el {{n3}} a Cuba.',
    nodes: {
      n1: {
        id: 'n1',
        clueText: 'el mandatario demócrata que lidió con {{n2}}',
        children: ['n2'],
        parent: null,
        type: 'reference',
        solutionHash: 'hash_n1',
        solutionCipher: 'John F. Kennedy',
      },
      n2: {
        id: 'n2',
        clueText: 'la isla gobernada por Fidel',
        children: [],
        parent: 'n1',
        type: 'definition',
        solutionHash: 'hash_n2',
        solutionCipher: 'Cuba',
      },
      n3: {
        id: 'n3',
        clueText: 'cerco marítimo',
        children: [],
        parent: null,
        type: 'definition',
        solutionHash: 'hash_n3',
        solutionCipher: 'bloqueo naval',
      },
    },
    dailySalt: 'salt-demo',
    quoteAuthor: 'John F. Kennedy',
    quoteWork: 'Crisis de los Misiles',
    quoteYear: 1962,
    editorialNote: 'Discurso histórico.',
  }

  const sampleDrafts: DraftPuzzleItem[] = [
    {
      id: 'd-2',
      editionNumber: 2,
      publishDate: '2026-10-24',
      status: 'DRAFT',
      source: 'AI',
      quoteAuthor: 'Autor B',
      quoteWork: 'Obra B',
      quoteYear: 1970,
      editorialNote: 'Nota B',
      maxDepth: 2,
      totalNodes: 3,
      initialLeaves: 2,
      rawMarkup: 'Markup B',
      clientPayload: sampleClientPayload,
    },
    {
      id: 'd-1',
      editionNumber: 1,
      publishDate: '2026-10-23',
      status: 'DRAFT',
      source: 'AI',
      quoteAuthor: 'Autor A',
      quoteWork: 'Obra A',
      quoteYear: 1962,
      editorialNote: 'Nota A',
      maxDepth: 2,
      totalNodes: 3,
      initialLeaves: 2,
      rawMarkup: 'Markup A',
      clientPayload: sampleClientPayload,
    },
  ]

  it('ordena los borradores por fecha de publicación de forma ascendente', () => {
    const sorted = [...sampleDrafts].sort((a, b) =>
      a.publishDate.localeCompare(b.publishDate),
    )

    expect(sorted[0]?.id).toBe('d-1')
    expect(sorted[0]?.publishDate).toBe('2026-10-23')
    expect(sorted[1]?.id).toBe('d-2')
    expect(sorted[1]?.publishDate).toBe('2026-10-24')
  })

  it('permite inicializar el estado del juego para la vista previa con ClueTree', () => {
    const gameState = initPuzzleState(sampleClientPayload)

    expect(gameState.puzzleId).toBe('puz-test-1')
    expect(gameState.score).toBe(100)
    expect(gameState.rootTemplate).toContain('{{n1}}')

    // n2 y n3 son hojas, por lo que deben ser activas
    expect(gameState.nodes['n2']?.isActive).toBe(true)
    expect(gameState.nodes['n3']?.isActive).toBe(true)
    // n1 tiene un hijo (n2), por lo que debe iniciar bloqueada
    expect(gameState.nodes['n1']?.isActive).toBe(false)
  })

  it('simula la edición inline de una pista en el cliente', () => {
    const targetNode = sampleClientPayload.nodes['n2']
    expect(targetNode).toBeDefined()
    if (!targetNode) return

    const updatedNodes: Record<string, ClientClueNode> = {
      ...sampleClientPayload.nodes,
      n2: {
        ...targetNode,
        clueText: 'nueva pista editada para Cuba',
      },
    }

    const updatedPayload = {
      ...sampleClientPayload,
      nodes: updatedNodes,
    }

    expect(updatedPayload.nodes['n2']?.clueText).toBe(
      'nueva pista editada para Cuba',
    )
    expect(updatedPayload.nodes['n1']?.clueText).toBe(
      sampleClientPayload.nodes['n1']?.clueText,
    )
  })
})
