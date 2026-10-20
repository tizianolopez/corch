import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClueTree } from '../components/ClueTree/ClueTree'
import { Masthead } from '../components/Masthead/Masthead'
import type { ClueNode } from '@corchetes/core'

function createMockNode(overrides: Partial<ClueNode>): ClueNode {
  return {
    id: 'n1',
    clueText: 'pista',
    children: [],
    parent: null,
    type: 'definition',
    isActive: true,
    isResolved: false,
    revealedWithHint: false,
    resolvedText: null,
    solutionHash: 'hash',
    solutionCipher: 'cipher',
    ...overrides,
  }
}

describe('ClueTree', () => {
  it('renderiza un árbol simple con 1 nivel de profundidad (nodo activo)', () => {
    const nodes: Record<string, ClueNode> = {
      n1: createMockNode({
        id: 'n1',
        clueText: 'río famoso',
        isActive: true,
        isResolved: false,
      }),
    }

    const html = renderToStaticMarkup(
      <ClueTree
        rootTemplate="El {{n1}} es muy largo"
        nodes={nodes}
        quoteAuthor="Autor"
        quoteWork="Obra"
      />,
    )

    expect(html).toContain('El ')
    expect(html).toContain('[<span>río famoso</span>]')
    expect(html).toContain(' es muy largo')
    expect(html).toContain('data-state="active"')
    expect(html).toContain('data-node-id="n1"')
    expect(html).toContain('— Autor, Obra')
  })

  it('renderiza un árbol anidado de 3 niveles de profundidad', () => {
    // n1 (raíz) -> n2 (hijo) -> n3 (nieto activo)
    const nodes: Record<string, ClueNode> = {
      n1: createMockNode({
        id: 'n1',
        clueText: 'capital de {{n2}}',
        children: ['n2'],
        parent: null,
        isActive: false, // Bloqueado porque n2 no está resuelto
        isResolved: false,
      }),
      n2: createMockNode({
        id: 'n2',
        clueText: 'país del {{n3}}',
        children: ['n3'],
        parent: 'n1',
        isActive: false, // Bloqueado porque n3 no está resuelto
        isResolved: false,
      }),
      n3: createMockNode({
        id: 'n3',
        clueText: 'río Nilo',
        children: [],
        parent: 'n2',
        isActive: true, // Hoja activa
        isResolved: false,
      }),
    }

    const html = renderToStaticMarkup(
      <ClueTree rootTemplate="Viaje a {{n1}}" nodes={nodes} />,
    )

    // Debe contener el corchete exterior bloqueado n1
    expect(html).toContain('data-node-id="n1"')
    expect(html).toContain('data-state="blocked"')

    // Debe contener el corchete intermedio bloqueado n2
    expect(html).toContain('data-node-id="n2"')
    expect(html).toContain('data-state="blocked"')

    // Debe contener el corchete hoja activo n3
    expect(html).toContain('data-node-id="n3"')
    expect(html).toContain('data-state="active"')
    expect(html).toContain('río Nilo')
  })

  it('renderiza nodo resuelto reemplazando los corchetes por la palabra resuelta', () => {
    const nodes: Record<string, ClueNode> = {
      n1: createMockNode({
        id: 'n1',
        clueText: 'pista resuelta',
        isActive: false,
        isResolved: true,
        resolvedText: 'Amazonas',
        revealedWithHint: false,
      }),
    }

    const html = renderToStaticMarkup(
      <ClueTree rootTemplate="El río {{n1}} es caudaloso" nodes={nodes} />,
    )

    expect(html).toContain('El río ')
    expect(html).toContain('Amazonas')
    expect(html).toContain('data-state="resolved"')
    // No debe contener corchetes para este nodo
    expect(html).not.toContain('[pista resuelta]')
    expect(html).not.toContain('†')
  })

  it('renderiza nodo revelado con ayuda con la marca de daga †', () => {
    const nodes: Record<string, ClueNode> = {
      n1: createMockNode({
        id: 'n1',
        clueText: 'pista con ayuda',
        isActive: false,
        isResolved: true,
        resolvedText: 'Nilo',
        revealedWithHint: true,
      }),
    }

    const html = renderToStaticMarkup(
      <ClueTree rootTemplate="El {{n1}}" nodes={nodes} />,
    )

    expect(html).toContain('Nilo')
    expect(html).toContain('†')
  })
})

describe('Masthead', () => {
  it('renderiza la cabecera editorial con formato N.º 00142 y fecha', () => {
    const html = renderToStaticMarkup(
      <Masthead editionNumber={142} publishDate="2026-10-20" />,
    )

    expect(html).toContain('N.º 00142')
    expect(html).toContain('EDICIÓN DIARIA')
    expect(html).toContain('MARTES, 20 DE OCTUBRE DE 2026')
    expect(html).toContain('C O R C H E T E S')
    expect(html).toContain('El juego de reconstrucción léxica')
  })
})
