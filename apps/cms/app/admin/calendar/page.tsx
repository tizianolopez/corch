'use client'

import { useState, useEffect } from 'react'
import type { ClientPayload } from '@corchetes/core'
import styles from './calendar.module.css'

export interface CalendarPuzzle {
  id: string
  editionNumber: number
  publishDate: string
  status: string
  source: string
  quoteAuthor: string | null
  quoteWork: string | null
  quoteYear: number | null
  rawMarkup: string
  clientPayload?: ClientPayload
}

export interface DaySlot {
  dateStr: string
  dayName: string
  isToday: boolean
  puzzle?: CalendarPuzzle
}

/**
 * Genera la lista de los próximos N días a partir de una fecha base.
 */
export function generateDaySlots(baseDate: Date = new Date(), count = 7): DaySlot[] {
  const slots: DaySlot[] = []
  const todayStr = new Date().toISOString().split('T')[0] || ''

  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate)
    d.setDate(baseDate.getDate() + i)
    const dateStr = d.toISOString().split('T')[0] || ''
    const dayName = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })

    slots.push({
      dateStr,
      dayName,
      isToday: dateStr === todayStr,
    })
  }

  return slots
}

export default function CalendarPage() {
  const [puzzles, setPuzzles] = useState<CalendarPuzzle[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  const fetchPuzzles = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/puzzles', {
        headers: {
          'x-admin-token': 'corchetes-admin-secret-dev-only',
        },
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setPuzzles(data)
          return
        }
      }
      setPuzzles([])
    } catch {
      setPuzzles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPuzzles()
  }, [])

  const slots = generateDaySlots(new Date(), 7).map((slot) => {
    const puzzle = puzzles.find((p) => p.publishDate === slot.dateStr)
    return { ...slot, puzzle }
  })

  // Ejecuta la publicación de las 00:00 h bajo demanda
  const handlePublishNow = async () => {
    setPublishing(true)
    try {
      const res = await fetch('/api/admin/publish-scheduled', {
        method: 'POST',
        headers: {
          'x-admin-token': 'corchetes-admin-secret-dev-only',
        },
      })

      if (res.ok) {
        const data = await res.json()
        setNotification(
          `Publicación diaria ejecutada: ${data.publishedCount} puzle(s) pasaron a PUBLISHED.` +
            (data.cacheInvalidated ? ' Caché de Cloudflare invalidada correctamente.' : ''),
        )
        await fetchPuzzles()
      } else {
        alert('Error al ejecutar la publicación programada.')
      }
    } catch {
      alert('Error de conexión al solicitar publicación.')
    } finally {
      setPublishing(false)
    }
  }

  // Genera un puzle para un día vacío
  const handleGenerateForDay = async (dateStr: string) => {
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'corchetes-admin-secret-dev-only',
        },
        body: JSON.stringify({ publishDate: dateStr }),
      })

      if (res.ok) {
        setNotification(`Puzle para la fecha ${dateStr} generado con éxito en estado DRAFT.`)
        await fetchPuzzles()
      } else {
        alert('No se pudo generar el puzle para esa fecha.')
      }
    } catch {
      alert('Error al comunicarse con la API de generación.')
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Calendario de Publicación</h1>
          <p className={styles.subtitle}>
            Programación semanal de las ediciones de Corchetes y control de publicación automática.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            disabled={publishing}
            onClick={handlePublishNow}
            className={styles.btnPublishNow}
          >
            {publishing ? 'Publicando...' : 'Publicar ediciones de hoy ahora (00:00 h)'}
          </button>
        </div>
      </div>

      {notification && (
        <div className={styles.notification}>
          <span>{notification}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <p>Cargando calendario editorial...</p>
      ) : (
        <div className={styles.calendarGrid}>
          {slots.map((slot) => (
            <div key={slot.dateStr} className={styles.dayCard}>
              <div className={styles.dayHeader}>
                <div>
                  <span className={styles.dayName}>{slot.dayName}</span>
                  {slot.isToday && (
                    <span className={styles.todayIndicator}>Hoy</span>
                  )}
                </div>
                <span className={styles.dayDate}>{slot.dateStr}</span>
              </div>

              {slot.puzzle ? (
                <div className={styles.puzzleContent}>
                  <span
                    className={
                      slot.puzzle.status === 'PUBLISHED'
                        ? styles.statusPublished
                        : styles.statusScheduled
                    }
                  >
                    {slot.puzzle.status} · #{slot.puzzle.editionNumber}
                  </span>

                  <p className={styles.puzzleQuote}>{slot.puzzle.rawMarkup}</p>

                  {slot.puzzle.quoteAuthor && (
                    <p className={styles.puzzleAuthor}>
                      — {slot.puzzle.quoteAuthor}
                      {slot.puzzle.quoteYear ? ` (${slot.puzzle.quoteYear})` : ''}
                    </p>
                  )}
                </div>
              ) : (
                <div className={styles.emptyDay}>
                  <p className={styles.emptyLabel}>Sin edición asignada</p>
                  <button
                    type="button"
                    onClick={() => handleGenerateForDay(slot.dateStr)}
                    className={styles.btnAssign}
                  >
                    Generar con IA
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
