'use client'

import { useEffect, useCallback, type ReactElement } from 'react'
import { ClueTree, InputBar, EndScreen } from '@corchetes/ui'
import { usePuzzleStore } from '../store/usePuzzleStore'
import { usePuzzlePersistence, restoreTodayState } from '../store/usePuzzlePersistence'
import styles from './page.module.css'
import type { ClientPayload } from '@corchetes/core'

// ── Puzzle de demostración (sin cifrado real) ──────────────────────────────
// En producción, el payload llega de GET /api/puzzle/today con hashes reales.
// Aquí usamos hashes/cipher de mentira y un hashFn/decryptFn de demo.

const DEMO_PAYLOAD: ClientPayload = {
  puzzleId: 'demo-001',
  editionNumber: 142,
  publishDate: new Date().toISOString().slice(0, 10),
  rootTemplate: '«En un lugar de la {{n1}} de cuyo nombre no quiero acordarme...»',
  dailySalt: 'demo-salt',
  nodes: {
    n1: {
      id: 'n1',
      clueText: 'región histórica española donde cabalgaba el {{n2}}',
      children: ['n2'],
      parent: null,
      type: 'definition',
      solutionHash: 'hash_n1_mancha',
      solutionCipher: 'Mancha',
    },
    n2: {
      id: 'n2',
      clueText: 'hidalgo que desafió a los {{n3}}',
      children: ['n3'],
      parent: 'n1',
      type: 'definition',
      solutionHash: 'hash_n2_quijote',
      solutionCipher: 'Quijote',
    },
    n3: {
      id: 'n3',
      clueText: 'gigantes con aspas de viento',
      children: [],
      parent: 'n2',
      type: 'definition',
      solutionHash: 'hash_n3_molinos',
      solutionCipher: 'molinos',
    },
  },
  quoteAuthor: 'Miguel de Cervantes',
  quoteWork: 'Don Quijote de la Mancha',
  quoteYear: 1605,
  editorialNote:
    'Primera frase de la novela más influyente de la literatura hispana. ' +
    'El lugar innominado es hoy reivindicado por varios municipios de Castilla-La Mancha.',
}

// Funciones criptográficas de DEMO: comparan directamente por nombre conocido
async function demoHashFn(candidate: string): Promise<string> {
  if (candidate.startsWith('molinos:')) return 'hash_n3_molinos'
  if (candidate.startsWith('quijote:')) return 'hash_n2_quijote'
  if (candidate.startsWith('mancha:')) return 'hash_n1_mancha'
  return `__nomatch__${candidate}`
}

async function demoDecryptFn(cipher: string, _key: string): Promise<string> {
  // En demo, el cipher ya es el texto original
  return cipher
}

// ── Componente ─────────────────────────────────────────────────────────────

