'use client'

import { useEffect, useState, useCallback, type ReactElement } from 'react'
import Link from 'next/link'
import { ClueTree, InputBar, EndScreen, Masthead } from '@corchetes/ui'
import { sha256, aesGcmDecrypt } from '@corchetes/crypto'
import type { User } from '@supabase/supabase-js'
import { usePuzzleStore } from '../store/usePuzzleStore'
import { usePuzzlePersistence, restoreTodayState, clearTodayState } from '../store/usePuzzlePersistence'
import { apiClient } from '../src/api/client'
import { getOrCreateAnonymousId } from '../src/lib/anonymousSession'
import { getCurrentUser, onAuthStateChange } from '../src/lib/supabase'
import { AuthDrawer } from '../src/components/AuthDrawer'
import styles from './page.module.css'
import type { ClientPayload } from '@corchetes/core'
import {
  TUTORIAL_PAYLOAD,
  TODAY_PAYLOAD,
  TUTORIAL_SOLUTIONS,
  TODAY_SOLUTIONS,
} from '../src/data/puzzles'

// ── Funciones criptográficas seguras Web Crypto ─────────────────────────────

async function appHashFn(candidate: string): Promise<string> {
  return sha256(candidate)
}

async function appDecryptFn(cipher: string, key: string): Promise<string> {
  if (cipher.includes(':')) {
    try {
      const decrypted = await aesGcmDecrypt(cipher, key)
      return decrypted
    } catch {
      // Si falla AES-GCM, devolver el término en texto legible sin ciphertext
      return key
    }
  }
  return cipher
}

// ── Componente ─────────────────────────────────────────────────────────────

