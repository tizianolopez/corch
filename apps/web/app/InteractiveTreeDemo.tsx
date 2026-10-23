'use client'

import { useEffect, useState, useCallback, type ReactElement } from 'react'
import Link from 'next/link'
import { ClueTree, InputBar, EndScreen, Masthead } from '@corchetes/ui'
import { sha256, aesGcmDecrypt } from '@corchetes/crypto'
import type { User } from '@supabase/supabase-js'
import { usePuzzleStore } from '../store/usePuzzleStore'
import { usePuzzlePersistence, restoreTodayState } from '../store/usePuzzlePersistence'
import { apiClient } from '../src/api/client'
import { getOrCreateAnonymousId } from '../src/lib/anonymousSession'
import { getCurrentUser, onAuthStateChange } from '../src/lib/supabase'
import { AuthDrawer } from '../src/components/AuthDrawer'
import styles from './page.module.css'
import type { ClientPayload } from '@corchetes/core'

// ── Puzzle canónico de lanzamiento (Edición 1: Pelé 1940) ───────────────────

const DEMO_PAYLOAD: ClientPayload = {
  puzzleId: 'corchetes-daily-2026-10-23',
  editionNumber: 1,
  publishDate: '2026-10-23',
  rootTemplate: 'Un día como hoy, pero en 1940, nace en {{n1}} el {{n2}}, recordado por anotar más de mil {{n4}}.',
  dailySalt: 'salt-2026-10-23',
  nodes: {
    n1: {
      id: 'n1',
      clueText: 'la patria de la samba y el carnaval',
      children: [],
      parent: null,
      type: 'reference',
      solutionHash: '88c1ed0828cfc28d5b785f2c440034c543225dcd9c5da5a7b280e500f862641f',
      solutionCipher: '6b8cf57d28e3b26686736dca:84BGpbtTaPrXXabFQO1j8NP5RaYhRg==',
    },
    n2: {
      id: 'n2',
      clueText: 'delantero de Santos que alzó tres {{n3}}',
      children: ['n3'],
      parent: null,
      type: 'reference',
      solutionHash: 'ff5a727fd01736936f8f8dc11295de87b1d51051daea35e9a61501eb8eddb202',
      solutionCipher: 'cf4ecd65555160f27f0b4b6a:avQQfyoJQZqHIjj+YjC9yFcswtSr',
    },
    n3: {
      id: 'n3',
      clueText: 'campeonatos universales de selecciones de fútbol',
      children: [],
      parent: 'n2',
      type: 'definition',
      solutionHash: '184db3b5b3fb585bd5a72c0ab0618bab8ad7df4e9372d889601209a99c19a931',
      solutionCipher: 'a87b31b603b13b056b53d568:85pBKsEy0xE7WkZmJJZCe+mbDTCMs5Wmng==',
    },
    n4: {
      id: 'n4',
      clueText: 'tantos introducidos en la portería',
      children: [],
      parent: null,
      type: 'definition',
      solutionHash: 'be5ef6e06b65b7327fd89c493cd39493c3df89c45c08d86fa0578339b4c22242',
      solutionCipher: '7c6fece1a5c68f2fe6c8bf5e:tX/uF555J1fOQ0+lA2aQhO1s/9s=',
    },
  },
  quoteAuthor: 'Efeméride deportiva y cultural',
  quoteWork: 'Nacimiento de Edson Arantes do Nascimento (Pelé)',
  quoteYear: 1940,
  editorialNote:
    'Un día como hoy en 1940 nace Pelé en Três Corações, coronado como "O Rei" y tricampeón mundial.',
}

// ── Funciones criptográficas seguras Web Crypto ─────────────────────────────

async function appHashFn(candidate: string): Promise<string> {
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

  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

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
    submitAnswer,
    requestHint,
    setSelectedNode,
    resetGame,
    completeCurrentSession,
  } = usePuzzleStore()

  // ── Inicializar puzle y sesión de juego ─────────────────────────────
  const initializeGame = useCallback(async () => {
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

    // 1. Intentar restaurar sesión guardada de hoy
    const saved = restoreTodayState()
    if (saved && saved.state) {
      let currentSessionId = saved.sessionId

      // Si no tenía sessionId asignado (guardado previo), crear uno nuevo
      if (!currentSessionId) {
        try {
          const sessionRes = await apiClient.startSession(saved.state.puzzleId, anonId)
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
      const sessionRes = await apiClient.startSession(payload.puzzleId, anonId)
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
    <>
      <Masthead editionNumber={puzzleState.editionNumber ?? 1} />

      <section className={styles.quoteCard}>
      {/* ── Barra de lector / Identificación ─────────────────────────── */}
      <div className={styles.readerBar}>
        <Link
          href="/crear"
          className={styles.readerButton}
          style={{ textDecoration: 'none' }}
        >
          [+ Crear reto propio]
        </Link>
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

      {/* ── Controles auxiliares ─────────────────────────────────────── */}
      {!isCompleted && (
        <div className={styles.demoControls}>
          <div className={styles.buttonGroup}>
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
