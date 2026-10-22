'use client'

import { useState, useEffect } from 'react'
import type { ClientPayload } from '@corchetes/core'
import { DraftPreviewModal } from '../../src/components/DraftPreviewModal'
import { EditClueModal } from '../../src/components/EditClueModal'
import styles from './drafts.module.css'

export interface DraftPuzzleItem {
  id: string
  editionNumber: number
  publishDate: string
  status: string
  source: string
  quoteAuthor: string | null
  quoteWork: string | null
  quoteYear: number | null
  editorialNote: string | null
  maxDepth: number | null
  totalNodes: number | null
  initialLeaves: number | null
  rawMarkup: string
  clientPayload: ClientPayload
}

// Borrador inicial de demostración si la base de datos o API aún no tiene registros
const INITIAL_DEMO_DRAFT: DraftPuzzleItem = {
  id: 'demo-draft-1',
  editionNumber: 1,
  publishDate: '2026-10-23',
  status: 'DRAFT',
  source: 'AI',
  quoteAuthor: 'John F. Kennedy',
  quoteWork: 'Crisis de los Misiles',
  quoteYear: 1962,
  editorialNote: 'Discurso sobre el bloqueo naval a Cuba.',
  maxDepth: 2,
  totalNodes: 3,
  initialLeaves: 2,
  rawMarkup:
    'Un día como hoy, pero en 1962, [el mandatario demócrata que lidió con [la isla gobernada por Fidel]] anunció el [cerco marítimo] a Cuba.',
  clientPayload: {
    puzzleId: 'demo-draft-1',
    editionNumber: 1,
    publishDate: '2026-10-23',
    rootTemplate: 'Un día como hoy, pero en 1962, {{n1}} anunció el {{n3}} a Cuba.',
    nodes: {
      n1: {
        id: 'n1',
        clueText: 'el mandatario demócrata que lidió con {{n2}}',
        children: ['n2'],
        parent: null,
        type: 'reference',
        solutionHash: 'hash_n1',
        solutionCipher: 'John F. Kennedy',
      },
      n2: {
        id: 'n2',
        clueText: 'la isla gobernada por Fidel',
        children: [],
        parent: 'n1',
        type: 'definition',
        solutionHash: 'hash_n2',
        solutionCipher: 'Cuba',
      },
      n3: {
        id: 'n3',
        clueText: 'cerco marítimo',
        children: [],
        parent: null,
        type: 'definition',
        solutionHash: 'hash_n3',
        solutionCipher: 'bloqueo naval',
      },
    },
    dailySalt: 'salt-demo',
    quoteAuthor: 'John F. Kennedy',
    quoteWork: 'Crisis de los Misiles',
    quoteYear: 1962,
    editorialNote: 'Discurso sobre el bloqueo naval a Cuba.',
  },
}

