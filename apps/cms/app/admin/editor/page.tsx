'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  initPuzzleState,
  onSubmit,
  normalize,
  type ClueType,
  type ClientPayload,
  type PuzzleState,
} from '@corchetes/core'
import { sha256, aesGcmEncrypt, aesGcmDecrypt } from '@corchetes/crypto'
import { ClueTree } from '@corchetes/ui'
import {
  analyzeManualPuzzle,
  type EditorNodeInput,
} from '../../../src/lib/manualEditorAnalyzer'
import styles from './editor.module.css'

const CLUE_TYPE_OPTIONS: { value: ClueType; label: string }[] = [
  { value: 'definition', label: 'Definición directa' },
  { value: 'anagram', label: 'Anagrama (letras desordenadas)' },
  { value: 'reverse', label: 'Lectura inversa' },
  { value: 'palindrome', label: 'Palíndromo (simétrico)' },
  { value: 'container', label: 'Contenedor (palabra dentro de otra)' },
  { value: 'morphological', label: 'Morfológica (extremos de palabras)' },
  { value: 'reference', label: 'Referencia cultural o histórica' },
  { value: 'polysemy', label: 'Polisemia (doble sentido)' },
]

const SAMPLE_PUZZLE = {
  markup:
    'En [1969], la misión [Apolo 11] logró el [primer alunizaje del [ser humano]] en la Luna.',
  originalQuote:
    'En 1969, la misión Apolo 11 logró el primer alunizaje del ser humano en la Luna.',
  quoteAuthor: 'Neil Armstrong',
  quoteWork: 'Misión Espacial Apolo 11',
  quoteYear: 1969,
  editorialNote:
    'Hito histórico de la exploración espacial y primer paso en la superficie lunar.',
  publishDate: '2026-10-28',
  editionNumber: 105,
  nodes: [
    {
      id: 'n1',
      solution: '1969',
      type: 'reference' as ClueType,
      reasoning: 'Año de la llegada a la Luna',
    },
    {
      id: 'n2',
      solution: 'Apolo 11',
      type: 'reference' as ClueType,
      reasoning: 'Nombre oficial de la nave y misión',
    },
    {
      id: 'n3',
      solution: 'primer alunizaje',
      type: 'definition' as ClueType,
      reasoning: 'Descenso con éxito sobre la Luna',
    },
    {
      id: 'n4',
      solution: 'ser humano',
      type: 'definition' as ClueType,
      reasoning: 'Especie de los astronautas',
    },
  ],
}

