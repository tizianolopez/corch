'use client'

import { useState, useCallback, type ReactElement } from 'react'
import { generateCronica, getRank, type PuzzleState } from '@corchetes/core'
import styles from './EndScreen.module.css'

// ── Helpers ────────────────────────────────────────────────────────────────

const RANK_ICONS: Record<string, string> = {
  'Gran Maestro': '⬛',
  'Maestro': '◼',
  'Cronista': '◾',
  'Escriba': '▪',
  'Aprendiz': '▫',
}

/** Calcula la precisión en porcentaje */
function calcPrecision(state: PuzzleState): number {
  const totalNodes = Object.values(state.nodes).length
  if (totalNodes === 0) return 100
  const totalAttempts = state.mistakesCount + totalNodes
  return Math.round((totalNodes / totalAttempts) * 100)
}

/** Formatea una duración en ms como «02m 18s» */
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min.toString().padStart(2, '0')}m ${sec.toString().padStart(2, '0')}s`
}

/** Mapea el rango a un porcentaje para las barras (Gran Maestro = 100 %) */
function rankToPercent(rank: string): number {
  const map: Record<string, number> = {
    'Gran Maestro': 100,
    'Maestro': 80,
    'Cronista': 60,
    'Escriba': 40,
    'Aprendiz': 20,
  }
  return map[rank] ?? 0
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface EndScreenProps {
  /** Estado completado del puzzle */
  state: PuzzleState
  /** Texto de la cita completa (si se quiere mostrar diferente del rootTemplate) */
  quoteText?: string
}

/**
 * Pantalla de cierre de edición.
 * Se muestra cuando state.completedAt !== null.
 * Muestra la cita completa, metadata, métricas y el botón «Copiar crónica».
 */
export function EndScreen({ state, quoteText }: EndScreenProps): ReactElement {
  const [copied, setCopied] = useState(false)

  const rank = getRank(state.score)
  const precision = calcPrecision(state)
  const duration = state.completedAt
    ? formatDuration(state.completedAt - state.startedAt)
    : '—'

  const handleCopy = useCallback(async () => {
    try {
      const cronica = generateCronica(state)
      await navigator.clipboard.writeText(cronica)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: execCommand para iOS Safari
      try {
        const cronica = generateCronica(state)
        const el = document.createElement('textarea')
        el.value = cronica
        el.style.position = 'absolute'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Ignorar silenciosamente
      }
    }
  }, [state])

  return (
    <section className={styles.endScreen} aria-label="Resultado de la edición">

      {/* ── Cita completa ─────────────────────────────────────────────── */}
      <div className={styles.quoteSection}>
        <p className={styles.quoteText} lang="es">
          {quoteText ?? state.rootTemplate}
        </p>
        <p className={styles.quoteAttribution}>
          — {state.quoteAuthor},{' '}
          <em>{state.quoteWork}</em>
          {state.quoteYear > 0 && ` (${state.quoteYear.toString()})`}
        </p>
      </div>

      {/* ── Nota editorial ────────────────────────────────────────────── */}
      {state.editorialNote && (
        <p className={styles.editorialNote}>{state.editorialNote}</p>
      )}

      {/* ── Métricas ──────────────────────────────────────────────────── */}
      <div className={styles.metricsSection} aria-label="Tus estadísticas">
        <p className={styles.metricsTitle}>Estadísticas</p>

        {/* Tiempo */}
        <div className={styles.metricRow}>
          <div className={styles.metricLabel}>
            <span>Tiempo</span>
            <span className={styles.metricValue}>{duration}</span>
          </div>
          <div className={styles.metricBar} role="presentation">
            <div
              className={styles.metricBarFill}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Precisión */}
        <div className={styles.metricRow}>
          <div className={styles.metricLabel}>
            <span>Precisión</span>
            <span className={styles.metricValue}>{precision} %</span>
          </div>
          <div className={styles.metricBar} role="presentation">
            <div
              className={styles.metricBarFill}
              style={{ width: `${precision}%` }}
            />
          </div>
        </div>

        {/* Rango */}
        <div className={styles.metricRow}>
          <div className={styles.metricLabel}>
            <span>Rango</span>
            <span className={[styles.metricValue, styles.rankBadge].join(' ')}>
              <span className={styles.rankIcon} aria-hidden="true">
                {RANK_ICONS[rank] ?? '■'}
              </span>
              {rank}
            </span>
          </div>
          <div className={styles.metricBar} role="presentation">
            <div
              className={[styles.metricBarFill, styles.metricBarFillRank].join(' ')}
              style={{ width: `${rankToPercent(rank)}%` }}
            />
          </div>
        </div>

        {/* Placeholder percentil (Fase 3) */}
        <p className={styles.percentilePlaceholder} aria-live="polite">
          Comparativa con otros jugadores disponible próximamente.
        </p>
      </div>

      {/* ── Copiar crónica ────────────────────────────────────────────── */}
      <button
        id="corchetes-copy-cronica-btn"
        className={[
          styles.copyBtn,
          copied ? styles.copyBtnDone : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={handleCopy}
        aria-label="Copiar resultado al portapapeles"
      >
        {copied ? '✓ Crónica copiada' : 'Copiar crónica'}
      </button>
    </section>
  )
}