export default function DraftsQueuePage() {
  const [drafts, setDrafts] = useState<DraftPuzzleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<string | null>(null)

  // Estado para los modales
  const [previewPuzzle, setPreviewPuzzle] = useState<DraftPuzzleItem | null>(null)
  const [editPuzzle, setEditPuzzle] = useState<DraftPuzzleItem | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  const fetchDrafts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/puzzles?status=DRAFT', {
        headers: {
          'x-admin-token': 'corchetes-admin-secret-dev-only',
        },
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          // Ordenar por publishDate ascendente
          data.sort((a: DraftPuzzleItem, b: DraftPuzzleItem) =>
            a.publishDate.localeCompare(b.publishDate),
          )
          setDrafts(data)
          return
        }
      }
      // Fallback a demo si el servidor no tiene elementos
      setDrafts([INITIAL_DEMO_DRAFT])
    } catch {
      setDrafts([INITIAL_DEMO_DRAFT])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDrafts()
  }, [])

  // Botón Aprobar: cambia a SCHEDULED
  const handleApprove = async (id: string, date: string) => {
    try {
      const res = await fetch(`/api/admin/puzzles/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'corchetes-admin-secret-dev-only',
        },
        body: JSON.stringify({ status: 'SCHEDULED' }),
      })

      if (res.ok) {
        setDrafts((prev) => prev.filter((d) => d.id !== id))
        setNotification(
          `Borrador para la fecha ${date} aprobado con éxito. Pasó a estado SCHEDULED.`,
        )
      } else {
        alert('Error al aprobar el puzle.')
      }
    } catch {
      // Optimistic update para demo local
      setDrafts((prev) => prev.filter((d) => d.id !== id))
      setNotification(`Borrador para la fecha ${date} aprobado (modo demo).`)
    }
  }

  // Botón Regenerar con IA
  const handleRegenerate = async (id: string) => {
    setRegeneratingId(id)
    try {
      const res = await fetch(`/api/admin/puzzles/${id}/regenerate`, {
        method: 'POST',
        headers: {
          'x-admin-token': 'corchetes-admin-secret-dev-only',
        },
      })

      if (res.ok) {
        setNotification('Puzle regenerado correctamente por la IA.')
        await fetchDrafts()
      } else {
        alert('No se pudo regenerar el puzle en este momento.')
      }
    } catch {
      alert('Error de conexión al solicitar regeneración.')
    } finally {
      setRegeneratingId(null)
    }
  }

  // Callback de edición inline de pista
  const handleClueUpdated = (nodeId: string, newText: string) => {
    if (!editPuzzle) return

    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id === editPuzzle.id) {
          const updatedNodes = { ...d.clientPayload.nodes }
          if (updatedNodes[nodeId]) {
            updatedNodes[nodeId] = {
              ...updatedNodes[nodeId],
              clueText: newText,
            }
          }
          return {
            ...d,
            clientPayload: {
              ...d.clientPayload,
              nodes: updatedNodes,
            },
          }
        }
        return d
      }),
    )

    setNotification(`Pista [${nodeId}] actualizada con éxito.`)
  }

  // Botón Generar lote semanal
  const handleBatchGenerate = async () => {
    const confirmed = confirm(
      '¿Deseas generar automáticamente los borradores de los próximos 3 días mediante el agente de efemérides?',
    )
    if (!confirmed) return

    setLoading(true)
    try {
      const res = await fetch('/api/generate/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'corchetes-admin-secret-dev-only',
        },
        body: JSON.stringify({ days: 3 }),
      })

      if (res.ok) {
        setNotification('Lote de efemérides generado satisfactoriamente.')
        await fetchDrafts()
      }
    } catch {
      alert('Error al ejecutar la generación en lote.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Cola de Borradores</h1>
          <p className={styles.subtitle}>
            Revisión, juego interactivo y aprobación de puzles generados por IA antes de su publicación.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handleBatchGenerate}
            className={styles.btnSecondary}
          >
            Generar lote con IA (3 días)
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
        <div className={styles.emptyState}>
          <p>Cargando borradores editoriales...</p>
        </div>
      ) : drafts.length === 0 ? (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>No hay borradores pendientes</h2>
          <p className={styles.emptyText}>
            Todos los puzles han sido aprobados o programados. Puedes generar nuevos borradores
            automáticos usando el extractor de efemérides.
          </p>
          <button
            type="button"
            onClick={handleBatchGenerate}
            className={styles.btnPrimary}
          >
            Generar nuevos puzles con IA
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {drafts.map((draft) => (
            <article key={draft.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.metaGroup}>
                  <span className={styles.dateBadge}>{draft.publishDate}</span>
                  <span className={styles.editionTag}>
                    Edición #{draft.editionNumber}
                  </span>
                  <span className={styles.sourceBadge}>{draft.source}</span>
                </div>

                <div className={styles.metrics}>
                  <span>
                    Profundidad: <strong>{draft.maxDepth ?? '2'} niv.</strong>
                  </span>
                  <span>
                    Corchetes: <strong>{draft.totalNodes ?? '3'}</strong>
                  </span>
                  <span>
                    Hojas iniciales: <strong>{draft.initialLeaves ?? '2'}</strong>
                  </span>
                </div>
              </div>

              <div>
                <p className={styles.quoteBlock}>
                  {draft.rawMarkup}
                </p>
                {draft.quoteAuthor && (
                  <p className={styles.authorLine}>
                    — {draft.quoteAuthor}
                    {draft.quoteYear ? ` (${draft.quoteYear})` : ''}
                    {draft.quoteWork ? `, ${draft.quoteWork}` : ''}
                  </p>
                )}
              </div>

              <div className={styles.cardActions}>
                <div className={styles.actionGroupLeft}>
                  <button
                    type="button"
                    onClick={() => setPreviewPuzzle(draft)}
                    className={styles.btnAction}
                  >
                    Vista previa / Jugar
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditPuzzle(draft)}
                    className={styles.btnAction}
                  >
                    Editar pista inline
                  </button>

                  <button
                    type="button"
                    disabled={regeneratingId === draft.id}
                    onClick={() => handleRegenerate(draft.id)}
                    className={styles.btnAction}
                  >
                    {regeneratingId === draft.id ? 'Regenerando...' : 'Regenerar con IA'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleApprove(draft.id, draft.publishDate)}
                  className={styles.btnApprove}
                >
                  Aprobar edición
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal de Vista Previa Interactiva con ClueTree */}
      {previewPuzzle && (
        <DraftPreviewModal
          isOpen={true}
          onClose={() => setPreviewPuzzle(null)}
          puzzle={previewPuzzle}
        />
      )}

      {/* Modal de Edición Inline de Pistas */}
      {editPuzzle && (
        <EditClueModal
          isOpen={true}
          onClose={() => setEditPuzzle(null)}
          puzzleId={editPuzzle.id}
          clientPayload={editPuzzle.clientPayload}
          onClueUpdated={handleClueUpdated}
        />
      )}
    </div>
  )
}
