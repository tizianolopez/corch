'use client'

import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import type { ClueNode } from '@corchetes/core'
import styles from './ClueTree.module.css'

export interface ClueBracketProps {
  node: ClueNode
  nodes: Record<string, ClueNode>
  hoveredNodeId: string | null
  selectedNodeId?: string | null
  justResolvedId?: string | null
  justUnlockedId?: string | null
  onHoverNode: (id: string | null) => void
  onSelectNode?: (id: string) => void
}

/** Comprueba si un nodo es ancestro o descendiente del nodo hovered */
function isRelatedToHovered(
  currentId: string,
  hoveredId: string | null,
  nodes: Record<string, ClueNode>,
): boolean {
  if (!hoveredId) return false
  if (currentId === hoveredId) return true

  // Comprobar si current es ancestro de hovered
  let curr = nodes[hoveredId]?.parent
  while (curr) {
    if (curr === currentId) return true
    curr = nodes[curr]?.parent ?? null
  }

  // Comprobar si hovered es ancestro de current
  curr = nodes[currentId]?.parent
  while (curr) {
    if (curr === hoveredId) return true
    curr = nodes[curr]?.parent ?? null
  }

  return false
}

/**
 * Renderizador recursivo de un corchete individual en el árbol.
 * Maneja los estados BLOQUEADO, ACTIVO y RESUELTO, junto con la
 * animación de linotipia y el dimming contextual.
 */
export function ClueBracket({
  node,
  nodes,
  hoveredNodeId,
  selectedNodeId,
  justResolvedId,
  justUnlockedId,
  onHoverNode,
  onSelectNode,
}: ClueBracketProps): ReactElement {
  // Estado para la fase de linotipia (1500ms en cursiva + subrayado punteado)
  const isJustResolved = justResolvedId === node.id
  const [inLinotipiaPhase, setInLinotipiaPhase] = useState(isJustResolved)

  useEffect(() => {
    if (isJustResolved) {
      setInLinotipiaPhase(true)
      const timer = setTimeout(() => {
        setInLinotipiaPhase(false)
      }, 1500)
      return () => { clearTimeout(timer) }
    }
  }, [isJustResolved])

  // Dimming contextual: si hay un nodo hovered y este no está relacionado, se atenúa
  const isDimmed = hoveredNodeId !== null && !isRelatedToHovered(node.id, hoveredNodeId, nodes)
  const isSelected = selectedNodeId === node.id
  const isJustUnlocked = justUnlockedId === node.id

  // ── 1. NODO RESUELTO ──────────────────────────────────────────────────────────
  if (node.isResolved) {
    const wordClass = [
      styles.resolvedWord,
      inLinotipiaPhase ? styles.resolvedFresh : styles.resolvedFused,
      node.revealedWithHint ? styles.revealedWithHint : '',
      isDimmed ? styles.dimmed : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <span className={wordClass} data-node-id={node.id} data-state="resolved">
        {node.resolvedText ?? ''}
        {node.revealedWithHint && <span className={styles.dagger}>†</span>}
      </span>
    )
  }

  // ── 2. NODO NO RESUELTO (CORCHETE) ───────────────────────────────────────────
  // Reemplazar recursivamente placeholders de hijos en clueText
  const parts = node.clueText.split(/({{[a-zA-Z0-9_-]+}})/g)

  const renderedContent = parts.map((part, index) => {
    const match = /^{{([a-zA-Z0-9_-]+)}}$/.exec(part)
    if (match?.[1]) {
      const childId = match[1]
      const childNode = nodes[childId]
      if (childNode) {
        return (
          <ClueBracket
            key={childId}
            node={childNode}
            nodes={nodes}
            hoveredNodeId={hoveredNodeId}
            selectedNodeId={selectedNodeId}
            justResolvedId={justResolvedId}
            justUnlockedId={justUnlockedId}
            onHoverNode={onHoverNode}
            onSelectNode={onSelectNode}
          />
        )
      }
    }
    return <span key={index}>{part}</span>
  })

  const bracketClasses = [
    styles.bracketContainer,
    node.isActive ? styles.bracketActive : styles.bracketBlocked,
    isSelected ? styles.selected : '',
    isJustUnlocked ? styles.unlockedFlash : '',
    isDimmed ? styles.dimmed : '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleMouseEnter = () => {
    if (!node.isResolved) {
      onHoverNode(node.id)
    }
  }

  const handleMouseLeave = () => {
    if (!node.isResolved) {
      onHoverNode(null)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!node.isResolved && onSelectNode) {
      onSelectNode(node.id)
    }
  }

  return (
    <span
      className={bracketClasses}
      data-node-id={node.id}
      data-state={node.isActive ? 'active' : 'blocked'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role={!node.isResolved ? 'button' : undefined}
      tabIndex={!node.isResolved ? 0 : undefined}
      onKeyDown={(e) => {
        if (!node.isResolved && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleClick(e as unknown as React.MouseEvent)
        }
      }}
    >
      [{renderedContent}]
    </span>
  )
}