export default function ManualEditorPage() {
  const [markup, setMarkup] = useState('')
  const [nodes, setNodes] = useState<EditorNodeInput[]>([])

  // Metadatos
  const [originalQuote, setOriginalQuote] = useState('')
  const [quoteAuthor, setQuoteAuthor] = useState('')
  const [quoteWork, setQuoteWork] = useState('')
  const [quoteYear, setQuoteYear] = useState<number>(1969)
  const [editorialNote, setEditorialNote] = useState('')
  const [publishDate, setPublishDate] = useState('')
  const [editionNumber, setEditionNumber] = useState<number | ''>('')

  // Estado de guardado y feedback
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)

  // Vista previa interactiva
  const [previewPayload, setPreviewPayload] = useState<ClientPayload | null>(null)
  const [previewState, setPreviewState] = useState<PuzzleState | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [testInput, setTestInput] = useState('')
  const [justResolvedId, setJustResolvedId] = useState<string | null>(null)

  // 1. Análisis en tiempo real del markup y nodos
  const analysis = useMemo(() => {
    return analyzeManualPuzzle(markup, nodes)
  }, [markup, nodes])

  // 2. Sincronizar nodos detectados reactivamente cuando cambia el markup
  useEffect(() => {
    if (!analysis.parseResult) {
      if (analysis.totalNodes === 0 && markup.trim() === '') {
        setNodes([])
      }
      return
    }

    const detectedIds = analysis.nodeIds
    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map((n) => [n.id, n]))
      const updated: EditorNodeInput[] = []

      for (const id of detectedIds) {
        if (prevMap.has(id)) {
          const existing = prevMap.get(id)
          if (existing) updated.push(existing)
        } else {
          updated.push({
            id,
            solution: '',
            type: 'definition',
            reasoning: '',
          })
        }
      }
      return updated
    })
  }, [analysis.parseResult, analysis.nodeIds, analysis.totalNodes, markup])

  // 3. Generar ClientPayload seguro para la vista previa interactiva en vivo
  const compilePreview = useCallback(async () => {
    if (!analysis.parseResult || analysis.hasSyntaxError || analysis.totalNodes === 0) {
      setPreviewPayload(null)
      setPreviewState(null)
      return
    }

    const solutionMap = new Map(nodes.map((n) => [n.id, n]))
    const dailySalt = 'preview-salt'
    const puzzleId = 'preview-puzzle'

    try {
      const clientNodes: Record<string, {
        id: string
        clueText: string
        children: string[]
        parent: string | null
        type: ClueType
        solutionHash: string
        solutionCipher: string
      }> = {}

      for (const id of analysis.nodeIds) {
        const parsed = analysis.parseResult.nodes[id]
        if (!parsed) continue
        const nodeInput = solutionMap.get(id)
        const sol = nodeInput?.solution.trim() || 'pendiente'
        const normSol = normalize(sol) || sol.toLowerCase()

        // Generar hash seguro y cifrado AES-GCM usando Web Crypto API de @corchetes/crypto
        const hashMaterial = `${normSol}:${puzzleId}:${id}:${dailySalt}`
        const solHash = await sha256(hashMaterial)
        const solCipher = await aesGcmEncrypt(sol, normSol)

        clientNodes[id] = {
          id,
          clueText: parsed.clueText,
          children: parsed.children,
          parent: parsed.parent,
          type: nodeInput?.type ?? 'definition',
          solutionHash: solHash,
          solutionCipher: solCipher,
        }
      }

      const payload: ClientPayload = {
        puzzleId,
        editionNumber: editionNumber ? Number(editionNumber) : 1,
        publishDate: publishDate || '2026-10-28',
        rootTemplate: analysis.parseResult.rootTemplate,
        nodes: clientNodes,
        dailySalt,
        quoteAuthor: quoteAuthor || 'Autor del puzle',
        quoteWork: quoteWork || 'Obra histórica',
        quoteYear: quoteYear || 1969,
        editorialNote: editorialNote || 'Nota editorial previa',
      }

      setPreviewPayload(payload)
      const state = initPuzzleState(payload)
      setPreviewState(state)
    } catch {
      // Si falla la generación de preview criptográfica, continuar sin romper la UI
    }
  }, [
    analysis.parseResult,
    analysis.hasSyntaxError,
    analysis.totalNodes,
    analysis.nodeIds,
    nodes,
    editionNumber,
    publishDate,
    quoteAuthor,
    quoteWork,
    quoteYear,
    editorialNote,
  ])

  // Actualizar preview con debounce suave
  useEffect(() => {
    const timer = setTimeout(() => {
      compilePreview()
    }, 250)
    return () => clearTimeout(timer)
  }, [compilePreview])

  // Manejar cambio en un campo de un nodo específico
  const handleNodeChange = (
    id: string,
    field: keyof EditorNodeInput,
    value: string,
  ) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)),
    )
  }

  // Cargar el ejemplo balanceado predefinido
  const handleLoadSample = () => {
    setMarkup(SAMPLE_PUZZLE.markup)
    setOriginalQuote(SAMPLE_PUZZLE.originalQuote)
    setQuoteAuthor(SAMPLE_PUZZLE.quoteAuthor)
    setQuoteWork(SAMPLE_PUZZLE.quoteWork)
    setQuoteYear(SAMPLE_PUZZLE.quoteYear)
    setEditorialNote(SAMPLE_PUZZLE.editorialNote)
    setPublishDate(SAMPLE_PUZZLE.publishDate)
    setEditionNumber(SAMPLE_PUZZLE.editionNumber)
    setNodes(SAMPLE_PUZZLE.nodes)
    setSaveSuccessMessage(null)
    setSaveErrorMessage(null)
  }

  // Limpiar todo el editor
  const handleClear = () => {
    setMarkup('')
    setOriginalQuote('')
    setQuoteAuthor('')
    setQuoteWork('')
    setQuoteYear(1900)
    setEditorialNote('')
    setPublishDate('')
    setEditionNumber('')
    setNodes([])
    setPreviewPayload(null)
    setPreviewState(null)
    setSaveSuccessMessage(null)
    setSaveErrorMessage(null)
  }

  // Insertar corchete en la posición del cursor
  const handleInsertBracket = () => {
    setMarkup((prev) => prev + '[pista]')
  }

  const handleInsertNested = () => {
    setMarkup((prev) => prev + '[externa [interna]]')
  }

  // Probar una solución en la vista previa interactiva
  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testInput.trim() || !previewState || !previewPayload) return

    const [result, nextState] = await onSubmit(
      testInput,
      previewState,
      previewPayload.dailySalt,
      sha256,
      aesGcmDecrypt,
    )

    if (result.success) {
      setJustResolvedId(result.resolvedNodeId)
      setPreviewState(nextState)
      setTestInput('')
    } else {
      alert(`La respuesta «${testInput}» no coincide con ninguna pista activa en el árbol.`)
    }
  }

  // Reiniciar estado del juego en la vista previa
  const handleResetPreview = () => {
    if (previewPayload) {
      setPreviewState(initPuzzleState(previewPayload))
      setJustResolvedId(null)
      setTestInput('')
    }
  }

  // Guardar en backend (POST /api/admin/puzzles/manual)
  const handleSavePuzzle = async () => {
    setSaveSuccessMessage(null)
    setSaveErrorMessage(null)

    if (!analysis.isValid) {
      setSaveErrorMessage(
        'El puzle no cumple con todas las restricciones de validación. Revisa el panel de alertas.',
      )
      return
    }

    if (!originalQuote.trim()) {
      setSaveErrorMessage('Debes indicar la frase original completa y resuelta.')
      return
    }

    setIsSaving(true)

    try {
      const payload = {
        originalQuote: originalQuote.trim(),
        markup: markup.trim(),
        nodes: nodes.map((n) => ({
          id: n.id,
          solution: n.solution.trim(),
          type: n.type,
          reasoning: n.reasoning?.trim() || undefined,
        })),
        quoteAuthor: quoteAuthor.trim() || undefined,
        quoteWork: quoteWork.trim() || undefined,
        quoteYear: Number(quoteYear),
        editorialNote: editorialNote.trim() || undefined,
        publishDate: publishDate.trim() || undefined,
        editionNumber: editionNumber ? Number(editionNumber) : undefined,
      }

      const res = await fetch('/api/admin/puzzles/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'corchetes-admin-secret-dev-only',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setSaveSuccessMessage(
          `Puzle manual guardado con éxito (ID: ${data.puzzleId}) con estado DRAFT.`,
        )
      } else {
        const errorDetails = data.errors ? data.errors.join('. ') : data.message
        setSaveErrorMessage(`Error al guardar puzle: ${errorDetails}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSaveErrorMessage(`Error de red al conectar con el servidor: ${msg}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.container}>
      {/* ── Encabezado ───────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Editor Manual de Puzles</h1>
          <p className={styles.subtitle}>
            Composición enigmística con análisis sintáctico y de complejidad en tiempo real
          </p>
        </div>

        <div className={styles.actionsHeader}>
          <button
            type="button"
            onClick={handleLoadSample}
            className={styles.btnSecondary}
          >
            Cargar Ejemplo Balanceado
          </button>
          <button
            type="button"
            onClick={handleClear}
            className={styles.btnSecondary}
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={handleSavePuzzle}
            disabled={isSaving || !analysis.isValid}
            className={styles.btnPrimary}
          >
            {isSaving ? 'Guardando...' : 'Guardar Borrador Manual'}
          </button>
        </div>
      </header>

      {/* ── Mensajes de Feedback de Guardado ───────────────────────────────── */}
      {saveSuccessMessage && (
        <div className={styles.saveFeedbackSuccess}>
          <span>{saveSuccessMessage}</span>
          <Link href="/admin" className={styles.btnSecondary}>
            Ver Cola de Borradores
          </Link>
        </div>
      )}

      {saveErrorMessage && (
        <div className={styles.saveFeedbackError}>{saveErrorMessage}</div>
      )}

      {/* ── Dashboard de Métricas en Tiempo Real ────────────────────────────── */}
      <section className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Profundidad Máxima</span>
          <div className={styles.metricValueRow}>
            <span className={styles.metricValue}>{analysis.maxDepth}</span>
            {analysis.maxDepth >= 2 && analysis.maxDepth <= 5 ? (
              <span className={styles.metricBadgeOk}>Válida (2-5)</span>
            ) : analysis.maxDepth === 0 ? (
              <span className={styles.metricBadgeWarn}>Sin nivel</span>
            ) : (
              <span className={styles.metricBadgeError}>Fuera de rango</span>
            )}
          </div>
          <span className={styles.metricHint}>Nivel máximo de anidamiento de corchetes</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Nodos Hoja Iniciales</span>
          <div className={styles.metricValueRow}>
            <span className={styles.metricValue}>{analysis.initialLeaves}</span>
            {analysis.initialLeaves >= 2 ? (
              <span className={styles.metricBadgeOk}>Óptimo (&ge; 2)</span>
            ) : (
              <span className={styles.metricBadgeError}>Insuficiente (&lt; 2)</span>
            )}
          </div>
          <span className={styles.metricHint}>Pistas independientes activas al iniciar</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Corchetes</span>
          <div className={styles.metricValueRow}>
            <span className={styles.metricValue}>{analysis.totalNodes}</span>
            {analysis.totalNodes >= 3 && analysis.totalNodes <= 8 ? (
              <span className={styles.metricBadgeOk}>Balanceado (3-8)</span>
            ) : analysis.totalNodes === 0 ? (
              <span className={styles.metricBadgeWarn}>0 nodos</span>
            ) : (
              <span className={styles.metricBadgeWarn}>Revisar cantidad</span>
            )}
          </div>
          <span className={styles.metricHint}>Rango editorial recomendado: entre 3 y 8</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Estado del Puzle</span>
          <div className={styles.metricValueRow}>
            <span className={styles.metricValue} style={{ fontSize: '1.25rem' }}>
              {analysis.isValid ? 'Apto' : 'En progreso'}
            </span>
            {analysis.isValid ? (
              <span className={styles.metricBadgeOk}>Listo para guardar</span>
            ) : (
              <span className={styles.metricBadgeWarn}>Requiere ajustes</span>
            )}
          </div>
          <span className={styles.metricHint}>Validación determinista instantánea</span>
        </div>
      </section>

      {/* ── Panel de Alertas en Tiempo Real ─────────────────────────────────── */}
      {analysis.alerts.length > 0 && (
        <section className={styles.alertsList}>
          {analysis.alerts.map((alert) => (
            <div
              key={alert.id}
              className={
                alert.level === 'error'
                  ? styles.alertError
                  : alert.level === 'warning'
                    ? styles.alertWarning
                    : styles.alertInfo
              }
            >
              {alert.message}
            </div>
          ))}
        </section>
      )}

      {analysis.isValid && (
        <div className={styles.alertSuccess}>
          Estructura sintáctica y balance enigmístico correctos. El puzle cumple con todos los
          criterios editoriales para ser guardado como borrador.
        </div>
      )}

      {/* ── Espacio de Trabajo Principal ────────────────────────────────────── */}
      <div className={styles.workGrid}>
        {/* Columna Izquierda: Markup y Nodos */}
        <div className={styles.column}>
          {/* Card 1: Textarea de Markup */}
          <section className={styles.card}>
            <div>
              <h2 className={styles.cardTitle}>Markup con Corchetes</h2>
              <p className={styles.cardSubtitle}>
                Escribe la frase utilizando corchetes [pista [anidada]] para delimitar los enigmas.
              </p>
            </div>

            <textarea
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              placeholder="Ejemplo: En [1969], la misión [Apolo 11] logró el [primer alunizaje del [ser humano]]..."
              className={styles.markupTextarea}
              rows={5}
            />

            <div className={styles.markupHelp}>
              <span>{markup.length} caracteres · {analysis.totalNodes} corchetes</span>
              <div className={styles.syntaxShortcuts}>
                <button
                  type="button"
                  onClick={handleInsertBracket}
                  className={styles.shortcutBtn}
                  title="Insertar corchete simple"
                >
                  + [pista]
                </button>
                <button
                  type="button"
                  onClick={handleInsertNested}
                  className={styles.shortcutBtn}
                  title="Insertar corchete anidado"
                >
                  + [externa [interna]]
                </button>
              </div>
            </div>
          </section>

          {/* Card 2: Configurador de Nodos Detectados */}
          <section className={styles.card}>
            <div>
              <h2 className={styles.cardTitle}>
                Configuración de Pistas ({analysis.totalNodes})
              </h2>
              <p className={styles.cardSubtitle}>
                Asigna a cada corchete su solución correspondiente, tipo lingüístico y razonamiento.
              </p>
            </div>

            {analysis.totalNodes === 0 ? (
              <div className={styles.previewEmptyState}>
                Escribe corchetes en el editor superior para detectar y configurar las pistas.
              </div>
            ) : (
              <div className={styles.nodeList}>
                {nodes.map((node) => {
                  const parsedNode = analysis.parseResult?.nodes[node.id]
                  const isLeaf = parsedNode ? parsedNode.children.length === 0 : false

                  return (
                    <div key={node.id} className={styles.nodeCard}>
                      <div className={styles.nodeCardHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={styles.nodeIdBadge}>{node.id}</span>
                          <span className={styles.nodeCluePreview}>
                            «{parsedNode ? parsedNode.clueText : '...'}»
                          </span>
                        </div>
                        {isLeaf ? (
                          <span className={styles.nodeLeafBadge}>Hoja Inicial Activa</span>
                        ) : (
                          <span className={styles.nodeNestedBadge}>Nodo Compuesto</span>
                        )}
                      </div>

                      <div className={styles.nodeInputsGrid}>
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>Solución Exacta</label>
                          <input
                            type="text"
                            value={node.solution}
                            onChange={(e) =>
                              handleNodeChange(node.id, 'solution', e.target.value)
                            }
                            placeholder="ej: Apolo 11"
                            className={styles.textInput}
                          />
                        </div>

                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>Tipo de Pista</label>
                          <select
                            value={node.type}
                            onChange={(e) =>
                              handleNodeChange(
                                node.id,
                                'type',
                                e.target.value as ClueType,
                              )
                            }
                            className={styles.selectInput}
                          >
                            {CLUE_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className={`${styles.inputGroup} ${styles.metaFullWidth}`}>
                          <label className={styles.inputLabel}>
                            Razonamiento Enigmístico (Opcional)
                          </label>
                          <input
                            type="text"
                            value={node.reasoning || ''}
                            onChange={(e) =>
                              handleNodeChange(node.id, 'reasoning', e.target.value)
                            }
                            placeholder="Explicación lingüística o histórica del término"
                            className={styles.textInput}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Card 3: Formulario de Metadatos */}
          <section className={styles.card}>
            <div>
              <h2 className={styles.cardTitle}>Metadatos Editoriales</h2>
              <p className={styles.cardSubtitle}>
                Contexto histórico y pedagógico que se mostrará al jugador al resolver el puzle.
              </p>
            </div>

            <div className={styles.metaGrid}>
              <div className={`${styles.inputGroup} ${styles.metaFullWidth}`}>
                <label className={styles.inputLabel}>Frase Original Resuelta *</label>
                <input
                  type="text"
                  value={originalQuote}
                  onChange={(e) => setOriginalQuote(e.target.value)}
                  placeholder="Texto corrido y fluido sin corchetes"
                  className={styles.textInput}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Autor / Protagonista</label>
                <input
                  type="text"
                  value={quoteAuthor}
                  onChange={(e) => setQuoteAuthor(e.target.value)}
                  placeholder="ej: Neil Armstrong"
                  className={styles.textInput}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Obra o Contexto</label>
                <input
                  type="text"
                  value={quoteWork}
                  onChange={(e) => setQuoteWork(e.target.value)}
                  placeholder="ej: Misión Apolo 11"
                  className={styles.textInput}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Año Histórico *</label>
                <input
                  type="number"
                  value={quoteYear}
                  onChange={(e) => setQuoteYear(parseInt(e.target.value, 10) || 0)}
                  className={styles.textInput}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Fecha de Publicación (Opcional)</label>
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className={styles.textInput}
                />
              </div>

              <div className={`${styles.inputGroup} ${styles.metaFullWidth}`}>
                <label className={styles.inputLabel}>Nota Editorial Explicativa</label>
                <textarea
                  value={editorialNote}
                  onChange={(e) => setEditorialNote(e.target.value)}
                  placeholder="Comentario sobre la efeméride o curiosidad histórica..."
                  className={styles.textInput}
                  rows={2}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Columna Derecha: Vista Previa Interactiva en Vivo */}
        <div className={styles.column}>
          <section className={styles.card}>
            <div>
              <h2 className={styles.cardTitle}>
                Vista Previa Interactiva en Vivo
              </h2>
              <p className={styles.cardSubtitle}>
                Prueba la resolución deductiva directamente con el componente oficial &lt;ClueTree /&gt;.
              </p>
            </div>

            {previewState ? (
              <div className={styles.previewContainer}>
                {/* Árbol interactivo del sistema de diseño */}
                <ClueTree
                  rootTemplate={previewState.rootTemplate}
                  nodes={previewState.nodes}
                  quoteAuthor={quoteAuthor || 'Autor'}
                  quoteWork={quoteWork || 'Obra'}
                  quoteYear={quoteYear}
                  selectedNodeId={selectedNodeId}
                  justResolvedId={justResolvedId}
                  onSelectNode={(id) => setSelectedNodeId(id)}
                />

                {/* Formulario de prueba en tiempo real */}
                <form onSubmit={handleTestSubmit} className={styles.previewInteractiveRow}>
                  <input
                    type="text"
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Escribe una respuesta para probar..."
                    className={styles.textInput}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className={styles.btnTest}>
                    Comprobar
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPreview}
                    className={styles.btnSecondary}
                  >
                    Reiniciar
                  </button>
                </form>

                {justResolvedId && (
                  <div className={styles.previewResolvedNotice}>
                    Nodo «{justResolvedId}» resuelto con éxito en la simulación.
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.previewEmptyState}>
                Escribe un markup balanceado con corchetes y asigna soluciones a los nodos para
                activar la vista previa interactiva.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
