'use client'

import { useState } from 'react'
import type { ReactElement } from 'react'
import type { ClueNode } from '@corchetes/core'
import { ClueBracket } from './ClueBracket'
import styles from './ClueTree.module.css'

export interface ClueTreeProps {
  /** Plantilla raíz con placeholders {{n1}}, {{n2}} */
  rootTemplate: string
  /** Diccionario de nodos del árbol */
  nodes: Record<string, ClueNode>
  /** Autor de la cita original */
  quoteAuthor?: string
  /** Obra de la cita original */
  quoteWork?: string
  /** Año de la obra */
  quoteYear?: number
  /** ID del nodo actualmente seleccionado para input */
  selectedNodeId?: string | null
  /** ID del nodo que acaba de ser resuelto (para activar animación linotipia) */
  justResolvedId?: string | null
  /** ID del nodo padre que acaba de desbloquearse (para destello cascade) */
  justUnlockedId?: string | null
  /** Callback al seleccionar un nodo activo */
  onSelectNode?: (nodeId: string) => void
  /** Clases CSS adicionales */
  className?: string
}

/**
 * Componente ClueTree — Núcleo de la interfaz de Corchetes.
 *
 * Renderiza la frase/cita con los corchetes jerárquicos recursivos,
 * manejando:
 * - Contraste tipográfico: Newsreader para texto resuelto/fijo vs Inter para pistas en corchetes.
 * - Estados visuales: BLOQUEADO (gris), ACTIVO (verde inglés), RESUELTO (serif).
 * - Dimming contextual: al hacer hover sobre un corchete activo, el resto de la cita atenúa su opacidad a 0.35.
 * - Animación de linotipia en el nodo recién resuelto.
 */
export function ClueTree({
  rootTemplate,
  nodes,
  quoteAuthor,
  quoteWork,
  quoteYear,
  selectedNodeId,
  justResolvedId,
  justUnlockedId,
  onSelectNode,
  className = '',
}: ClueTreeProps): ReactElement {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  // Separar el rootTemplate por placeholders {{nId}}
  const segments = rootTemplate.split(/({{[a-zA-Z0-9_-]+}})/g)

  // Comprobar si el texto fijo debe estar atenuado (si hay algún hover activo)
  const isTextDimmed = hoveredNodeId !== null

  return (
    <article className={`${styles.treeRoot} ${className}`.trim()} aria-label="Texto a reconstruir">
      <blockquote className={styles.quoteBlock}>
        {segments.map((segment, index) => {
          const match = /^{{([a-zA-Z0-9_-]+)}}$/.exec(segment)
          if (match?.[1]) {
            const nodeId = match[1]
            const node = nodes[nodeId]
            if (node) {
              return (
                <ClueBracket
                  key={nodeId}
                  node={node}
                  nodes={nodes}
                  hoveredNodeId={hoveredNodeId}
                  selectedNodeId={selectedNodeId}
                  justResolvedId={justResolvedId}
                  justUnlockedId={justUnlockedId}
                  onHoverNode={setHoveredNodeId}
                  onSelectNode={onSelectNode}
                />
              )
            }
          }

          // Fragmento de texto fijo de la cita
          return (
            <span
              key={index}
              className={`${styles.fixedText} ${isTextDimmed ? styles.dimmed : ''}`.trim()}
            >
              {segment}
            </span>
          )
        })}
      </blockquote>

      {/* Atribución de autor, obra y año */}
      {Boolean(quoteAuthor) && (
        <footer
          className={`${styles.authorAttribution} ${isTextDimmed ? styles.dimmed : ''}`.trim()}
        >
          — {quoteAuthor}
          {quoteWork && `, ${quoteWork}`}
          {quoteYear && ` (${quoteYear.toString()})`}
        </footer>
      )}
    </article>
  )
}