export function InteractiveTreeDemo(): ReactElement {
  // ── Activar persistencia en localStorage ─────────────────────────────
  usePuzzlePersistence()

  const {
    puzzleState,
    selectedNodeId,
    justResolvedId,
    justUnlockedId,
    lastAnswerWrong,
    loadPuzzle,
    submitAnswer,
    requestHint,
    setSelectedNode,
    resetGame,
  } = usePuzzleStore()

  // ── Cargar el puzzle al montar ─────────────────────────────────────
  useEffect(() => {
    // Intentar restaurar sesión guardada de hoy
    const saved = restoreTodayState()
    if (saved && saved.puzzleId === DEMO_PAYLOAD.puzzleId) {
      // Restaurar directamente en el store sin volver a pasar por loadPuzzle
      usePuzzleStore.setState({
        puzzleState: saved,
        selectedNodeId: Object.values(saved.nodes).find((n) => n.isActive)?.id ?? null,
      })
    } else {
      loadPuzzle(DEMO_PAYLOAD, demoHashFn, demoDecryptFn)
    }
  }, [loadPuzzle])

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (input: string) => {
      await submitAnswer(input)
    },
    [submitAnswer],
  )

  const handleMatrix = useCallback(() => {
    requestHint('matrix')
    // En demo: simplemente registra el evento en el store
  }, [requestHint])

  const handleReveal = useCallback(() => {
    if (!selectedNodeId || !puzzleState) return
    const node = puzzleState.nodes[selectedNodeId]
    if (!node) return
    // En demo el cipher es la solución directamente
    requestHint('reveal', node.solutionCipher)
  }, [requestHint, selectedNodeId, puzzleState])

  const handleReset = useCallback(() => {
    resetGame()
    // Volver a cargar el demo
    loadPuzzle(DEMO_PAYLOAD, demoHashFn, demoDecryptFn)
  }, [resetGame, loadPuzzle])

  // ── Render ────────────────────────────────────────────────────────────
  if (!puzzleState) return <div>Cargando…</div>

  const isCompleted = puzzleState.completedAt !== null
  const activeNode = selectedNodeId ? puzzleState.nodes[selectedNodeId] : null

  return (
    <section className={styles.quoteCard}>
      {/* ── ClueTree ──────────────────────────────────────────────────── */}
      <ClueTree
        rootTemplate={puzzleState.rootTemplate}
        nodes={puzzleState.nodes}
        quoteAuthor={puzzleState.quoteAuthor}
        quoteWork={puzzleState.quoteWork}
        quoteYear={puzzleState.quoteYear}
        selectedNodeId={selectedNodeId}
        justResolvedId={justResolvedId}
        justUnlockedId={justUnlockedId}
        onSelectNode={setSelectedNode}
      />

      {/* ── InputBar o EndScreen ──────────────────────────────────────── */}
      {isCompleted ? (
        <>
          <EndScreen state={puzzleState} />
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.resetButton}
              onClick={handleReset}
            >
              Jugar de nuevo
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Indicador del nodo seleccionado */}
          {activeNode && (
            <p className={styles.demoHint}>
              <em>Pista activa: </em>
              <strong>{activeNode.clueText.replace(/{{[^}]+}}/g, '[…]')}</strong>
            </p>
          )}

          <InputBar
            placeholder="Escribe tu respuesta…"
            expectedLength={activeNode ? undefined : undefined}
            disabled={isCompleted}
            isError={lastAnswerWrong}
            onSubmit={handleSubmit}
            onHintMatrix={handleMatrix}
            onHintReveal={handleReveal}
            sticky
          />

          {lastAnswerWrong && (
            <p className={styles.demoHint} role="alert" style={{ color: 'var(--color-alert)' }}>
              ✗ Respuesta incorrecta. Inténtalo de nuevo.
            </p>
          )}
        </>
      )}

      {/* ── Demo controls ─────────────────────────────────────────────── */}
      {!isCompleted && (
        <div className={styles.demoControls}>
          <p className={styles.demoHint}>
            💡 <em>Escribe la respuesta en el campo inferior o usa los atajos de demo:</em>
          </p>
          <div className={styles.buttonGroup}>
            {!puzzleState.nodes['n3']?.isResolved && (
              <button
                type="button"
                className={styles.demoButton}
                onClick={() => void handleSubmit('molinos')}
              >
                Resolver n3 → «molinos»
              </button>
            )}
            {puzzleState.nodes['n3']?.isResolved && !puzzleState.nodes['n2']?.isResolved && (
              <button
                type="button"
                className={styles.demoButton}
                onClick={() => void handleSubmit('Quijote')}
              >
                Resolver n2 → «Quijote»
              </button>
            )}
            {puzzleState.nodes['n2']?.isResolved && !puzzleState.nodes['n1']?.isResolved && (
              <button
                type="button"
                className={styles.demoButton}
                onClick={() => void handleSubmit('Mancha')}
              >
                Resolver n1 → «Mancha»
              </button>
            )}
            <button
              type="button"
              className={styles.resetButton}
              onClick={handleReset}
            >
              Reiniciar árbol
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
