'use client'

import { useState, useEffect } from 'react'
import type { ClientPayload } from '@corchetes/core'
import styles from './EditClueModal.module.css'

export interface EditClueModalProps {
  isOpen: boolean
  onClose: () => void
  puzzleId: string
  clientPayload: ClientPayload
  onClueUpdated: (nodeId: string, newText: string) => void
}

export function EditClueModal({
  isOpen,
  onClose,
  puzzleId,
  clientPayload,
  onClueUpdated,
}: EditClueModalProps) {
  const nodeKeys = Object.keys(clientPayload.nodes)
  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodeKeys[0] || 'n1')
  const [clueText, setClueText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedNodeId && clientPayload.nodes[selectedNodeId]) {
      setClueText(clientPayload.nodes[selectedNodeId]?.clueText || '')
    }
  }, [selectedNodeId, clientPayload])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clueText.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/puzzles/${puzzleId}/clue`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'corchetes-admin-secret-dev-only',
        },
        body: JSON.stringify({
          nodeId: selectedNodeId,
          newClueText: clueText.trim(),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || `Error ${res.status} al guardar pista`)
      }

      onClueUpdated(selectedNodeId, clueText.trim())
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Editar Pista Inline</h2>
          <button type="button" onClick={onClose} className={styles.btnClose}>
            Cerrar
          </button>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="nodeSelect" className={styles.label}>
              Selecciona el corchete
            </label>
            <select
              id="nodeSelect"
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className={styles.select}
            >
              {nodeKeys.map((key) => {
                const node = clientPayload.nodes[key]
                return (
                  <option key={key} value={key}>
                    [{key}] — {node?.clueText.slice(0, 45)}... ({node?.type})
                  </option>
                )
              })}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="clueInput" className={styles.label}>
              Texto de la pista
            </label>
            <textarea
              id="clueInput"
              rows={3}
              value={clueText}
              onChange={(e) => setClueText(e.target.value)}
              className={styles.textarea}
              placeholder="Escribe el nuevo texto de la pista..."
            />
            <p className={styles.helpText}>
              Nota: Si este corchete tiene pistas hijas, asegúrate de mantener los placeholders como {'{{n2}}'}.
            </p>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={styles.btnCancel}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !clueText.trim()}
              className={styles.btnSubmit}
            >
              {loading ? 'Guardando...' : 'Guardar pista'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