export function InteractiveTreeDemo(): ReactElement {
  // ── Activar persistencia en localStorage ─────────────────────────────
  usePuzzlePersistence()

  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [revealedMatrices, setRevealedMatrices] = useState<Record<string, string>>({})

  // Escuchar estado del usuario autenticado
  useEffect(() => {
    let mounted = true
    void getCurrentUser().then((user) => {
      if (mounted) setCurrentUser(user)
    })
    const { unsubscribe } = onAuthStateChange((_event, session) => {
      if (mounted) setCurrentUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  const {
    puzzleState,
    sessionId,
    percentile,
    selectedNodeId,
    justResolvedId,
    justUnlockedId,
    lastAnswerWrong,
    loadPuzzle,
    restorePuzzle,
    submitAnswer,
    requestHint,
    setSelectedNode,
    resetGame,
    completeCurrentSession,
  } = usePuzzleStore()

  // ── Modo de puzle activo ('tutorial' o 'daily') ───────────────────────
  const [activeEdition, setActiveEdition] = useState<'tutorial' | 'daily'>('tutorial')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDone = localStorage.getItem('corchetes_tutorial_completed') === 'true'
      if (isDone) {
        setActiveEdition('daily')
      }
    }
  }, [])

  // ── Inicializar puzle y sesión de juego ─────────────────────────────
  const initializeGame = useCallback(
    async (targetMode?: 'tutorial' | 'daily') => {
      const mode =
        targetMode ??
        (typeof window !== 'undefined' &&
        localStorage.getItem('corchetes_tutorial_completed') === 'true'
          ? 'daily'
          : 'tutorial')

      setActiveEdition(mode)

      // Sincronizar identidad anónima en localStorage y cookie HttpOnly
      const anonId = getOrCreateAnonymousId()
      try {
        void fetch('/api/auth/anonymous-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anonymousId: anonId }),
        })
      } catch {
        // Ignorar fallo de red en sincronización de cookie
      }

      // 1. Obtener el puzle correspondiente
      let payload: ClientPayload = mode === 'tutorial' ? TUTORIAL_PAYLOAD : TODAY_PAYLOAD
      if (mode === 'daily') {
        try {
          payload = await apiClient.getTodayPuzzle()
        } catch (err) {
          console.warn('Usando puzle diario canónico por indisponibilidad de la API:', err)
        }
      }

      // 2. Intentar restaurar sesión guardada si coincide con el puzzleId y template actuales
      const saved = restoreTodayState()
      const isTemplateCurrent =
        saved?.state?.rootTemplate === payload.rootTemplate

      if (saved && saved.state && saved.state.puzzleId === payload.puzzleId && isTemplateCurrent) {
        let currentSessionId = saved.sessionId

        if (!currentSessionId) {
          try {
            const sessionRes = await apiClient.startSession(saved.state.puzzleId, anonId)
            currentSessionId = sessionRes.sessionId
          } catch (err) {
            console.warn('No se pudo registrar sesión para el estado restaurado:', err)
          }
        }

        restorePuzzle(
          saved.state,
          payload.dailySalt,
          appHashFn,
          appDecryptFn,
          currentSessionId,
          saved.percentile,
        )

        if (saved.state.completedAt !== null && saved.percentile == null && currentSessionId) {
          void completeCurrentSession()
        }
        return
      }

      // Si había un estado guardado desactualizado o con otro puzzleId, limpiarlo
      if (saved && saved.state && (!isTemplateCurrent || saved.state.puzzleId !== payload.puzzleId)) {
        clearTodayState()
      }

      // 3. Iniciar sesión nueva en backend
      let newSessionId: string | null = null
      try {
        const sessionRes = await apiClient.startSession(payload.puzzleId, anonId)
        newSessionId = sessionRes.sessionId
      } catch (err) {
        console.warn('No se pudo iniciar sesión en backend:', err)
      }

      // 4. Cargar puzle nuevo en el store con contexto criptográfico
      loadPuzzle(payload, appHashFn, appDecryptFn, newSessionId)
    },
    [loadPuzzle, restorePuzzle, completeCurrentSession],
  )

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
    if (!selectedNodeId || !puzzleState) return

    let initialLetter = ''
    if (sessionId) {
      try {
        const res = await apiClient.requestHint(
          sessionId,
          selectedNodeId,
          'matrix',
          puzzleState.puzzleId,
        )
        if (res.success && res.hintType === 'matrix' && res.initialLetter) {
          initialLetter = res.initialLetter.toUpperCase()
        }
      } catch (err) {
        console.warn('Error al registrar pista en backend:', err)
      }
    }

    const currentSolutions =
      puzzleState.editionNumber === 0 ? TUTORIAL_SOLUTIONS : TODAY_SOLUTIONS
    const canonical = currentSolutions[selectedNodeId]
    if (!initialLetter && canonical) {
      initialLetter = canonical.charAt(0).toUpperCase()
    }

    const node = puzzleState.nodes[selectedNodeId]
    const cleanClue = node ? node.clueText.replace(/{{[^}]+}}/g, '[…]') : ''
    const lengthStr = canonical ? ` (${canonical.length} letras)` : ''

    const hintMessage = initialLetter
      ? `Inicial «${initialLetter}»${lengthStr} — ${cleanClue}`
      : cleanClue

    setRevealedMatrices((prev) => ({
      ...prev,
      [selectedNodeId]: hintMessage,
    }))

    requestHint('matrix')
  }, [requestHint, selectedNodeId, sessionId, puzzleState])

  const handleReveal = useCallback(async () => {
    if (!selectedNodeId || !puzzleState) return

    // Solicitar solución en texto plano al backend (POST /api/session/hint)
    if (sessionId) {
      try {
        const res = await apiClient.requestHint(
          sessionId,
          selectedNodeId,
          'reveal',
          puzzleState.puzzleId,
        )
        if (res.success && res.hintType === 'reveal') {
          requestHint('reveal', res.solution)
          return
        }
      } catch (err) {
        console.warn('Error al solicitar revelación al backend:', err)
      }
    }

    // Fallback limpio con el diccionario de soluciones canónicas
    const node = puzzleState.nodes[selectedNodeId]
    if (node) {
      const currentSolutions =
        puzzleState.editionNumber === 0 ? TUTORIAL_SOLUTIONS : TODAY_SOLUTIONS
      const cleanFallback =
        currentSolutions[selectedNodeId] ||
        (node.solutionCipher.includes(':') ? node.clueText : node.solutionCipher)
      requestHint('reveal', cleanFallback)
    }
  }, [requestHint, selectedNodeId, puzzleState, sessionId])

  const handleReset = useCallback(() => {
    clearTodayState()
    setRevealedMatrices({})
    resetGame()
    void initializeGame(activeEdition)
  }, [resetGame, initializeGame, activeEdition])

  // ── Render ────────────────────────────────────────────────────────────
  if (!puzzleState) return <div>Cargando…</div>

  const isCompleted = puzzleState.completedAt !== null
  const activeNode = selectedNodeId ? puzzleState.nodes[selectedNodeId] : null

  return (
    <>
      <Masthead
        editionNumber={puzzleState.editionNumber ?? 0}
        editionLabel={puzzleState.editionNumber === 0 ? 'EDICIÓN TUTORIAL' : 'EDICIÓN DIARIA'}
      />

      <section className={styles.quoteCard}>
        {/* ── Barra de lector / Selector de edición e identificación ─── */}
        <div className={styles.readerBar}>
          <div className={styles.readerBarLeft}>
            <button
              type="button"
              className={`${styles.readerButton} ${puzzleState.editionNumber === 0 ? styles.readerButtonActive : ''}`}
              onClick={() => {
                clearTodayState()
                setRevealedMatrices({})
                resetGame()
                void initializeGame('tutorial')
              }}
              aria-label="Jugar modo tutorial"
            >
              📖 Tutorial: Cómo jugar
            </button>
            <button
              type="button"
              className={`${styles.readerButton} ${puzzleState.editionNumber !== 0 ? styles.readerButtonActive : ''}`}
              onClick={() => {
                clearTodayState()
                setRevealedMatrices({})
                resetGame()
                void initializeGame('daily')
              }}
              aria-label="Jugar puzle oficial de hoy"
            >
              ⭐ Puzle de hoy (26 de Octubre)
            </button>
            <button
              type="button"
              className={styles.readerButton}
              onClick={handleReset}
              aria-label="Reiniciar árbol del puzle actual"
            >
              [↺ Reiniciar]
            </button>
            <Link
              href="/crear"
              className={styles.readerButton}
              style={{ textDecoration: 'none' }}
            >
              [+ Crear reto]
            </Link>
          </div>
          <div className={styles.readerBarRight}>
            <button
              type="button"
              className={styles.readerButton}
              onClick={() => setIsAuthOpen(true)}
              aria-label={currentUser ? 'Ver perfil de lector' : 'Acceder o guardar racha'}
            >
              {currentUser ? (
                <>
                  <span className={styles.readerActiveDot}>·</span>
                  <span>{currentUser.email}</span>
                </>
              ) : (
                <span>[Guardar racha / Identifícate]</span>
              )}
            </button>
          </div>
        </div>

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
            <EndScreen state={puzzleState} percentile={percentile} hideQuote />
            <div className={styles.buttonGroup}>
              {puzzleState.editionNumber === 0 ? (
                <button
                  type="button"
                  className={styles.primaryActionButton}
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('corchetes_tutorial_completed', 'true')
                    }
                    clearTodayState()
                    setRevealedMatrices({})
                    resetGame()
                    void initializeGame('daily')
                  }}
                >
                  Comenzar la Edición de Hoy (26 de Octubre) →
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={handleReset}
                >
                  Jugar de nuevo
                </button>
              )}
              {!currentUser && (
                <button
                  type="button"
                  className={styles.demoButton}
                  onClick={() => setIsAuthOpen(true)}
                >
                  Guardar racha en tu cuenta
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <hr className={styles.inputDivider} />

            {/* Notificación de Matriz revelada (solo si el jugador solicita matriz) */}
            {activeNode && revealedMatrices[activeNode.id] && (
              <div className={styles.matrixHintNotice} role="status">
                <span className={styles.matrixHintLabel}>Matriz:</span>{' '}
                {revealedMatrices[activeNode.id]}
              </div>
            )}

            <InputBar
              placeholder="Escribe tu respuesta…"
              disabled={isCompleted}
              isError={lastAnswerWrong}
              onSubmit={handleSubmit}
              onHintMatrix={handleMatrix}
              onHintReveal={handleReveal}
              sticky
            />

            {lastAnswerWrong && (
              <p className={styles.errorMessage} role="alert">
                ✗ Respuesta incorrecta. Inténtalo de nuevo.
              </p>
            )}
          </>
        )}

        {/* ── Drawer de identificación y guardado de racha ─────────────── */}
        <AuthDrawer
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onUserChange={setCurrentUser}
        />
      </section>
    </>
  )
}
