'use client'

import { useState, useEffect } from 'react'
import type { ClientPayload, PuzzleState } from '@corchetes/core'
import { initPuzzleState, onSubmit } from '@corchetes/core'
import { sha256, aesGcmDecrypt } from '@corchetes/crypto'
import { ClueTree } from '@corchetes/ui'
import styles from './DraftPreviewModal.module.css'

export interface DraftPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  puzzle: {
    id: string
    editionNumber: number
    publishDate: string
    quoteAuthor?: string | null
    quoteWork?: string | null
    quoteYear?: number | null
    editorialNote?: string | null
    rawMarkup: string
    clientPayload: ClientPayload
  }
}

export function DraftPreviewModal({
  isOpen,
  onClose,
  puzzle,
}: DraftPreviewModalProps) {
  const [gameState, setGameState] = useState<PuzzleState | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [testInput, setTestInput] = useState('')
  const [justResolvedId, setJustResolvedId] = useState<string | null>(null)

  // Inicializar estado del puzle cuando se abre
  useEffect(() => {
    if (isOpen && puzzle.clientPayload) {
      const state = initPuzzleState(puzzle.clientPayload)
      setGameState(state)
      setSelectedNodeId(null)
      setTestInput('')
      setJustResolvedId(null)
    }
  }, [isOpen, puzzle])

  if (!isOpen || !gameState) return null

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testInput.trim()) return

    const [result, nextState] = await onSubmit(
      testInput,
      gameState,
      puzzle.clientPayload.dailySalt,
      sha256,
      aesGcmDecrypt,
    )
    if (result.success) {
      setJustResolvedId(result.resolvedNodeId)
      setGameState(nextState)
      setTestInput('')
    } else {
      alert(`La respuesta '${testInput}' no coincide con ninguna pista activa.`)
    }
  }

  const handleReset = () => {
    setGameState(initPuzzleState(puzzle.clientPayload))
    setJustResolvedId(null)
    setTestInput('')
  }

  const activeNodes = Object.values(gameState.nodes).filter((n) => n.isActive && !n.isResolved)
  const resolvedNodes = Object.values(gameState.nodes).filter((n) => n.isResolved)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Vista Previa Interactiva</h2>
            <p className={styles.subtitle}>
              Edición #{puzzle.editionNumber} · {puzzle.publishDate}
            </p>
          </div>
          <button type="button" onClick={onClose} className={styles.btnClose}>
            Cerrar
          </button>
        </div>

        <div className={styles.body}>
          {/* Componente ClueTree oficial del sistema de diseño */}
          <div className={styles.treeContainer}>
            <ClueTree
              rootTemplate={gameState.rootTemplate}
              nodes={gameState.nodes}
              quoteAuthor={gameState.quoteAuthor}
              quoteWork={gameState.quoteWork}
              quoteYear={gameState.quoteYear}
              selectedNodeId={selectedNodeId}
              justResolvedId={justResolvedId}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />
          </div>

          {/* Probador en vivo de respuestas */}
          <div className={styles.testerCard}>
            <div className={styles.testerHeader}>
              <span className={styles.testerTitle}>Simulador de Resolución</span>
              <button
                type="button"
                onClick={handleReset}
                className={styles.btnSecondary}
              >
                Reiniciar árbol
              </button>
            </div>

            <form onSubmit={handleTestSubmit} className={styles.testerForm}>
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Escribe una respuesta para probar..."
                className={styles.input}
              />
              <button type="submit" className={styles.btnAction}>
                Comprobar
              </button>
            </form>

            <div className={styles.statusRow}>
              <span>
                Pistas activas ahora: <strong>{activeNodes.length}</strong>
              </span>
              <span>
                Resueltas: <strong>{resolvedNodes.length} / {Object.keys(gameState.nodes).length}</strong>
              </span>
            </div>
          </div>

          {/* Nota editorial */}
          {puzzle.editorialNote && (
            <div className={styles.noteBox}>
              <strong>Nota editorial:</strong> {puzzle.editorialNote}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
