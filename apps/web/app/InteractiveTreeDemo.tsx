'use client'

import { useEffect, useCallback, type ReactElement } from 'react'
import { ClueTree, InputBar, EndScreen } from '@corchetes/ui'
import { sha256, aesGcmDecrypt } from '@corchetes/crypto'
import { usePuzzleStore } from '../store/usePuzzleStore'
import { usePuzzlePersistence, restoreTodayState } from '../store/usePuzzlePersistence'
import { apiClient } from '../src/api/client'
import styles from './page.module.css'
import type { ClientPayload } from '@corchetes/core'

// ── Puzzle de demostración (fallback si la API está desconectada) ───────────

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

// ── Funciones criptográficas seguras (con soporte para fallback demo) ───────

async function appHashFn(candidate: string): Promise<string> {
  if (candidate.startsWith('molinos:')) return 'hash_n3_molinos'
  if (candidate.startsWith('quijote:')) return 'hash_n2_quijote'
  if (candidate.startsWith('mancha:')) return 'hash_n1_mancha'
  return sha256(candidate)
}

async function appDecryptFn(cipher: string, key: string): Promise<string> {
  if (cipher.includes(':')) {
    try {
      return await aesGcmDecrypt(cipher, key)
    } catch {
      // Si falla AES-GCM, devolver directamente
    }
  }
  return cipher
}

// ── Componente ─────────────────────────────────────────────────────────────

export function InteractiveTreeDemo(): ReactElement {
  // ── Activar persistencia en localStorage ─────────────────────────────
  usePuzzlePersistence()

  const {
    puzzleState,
    sessionId,
    percentile,
    selectedNodeId,
    justResolvedId,
    justUnlockedId,
    lastAnswerWrong,
    loadPuzzle,
    submitAnswer,
    requestHint,
    setSelectedNode,
    resetGame,
    completeCurrentSession,
  } = usePuzzleStore()

  // ── Inicializar puzle y sesión de juego ─────────────────────────────
  const initializeGame = useCallback(async () => {
    // 1. Intentar restaurar sesión guardada de hoy
    const saved = restoreTodayState()
    if (saved && saved.state) {
      let currentSessionId = saved.sessionId

      // Si no tenía sessionId asignado (guardado previo), crear uno nuevo
      if (!currentSessionId) {
        try {
          const sessionRes = await apiClient.startSession(saved.state.puzzleId)
          currentSessionId = sessionRes.sessionId
        } catch (err) {
          console.warn('No se pudo registrar sesión para el estado restaurado:', err)
        }
      }

      usePuzzleStore.setState({
        puzzleState: saved.state,
        sessionId: currentSessionId,
        percentile: saved.percentile,
        selectedNodeId: Object.values(saved.state.nodes).find((n) => n.isActive)?.id ?? null,
      })

      // Si ya estaba completado pero no tenía percentil, intentar sincronizar
      if (saved.state.completedAt !== null && saved.percentile == null && currentSessionId) {
        void completeCurrentSession()
      }
      return
    }

    // 2. Si no hay estado previo, obtener el puzle del día del backend
    let payload = DEMO_PAYLOAD
    try {
      payload = await apiClient.getTodayPuzzle()
    } catch (err) {
      console.warn('Usando puzle demo por indisponibilidad de la API:', err)
    }

    // 3. Crear play_session en backend (POST /api/session/start)
    let newSessionId: string | null = null
    try {
      const sessionRes = await apiClient.startSession(payload.puzzleId)
      newSessionId = sessionRes.sessionId
    } catch (err) {
      console.warn('No se pudo iniciar sesión en backend:', err)
    }

    // 4. Cargar puzle en el store
    loadPuzzle(payload, appHashFn, appDecryptFn, newSessionId)
  }, [loadPuzzle, completeCurrentSession])

  useEffect(() => {
    void initializeGame()
  }, [initializeGame])

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (input: string) => {
      await submitAnswer(input)
    },
    [submitAnswer],
  )

  const handleMatrix = useCallback(async () => {
    if (!selectedNodeId) return

    if (sessionId) {
      try {
        await apiClient.requestHint(sessionId, selectedNodeId, 'matrix')
      } catch (err) {
        console.warn('Error al registrar pista en backend:', err)
      }
    }

    requestHint('matrix')
  }, [requestHint, selectedNodeId, sessionId])

  const handleReveal = useCallback(async () => {
    if (!selectedNodeId || !puzzleState) return

    // Solicitar solución en texto plano al backend (POST /api/session/hint)
    if (sessionId) {
      try {
        const res = await apiClient.requestHint(sessionId, selectedNodeId, 'reveal')
        if (res.success && res.hintType === 'reveal') {
          requestHint('reveal', res.solution)
          return
        }
      } catch (err) {
        console.warn('Error al solicitar revelación al backend:', err)
      }
    }

    // Fallback si la API no está disponible
    const node = puzzleState.nodes[selectedNodeId]
    if (node) {
      requestHint('reveal', node.solutionCipher)
    }
  }, [requestHint, selectedNodeId, puzzleState, sessionId])

  const handleReset = useCallback(() => {
    resetGame()
    void initializeGame()
  }, [resetGame, initializeGame])

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
          <EndScreen state={puzzleState} percentile={percentile} />
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
