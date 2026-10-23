'use client'

import { useEffect, useState, useCallback, type ReactElement } from 'react'
import Link from 'next/link'
import {
  initPuzzleState,
  onSubmit,
  type PuzzleState,
} from '@corchetes/core'
import { sha256, aesGcmDecrypt } from '@corchetes/crypto'
import { ClueTree, InputBar, EndScreen, Masthead } from '@corchetes/ui'
import { apiClient, type CommunityPuzzleResponse } from '../../../src/api/client'
import styles from './page.module.css'

interface CommunityGameClientProps {
  shortId: string
}

export function CommunityGameClient({ shortId }: CommunityGameClientProps): ReactElement {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [communityData, setCommunityData] = useState<CommunityPuzzleResponse | null>(null)
  const [puzzleState, setPuzzleState] = useState<PuzzleState | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [justResolvedId, setJustResolvedId] = useState<string | null>(null)
  const [justUnlockedId, setJustUnlockedId] = useState<string | null>(null)
  const [lastAnswerWrong, setLastAnswerWrong] = useState(false)

  // ── 1. Cargar el puzle de la comunidad ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    apiClient
      .getCommunityPuzzle(shortId)
      .then((data) => {
        if (cancelled) return
        setCommunityData(data)
        const initial = initPuzzleState(data.clientPayload)
        setPuzzleState(initial)
        // Seleccionar primer nodo activo
        const firstActive = Object.values(initial.nodes).find((n) => n.isActive && !n.isResolved)
        if (firstActive) {
          setSelectedNodeId(firstActive.id)
        }
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'No se pudo cargar el reto de la comunidad.'
        setError(msg)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [shortId])

  // ── 2. Manejo de selección de nodo ─────────────────────────────────────────
  const handleSelectNode = useCallback(
    (id: string) => {
      if (!puzzleState) return
      const target = puzzleState.nodes[id]
      if (target?.isActive && !target.isResolved) {
        setSelectedNodeId(id)
        setLastAnswerWrong(false)
      }
    },
    [puzzleState],
  )

  // ── 3. Validación y resolución de respuesta ────────────────────────────────
  const handleSubmit = useCallback(
    async (answer: string) => {
      if (!puzzleState || !communityData) return

      const [result, nextState] = await onSubmit(
        answer,
        puzzleState,
        communityData.clientPayload.dailySalt,
        sha256,
        aesGcmDecrypt,
      )

      if (result.success && result.resolvedNodeId) {
        setJustResolvedId(result.resolvedNodeId)
        setTimeout(() => setJustResolvedId(null), 1200)

        // Comprobar si se desbloqueó algún nodo nuevo
        const newlyUnlocked = Object.values(nextState.nodes).find(
          (n) => n.isActive && !n.isResolved && n.id !== result.resolvedNodeId,
        )

        if (newlyUnlocked) {
          setJustUnlockedId(newlyUnlocked.id)
          setSelectedNodeId(newlyUnlocked.id)
          setTimeout(() => setJustUnlockedId(null), 1200)
        } else {
          // Si no hay nodo siguiente, mantener o seleccionar otro pendiente
          const anyPending = Object.values(nextState.nodes).find((n) => n.isActive && !n.isResolved)
          setSelectedNodeId(anyPending?.id ?? null)
        }

        // NOTA REGLA §6.2: Al ser una partida informal de comunidad,
        // NO enviamos petición de completeSession a la API oficial,
        // preservando intacta la racha y estadísticas del usuario.
        setPuzzleState(nextState)
        setLastAnswerWrong(false)
      } else {
        setLastAnswerWrong(true)
        setPuzzleState(nextState)
      }
    },
    [puzzleState, communityData],
  )

  if (loading) {
    return (
      <main className={styles.container}>
        <div className={styles.loadingArea}>
          <p>Localizando pliego en el archivo de la comunidad…</p>
        </div>
      </main>
    )
  }

  if (error || !puzzleState || !communityData) {
    return (
      <main className={styles.container}>
        <section className={styles.errorArea} role="alert">
          <h2>Reto no encontrado</h2>
          <p>{error || 'Este reto no existe o ha sido retirado de la comunidad.'}</p>
          <div className={styles.actionRow}>
            <Link href="/" className={styles.actionBtn}>
              Ir a la edición de hoy
            </Link>
            <Link href="/crear" className={styles.actionBtn}>
              Crear un nuevo reto
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const isCompleted = puzzleState.completedAt !== null
  const activeNode = selectedNodeId ? puzzleState.nodes[selectedNodeId] : null

  return (
    <main id="main-content" className={styles.container}>
      {/* ── Navegación superior ───────────────────────────────────────── */}
      <header className={styles.navHeader}>
        <Link href="/" className={styles.navLink}>
          ← Edición oficial del día
        </Link>
        <Link href="/crear" className={styles.navLink}>
          Crear tu propio reto →
        </Link>
      </header>

      {/* ── Cabecera hemerográfica ────────────────────────────────────── */}
      <Masthead editionLabel="RETO DE LA COMUNIDAD" />

      {/* ── Banner de partida informal ─────────────────────────────────── */}
      <aside className={styles.informalBanner} aria-label="Aviso de partida informal">
        <span className={styles.informalBadge}>Partida Informal</span>
        <span>
          Reto creado por <strong className={styles.creatorFmt}>{communityData.creatorAlias}</strong>
        </span>
        <span style={{ fontSize: '0.75rem' }}>No altera tu racha diaria oficial</span>
      </aside>

      {/* ── Árbol de corchetes ────────────────────────────────────────── */}
      <ClueTree
        rootTemplate={puzzleState.rootTemplate}
        nodes={puzzleState.nodes}
        quoteAuthor={puzzleState.quoteAuthor}
        quoteWork={puzzleState.quoteWork}
        quoteYear={puzzleState.quoteYear}
        selectedNodeId={selectedNodeId}
        justResolvedId={justResolvedId}
        justUnlockedId={justUnlockedId}
        onSelectNode={handleSelectNode}
      />

      {/* ── InputBar o Pantalla de Cierre ─────────────────────────────── */}
      {isCompleted ? (
        <section style={{ marginTop: 24 }}>
          <EndScreen state={puzzleState} percentile={null} />
          <div className={styles.actionRow} style={{ marginTop: 28 }}>
            <Link href="/crear" className={styles.actionBtn}>
              Componer mi propio reto
            </Link>
            <Link href="/" className={styles.actionBtn}>
              Volver a la edición diaria
            </Link>
          </div>
        </section>
      ) : (
        <>
          {activeNode && (
            <p className={styles.hintBar}>
              <em>Pista activa: </em>
              <strong>{activeNode.clueText.replace(/{{[^}]+}}/g, '[…]')}</strong>
            </p>
          )}

          <InputBar
            placeholder="Escribe tu respuesta…"
            disabled={isCompleted}
            isError={lastAnswerWrong}
            onSubmit={handleSubmit}
            sticky
          />

          {lastAnswerWrong && (
            <p className={styles.errorFeedback} role="alert">
              ✗ Respuesta incorrecta. Vuelve a intentarlo.
            </p>
          )}
        </>
      )}
    </main>
  )
}
