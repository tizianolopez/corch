'use client'

import { useState, useMemo, useCallback, type ReactElement } from 'react'
import Link from 'next/link'
import { parsePuzzleMarkup } from '@corchetes/core'
import { apiClient } from '../../src/api/client'
import styles from './page.module.css'

interface NodeConfig {
  solution: string
  type: 'definition' | 'morphological' | 'charade' | 'reference'
}

const DEFAULT_MARKUP =
  'En un lugar de la [región histórica donde cabalgaba Don Quijote|Mancha], de cuyo [designación apelativa|nombre] no quiero acordarme...'

export function CrearRetoClient(): ReactElement {
  const [markup, setMarkup] = useState(DEFAULT_MARKUP)
  const [creatorAlias, setCreatorAlias] = useState('')
  const [quoteAuthor, setQuoteAuthor] = useState('Miguel de Cervantes')
  const [quoteWork, setQuoteWork] = useState('Don Quijote de la Mancha')
  const [quoteYear, setQuoteYear] = useState<string>('1605')
  const [nodeConfigs, setNodeConfigs] = useState<Record<string, NodeConfig>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [published, setPublished] = useState<{ shortId: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // ── 1. Parseo en tiempo real del markup con Corchetes ───────────────────────
  const parsed = useMemo(() => {
    try {
      if (!markup || markup.trim().length === 0) {
        return { valid: false, error: 'Escribe una frase con al menos un corchete [pista]', tree: null }
      }
      const tree = parsePuzzleMarkup(markup)
      const nodeKeys = Object.keys(tree.nodes)
      if (nodeKeys.length === 0) {
        return { valid: false, error: 'Introduce al menos un corchete con pista: [pista]', tree: null }
      }
      return { valid: true, error: null, tree }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error en la sintaxis de corchetes'
      return { valid: false, error: message, tree: null }
    }
  }, [markup])

  // ── 2. Extraer o actualizar soluciones de los nodos ────────────────────────
  const nodesList = useMemo(() => {
    if (!parsed.tree) return []
    return Object.entries(parsed.tree.nodes).map(([id, node]) => {
      let inlineSolution = ''
      let clue = node.clueText
      if (clue.includes('|')) {
        const parts = clue.split('|')
        clue = parts[0]?.trim() ?? ''
        inlineSolution = parts.slice(1).join('|').trim()
      }

      const currentConfig = nodeConfigs[id]
      const currentSolution = currentConfig?.solution !== undefined ? currentConfig.solution : inlineSolution
      const currentType = currentConfig?.type ?? 'definition'

      return {
        id,
        clueText: clue,
        children: node.children,
        parent: node.parent,
        solution: currentSolution,
        type: currentType,
      }
    })
  }, [parsed.tree, nodeConfigs])

  const handleSolutionChange = useCallback((id: string, solution: string) => {
    setNodeConfigs((prev) => ({
      ...prev,
      [id]: {
        type: prev[id]?.type ?? 'definition',
        solution,
      },
    }))
  }, [])

  const handleTypeChange = useCallback((id: string, type: NodeConfig['type']) => {
    setNodeConfigs((prev) => ({
      ...prev,
      [id]: {
        solution: prev[id]?.solution ?? '',
        type,
      },
    }))
  }, [])

  // ── 3. Publicación del reto a través de la API ──────────────────────────────
  const handlePublish = async () => {
    setErrorMsg(null)

    if (!parsed.valid || !parsed.tree) {
      setErrorMsg(parsed.error || 'Corrige los errores antes de publicar.')
      return
    }

    // Comprobar que todas las soluciones están rellenas
    for (const node of nodesList) {
      if (!node.solution || node.solution.trim().length === 0) {
        setErrorMsg(`Falta rellenar la solución para el corchete "${node.id}".`)
        return
      }
    }

    setIsSubmitting(true)
    try {
      const yearNum = quoteYear ? parseInt(quoteYear, 10) : undefined
      const payloadNodes = nodesList.map((n) => ({
        id: n.id,
        solution: n.solution.trim(),
        type: n.type,
      }))

      const res = await apiClient.createCommunityPuzzle({
        markup,
        creatorAlias: creatorAlias.trim() || 'Lector anónimo',
        quoteAuthor: quoteAuthor.trim() || 'Cita de la comunidad',
        quoteWork: quoteWork.trim() || 'Reto de la comunidad',
        quoteYear: isNaN(yearNum as number) ? undefined : yearNum,
        nodes: payloadNodes,
      })

      setPublished({ shortId: res.shortId, url: res.url })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al publicar el reto en la comunidad.'
      setErrorMsg(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── 4. Copiar enlace ────────────────────────────────────────────────────────
  const handleCopyLink = async () => {
    if (!published) return
    const fullUrl = `${window.location.origin}${published.url}`
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <main id="main-content" className={styles.container}>
      {/* ── Navegación superior ───────────────────────────────────────── */}
      <header className={styles.navHeader}>
        <Link href="/" className={styles.backLink}>
          ← Volver a la edición diaria
        </Link>
        <span className={styles.workshopTag}>Taller Literario UGC</span>
      </header>

      {/* ── Título principal ──────────────────────────────────── */}
      <div className={styles.titleArea}>
        <h1 className={styles.mainTitle}>Creador de Retos</h1>
        <p className={styles.subtitle}>
          Compón tu propio enigma léxico con corchetes anidados y compártelo con otros lectores
        </p>
        <div className={styles.dividerDouble} aria-hidden="true">
          <div className={styles.ruleThick} />
          <div className={styles.ruleThin} />
        </div>
      </div>

      {published ? (
        /* ── Pantalla de éxito tras publicar ───────────────────────── */
        <section className={styles.successCard} aria-live="polite">
          <span className={styles.successStamp}>Pliego Registrado en Archivo</span>
          <h2 className={styles.successTitle}>¡Reto Publicado con Éxito!</h2>
          <p className={styles.successDesc}>
            Tu reto ya está listo para ser resuelto. Copia el enlace único y compártelo con
            tus amigos o en redes sociales:
          </p>

          <div className={styles.linkBox}>
            <span className={styles.urlText}>
              {typeof window !== 'undefined' ? `${window.location.origin}${published.url}` : published.url}
            </span>
            <button
              type="button"
              className={[styles.copyBtn, copied ? styles.copyBtnDone : ''].join(' ')}
              onClick={handleCopyLink}
            >
              {copied ? '✓ Enlace copiado' : 'Copiar enlace'}
            </button>
          </div>

          <div className={styles.successActionRow}>
            <Link href={published.url} className={styles.playBtn}>
              Jugar mi reto ahora →
            </Link>
            <button
              type="button"
              className={styles.newChallengeBtn}
              onClick={() => {
                setPublished(null)
                setMarkup('')
                setNodeConfigs({})
              }}
            >
              Crear otro reto
            </button>
          </div>
        </section>
      ) : (
        /* ── Taller de composición ──────────────────────────────────── */
        <div className={styles.workshopGrid}>
          {/* Columna Izquierda: Formulario de redacción */}
          <section className={styles.editorSection}>
            <div className={styles.formCard}>
              <h2 className={styles.sectionHeader}>
                <span>1. Frase con corchetes</span>
                <span>Markup</span>
              </h2>
              <p className={styles.instructionText}>
                Escribe tu cita usando corchetes. Puedes anidar pistas dentro de otras con{' '}
                <code className={styles.instructionCode}>[pista externa [pista interna]]</code>. Si
                lo deseas, puedes indicar la solución directamente con una barra vertical:{' '}
                <code className={styles.instructionCode}>[pista|solución]</code>.
              </p>

              <textarea
                id="markup-textarea"
                className={styles.markupTextarea}
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
                placeholder="«En un lugar de la [pista|solución]...»"
                aria-label="Markup del puzle con corchetes"
              />

              {/* Errores de sintaxis */}
              {!parsed.valid && (
                <div className={styles.errorBanner} role="alert" style={{ marginTop: 12 }}>
                  {parsed.error}
                </div>
              )}
            </div>

            {/* Configuración de nodos detectados */}
            {nodesList.length > 0 && (
              <div className={styles.formCard}>
                <h2 className={styles.sectionHeader}>
                  <span>2. Soluciones de las pistas</span>
                  <span>{nodesList.length} corchete(s)</span>
                </h2>
                <div className={styles.nodesContainer}>
                  {nodesList.map((node) => (
                    <div key={node.id} className={styles.nodeCard}>
                      <div className={styles.nodeCardHeader}>
                        <span className={styles.nodeBadge}>Corchete {node.id}</span>
                        {node.parent && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-secondary)' }}>
                            Hijo de {node.parent}
                          </span>
                        )}
                      </div>

                      <p className={styles.nodeCluePreview}>
                        «{node.clueText.replace(/{{[^}]+}}/g, '[…]')}»
                      </p>

                      <div className={styles.nodeInputGrid}>
                        <div className={styles.inputGroup}>
                          <label htmlFor={`sol-${node.id}`} className={styles.inputLabel}>
                            Palabra solución *
                          </label>
                          <input
                            id={`sol-${node.id}`}
                            type="text"
                            className={styles.textInput}
                            value={node.solution}
                            placeholder="Ej. Quijote"
                            onChange={(e) => handleSolutionChange(node.id, e.target.value)}
                          />
                        </div>

                        <div className={styles.inputGroup}>
                          <label htmlFor={`type-${node.id}`} className={styles.inputLabel}>
                            Tipo de pista
                          </label>
                          <select
                            id={`type-${node.id}`}
                            className={styles.selectInput}
                            value={node.type}
                            onChange={(e) =>
                              handleTypeChange(node.id, e.target.value as NodeConfig['type'])
                            }
                          >
                            <option value="definition">Definición</option>
                            <option value="morphological">Morfológica</option>
                            <option value="charade">Charada</option>
                            <option value="reference">Referencia</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadatos de la cita */}
            <div className={styles.formCard}>
              <h2 className={styles.sectionHeader}>
                <span>3. Autoría y Fuente</span>
                <span>Opcional</span>
              </h2>

              <div className={styles.metaGrid}>
                <div className={styles.inputGroup}>
                  <label htmlFor="creator-alias" className={styles.inputLabel}>
                    Tu alias o firma
                  </label>
                  <input
                    id="creator-alias"
                    type="text"
                    className={styles.textInput}
                    value={creatorAlias}
                    placeholder="Ej. Lector anónimo"
                    onChange={(e) => setCreatorAlias(e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="quote-author" className={styles.inputLabel}>
                    Autor de la cita
                  </label>
                  <input
                    id="quote-author"
                    type="text"
                    className={styles.textInput}
                    value={quoteAuthor}
                    placeholder="Ej. Jorge Luis Borges"
                    onChange={(e) => setQuoteAuthor(e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="quote-work" className={styles.inputLabel}>
                    Obra o libro
                  </label>
                  <input
                    id="quote-work"
                    type="text"
                    className={styles.textInput}
                    value={quoteWork}
                    placeholder="Ej. El Aleph"
                    onChange={(e) => setQuoteWork(e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="quote-year" className={styles.inputLabel}>
                    Año de publicación
                  </label>
                  <input
                    id="quote-year"
                    type="number"
                    className={styles.textInput}
                    value={quoteYear}
                    placeholder="Ej. 1949"
                    onChange={(e) => setQuoteYear(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className={styles.errorBanner} role="alert">
                {errorMsg}
              </div>
            )}

            <button
              id="publish-challenge-btn"
              type="button"
              className={styles.publishBtn}
              onClick={handlePublish}
              disabled={isSubmitting || !parsed.valid}
            >
              {isSubmitting ? 'Cifrando y publicando reto…' : 'Publicar Reto en la Comunidad'}
            </button>
          </section>

          {/* Columna Derecha: Vista previa en tiempo real */}
          <aside className={styles.previewSection}>
            <div className={styles.previewCard}>
              <div className={styles.previewHeader}>
                <span>Galerada de prueba</span>
                <span>Vista Previa</span>
              </div>

              <div className={styles.quoteDisplay}>
                {nodesList.length > 0 ? (
                  <span>
                    «
                    {parsed.tree?.rootTemplate.split(/(\{\{[^}]+\}\})/).map((part, idx) => {
                      const match = part.match(/\{\{([^}]+)\}\}/)
                      if (match) {
                        const nodeId = match[1]
                        const node = nodesList.find((n) => n.id === nodeId)
                        return (
                          <span key={idx} className={styles.previewBracket}>
                            [{node?.solution ? node.solution : node?.clueText || nodeId}]
                          </span>
                        )
                      }
                      return <span key={idx}>{part}</span>
                    })}
                    »
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-ink-secondary)', fontStyle: 'italic' }}>
                    Escribe tu frase en el formulario para previsualizar el puzle aquí.
                  </span>
                )}
              </div>

              {(quoteAuthor || quoteWork) && (
                <p className={styles.attributionDisplay}>
                  — {quoteAuthor}
                  {quoteWork && `, ${quoteWork}`}
                  {quoteYear && ` (${quoteYear})`}
                </p>
              )}

              <div className={styles.statsRow}>
                <span>Pistas totales: {nodesList.length}</span>
                <span>Estado: {parsed.valid ? 'Válido' : 'Pendiente'}</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}
