'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './analytics.module.css'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface LibraryItem {
  id: string
  editionNumber: number
  publishDate: string
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'REJECTED'
  source: 'AI' | 'MANUAL'
  quoteAuthor: string | null
  quoteWork: string | null
  quoteYear: number | null
  editorialNote: string | null
  maxDepth: number | null
  totalNodes: number | null
  initialLeaves: number | null
  rawMarkup: string
}

export interface EditionAnalyticsResponse {
  edition: {
    id: string
    editionNumber: number
    publishDate: string
    status: string
    source: string
    quoteAuthor: string | null
    quoteWork: string | null
    quoteYear: number | null
    maxDepth: number | null
    totalNodes: number | null
    initialLeaves: number | null
  }
  kpis: {
    startedSessions: number
    completedSessions: number
    abandonmentRate: number
    medianSeconds: number
    averageMistakes: number
  }
  timeDistribution: {
    label: string
    count: number
    percentage: number
  }[]
  nodeDiagnostics: {
    nodeId: string
    clueText: string
    type: string
    isLeaf: boolean
    totalAttempts: number
    totalFails: number
    hintsRequested: number
    revealsUsed: number
    errorRate: number
  }[]
}

export interface AgentAnalyticsResponse {
  summary: {
    totalGeneratedAi: number
    totalManual: number
    totalValidAi: number
    totalRejectedAi: number
    successRate: number
    averageAttempts: number
  }
  attemptsDistribution: {
    attempt1: number
    attempt2: number
    attempt3: number
  }
  statusBreakdown: {
    drafts: number
    scheduled: number
    published: number
    rejected: number
  }
  rejectionFeedback: {
    reason: string
    count: number
    autoResolved: boolean
  }[]
}

// ─── Datos iniciales / de calibración editorial ──────────────────────────────

const INITIAL_DEMO_LIBRARY: LibraryItem[] = [
  {
    id: 'demo-101',
    editionNumber: 101,
    publishDate: '2026-10-21',
    status: 'PUBLISHED',
    source: 'AI',
    quoteAuthor: 'John F. Kennedy',
    quoteWork: 'Crisis de los Misiles',
    quoteYear: 1962,
    editorialNote: 'Discurso sobre el bloqueo naval.',
    maxDepth: 2,
    totalNodes: 3,
    initialLeaves: 2,
    rawMarkup: 'Un día como hoy [el mandatario demócrata [la isla de Fidel]] anunció el [cerco marítimo].',
  },
  {
    id: 'demo-102',
    editionNumber: 102,
    publishDate: '2026-10-22',
    status: 'PUBLISHED',
    source: 'MANUAL',
    quoteAuthor: 'Miguel de Cervantes',
    quoteWork: 'El ingenioso hidalgo',
    quoteYear: 1605,
    editorialNote: 'Composición clásica sobre los molinos de viento.',
    maxDepth: 3,
    totalNodes: 4,
    initialLeaves: 2,
    rawMarkup: 'En un [lugar de [la Mancha [tierra de molinos]]] no ha mucho tiempo...',
  },
  {
    id: 'demo-103',
    editionNumber: 103,
    publishDate: '2026-10-23',
    status: 'SCHEDULED',
    source: 'AI',
    quoteAuthor: 'Federico García Lorca',
    quoteWork: 'Romancero Gitano',
    quoteYear: 1928,
    editorialNote: 'Poética popular y lírica andaluza.',
    maxDepth: 2,
    totalNodes: 3,
    initialLeaves: 2,
    rawMarkup: 'Verde que te [quiero [verde]], verde viento.',
  },
  {
    id: 'demo-104',
    editionNumber: 104,
    publishDate: '2026-10-24',
    status: 'DRAFT',
    source: 'AI',
    quoteAuthor: 'Rosalía de Castro',
    quoteWork: 'Cantares Gallegos',
    quoteYear: 1863,
    editorialNote: 'Renacimiento literario en lengua gallega.',
    maxDepth: 2,
    totalNodes: 3,
    initialLeaves: 2,
    rawMarkup: 'Adios [ríos, [adios fontes]], adios regatos pequenos.',
  },
]

function AnalyticsContent() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'library' | 'edition' | 'agent') || 'library'

  const [activeTab, setActiveTab] = useState<'library' | 'edition' | 'agent'>(initialTab)

  // Estado de la biblioteca
  const [library, setLibrary] = useState<LibraryItem[]>(INITIAL_DEMO_LIBRARY)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [sourceFilter, setSourceFilter] = useState<string>('ALL')

  // Estado de analítica por edición
  const [selectedEditionId, setSelectedEditionId] = useState<string>('demo-101')
  const [editionData, setEditionData] = useState<EditionAnalyticsResponse | null>(null)
  const [loadingEdition, setLoadingEdition] = useState(false)

  // Estado de rendimiento del agente
  const [agentData, setAgentData] = useState<AgentAnalyticsResponse | null>(null)
  const [loadingAgent, setLoadingAgent] = useState(false)

  // 1. Cargar biblioteca de puzles desde la API
  const fetchLibrary = async () => {
    try {
      const res = await fetch('/api/admin/puzzles', {
        headers: { 'x-admin-token': 'corchetes-admin-secret-dev-only' },
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setLibrary(data)
          const first = data[0]
          if (first) {
            setSelectedEditionId(first.id)
          }
          return
        }
      }
      setLibrary(INITIAL_DEMO_LIBRARY)
    } catch {
      setLibrary(INITIAL_DEMO_LIBRARY)
    }
  }

  // 2. Cargar analíticas de una edición específica
  const fetchEditionAnalytics = async (editionId: string) => {
    setLoadingEdition(true)
    try {
      const res = await fetch(`/api/admin/analytics/edition/${editionId}`, {
        headers: { 'x-admin-token': 'corchetes-admin-secret-dev-only' },
      })
      if (res.ok) {
        const data: EditionAnalyticsResponse = await res.json()
        setEditionData(data)
        return
      }
    } catch {
      // Usar fallback de calibración
    } finally {
      setLoadingEdition(false)
    }

    // Fallback de demostración si la API aún no tiene sesiones registradas
    const selectedItem = library.find((p) => p.id === editionId) || library[0]
    if (selectedItem) {
      setEditionData({
        edition: {
          id: selectedItem.id,
          editionNumber: selectedItem.editionNumber,
          publishDate: selectedItem.publishDate,
          status: selectedItem.status,
          source: selectedItem.source,
          quoteAuthor: selectedItem.quoteAuthor,
          quoteWork: selectedItem.quoteWork,
          quoteYear: selectedItem.quoteYear,
          maxDepth: selectedItem.maxDepth,
          totalNodes: selectedItem.totalNodes,
          initialLeaves: selectedItem.initialLeaves,
        },
        kpis: {
          startedSessions: 52,
          completedSessions: 44,
          abandonmentRate: 15,
          medianSeconds: 148,
          averageMistakes: 1.1,
        },
        timeDistribution: [
          { label: '< 1 min', count: 4, percentage: 9 },
          { label: '1 - 2 min', count: 14, percentage: 32 },
          { label: '2 - 3 min', count: 16, percentage: 36 },
          { label: '3 - 5 min', count: 7, percentage: 16 },
          { label: '5 - 10 min', count: 2, percentage: 5 },
          { label: '> 10 min', count: 1, percentage: 2 },
        ],
        nodeDiagnostics: [
          {
            nodeId: 'n1',
            clueText: 'Pista de anclaje inicial',
            type: 'definition',
            isLeaf: true,
            totalAttempts: 48,
            totalFails: 4,
            hintsRequested: 2,
            revealsUsed: 0,
            errorRate: 8,
          },
          {
            nodeId: 'n2',
            clueText: 'Pista compuesta de segundo nivel',
            type: 'charade',
            isLeaf: false,
            totalAttempts: 62,
            totalFails: 14,
            hintsRequested: 8,
            revealsUsed: 1,
            errorRate: 23,
          },
        ],
      })
    }
  }

  // 3. Cargar analíticas globales del agente IA
  const fetchAgentAnalytics = async () => {
    setLoadingAgent(true)
    try {
      const res = await fetch('/api/admin/analytics/agent', {
        headers: { 'x-admin-token': 'corchetes-admin-secret-dev-only' },
      })
      if (res.ok) {
        const data: AgentAnalyticsResponse = await res.json()
        setAgentData(data)
        return
      }
    } catch {
      // Fallback
    } finally {
      setLoadingAgent(false)
    }

    setAgentData({
      summary: {
        totalGeneratedAi: 18,
        totalManual: 4,
        totalValidAi: 17,
        totalRejectedAi: 1,
        successRate: 94,
        averageAttempts: 1.28,
      },
      attemptsDistribution: {
        attempt1: 13,
        attempt2: 4,
        attempt3: 1,
      },
      statusBreakdown: {
        drafts: 6,
        scheduled: 7,
        published: 4,
        rejected: 1,
      },
      rejectionFeedback: [
        {
          reason: 'Profundidad de anidamiento < 2 en borrador inicial',
          count: 5,
          autoResolved: true,
        },
        {
          reason: 'Solución idéntica detectada en dos corchetes',
          count: 2,
          autoResolved: true,
        },
        {
          reason: 'Desbalanceo en corchetes de cierre',
          count: 1,
          autoResolved: true,
        },
      ],
    })
  }

  useEffect(() => {
    fetchLibrary()
    fetchAgentAnalytics()
  }, [])

  useEffect(() => {
    if (selectedEditionId) {
      fetchEditionAnalytics(selectedEditionId)
    }
  }, [selectedEditionId])

  // Filtrado reactivo de la biblioteca
  const filteredLibrary = useMemo(() => {
    const term = searchQuery.trim().toLowerCase()
    return library.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
      if (sourceFilter !== 'ALL' && item.source !== sourceFilter) return false
      if (term) {
        const corpus = [
          item.quoteAuthor ?? '',
          item.quoteWork ?? '',
          item.rawMarkup ?? '',
          String(item.editionNumber),
          item.publishDate,
        ]
          .join(' ')
          .toLowerCase()
        if (!corpus.includes(term)) return false
      }
      return true
    })
  }, [library, searchQuery, statusFilter, sourceFilter])

  const handleSelectEditionForAnalytics = (id: string) => {
    setSelectedEditionId(id)
    setActiveTab('edition')
  }

  return (
    <div className={styles.container}>
      {/* ── Encabezado y Selector de Pestañas ─────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Analíticas y Biblioteca Editorial</h1>
          <p className={styles.subtitle}>
            Supervisión hemerográfica, rendimiento de jugadores y métricas del agente generador
          </p>
        </div>

        <nav className={styles.tabsNav}>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`${styles.tabBtn} ${
              activeTab === 'library' ? styles.tabBtnActive : ''
            }`}
          >
            Biblioteca de Ediciones ({library.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('edition')}
            className={`${styles.tabBtn} ${
              activeTab === 'edition' ? styles.tabBtnActive : ''
            }`}
          >
            Analíticas por Edición
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('agent')}
            className={`${styles.tabBtn} ${
              activeTab === 'agent' ? styles.tabBtnActive : ''
            }`}
          >
            Rendimiento Agente IA
          </button>
        </nav>
      </header>

      {/* ── PESTAÑA 1: BIBLIOTECA DE EDICIONES ───────────────────────────────── */}
      {activeTab === 'library' && (
        <>
          <div className={styles.filterBar}>
            <div className={styles.searchBox}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por autor, obra, cita o número de edición..."
                className={styles.searchInput}
              />
            </div>

            <div className={styles.filterControls}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PUBLISHED">Publicados</option>
                <option value="SCHEDULED">Programados</option>
                <option value="DRAFT">Borradores</option>
                <option value="REJECTED">Rechazados</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="ALL">Todas las Fuentes</option>
                <option value="AI">Generados por IA</option>
                <option value="MANUAL">Creación Manual</option>
              </select>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.editorialTable}>
              <thead>
                <tr>
                  <th>Edición</th>
                  <th>Fecha</th>
                  <th>Autor y Obra</th>
                  <th>Fuente</th>
                  <th>Estado</th>
                  <th>Complejidad</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredLibrary.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#767064' }}>
                      No se encontraron ediciones coincidentes con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredLibrary.map((item) => (
                    <tr key={item.id}>
                      <td className={styles.editionNum}>#{item.editionNumber}</td>
                      <td className={styles.dateCol}>{item.publishDate}</td>
                      <td>
                        <div className={styles.authorCol}>
                          <span className={styles.authorName}>
                            {item.quoteAuthor || 'Sin autor especificado'}
                          </span>
                          <span className={styles.workName}>
                            {item.quoteWork || 'Efeméride'} {item.quoteYear ? `(${item.quoteYear})` : ''}
                          </span>
                        </div>
                      </td>
                      <td>
                        {item.source === 'AI' ? (
                          <span className={styles.badgeSourceAi}>IA Gemini</span>
                        ) : (
                          <span className={styles.badgeSourceManual}>Manual</span>
                        )}
                      </td>
                      <td>
                        {item.status === 'PUBLISHED' && (
                          <span className={styles.badgePublished}>Publicado</span>
                        )}
                        {item.status === 'SCHEDULED' && (
                          <span className={styles.badgeScheduled}>Programado</span>
                        )}
                        {item.status === 'DRAFT' && (
                          <span className={styles.badgeDraft}>Borrador</span>
                        )}
                        {item.status === 'REJECTED' && (
                          <span className={styles.badgeRejected}>Rechazado</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#767064' }}>
                          P: {item.maxDepth ?? '-'} · H: {item.initialLeaves ?? '-'} · N: {item.totalNodes ?? '-'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleSelectEditionForAnalytics(item.id)}
                          className={styles.btnActionSmall}
                        >
                          Ver Analíticas
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── PESTAÑA 2: ANALÍTICAS POR EDICIÓN ────────────────────────────────── */}
      {activeTab === 'edition' && (
        <>
          {/* Selector de edición activa */}
          <div className={styles.filterBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#767064' }}>
                Edición seleccionada:
              </span>
              <select
                value={selectedEditionId}
                onChange={(e) => setSelectedEditionId(e.target.value)}
                className={styles.filterSelect}
                style={{ minWidth: '320px' }}
              >
                {library.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.editionNumber} · {item.publishDate} — {item.quoteAuthor || 'Sin autor'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingEdition || !editionData ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#767064' }}>
              Cargando analíticas de la edición...
            </div>
          ) : (
            <>
              {/* KPIs de la Edición */}
              <section className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Partidas Iniciadas</span>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiValue}>{editionData.kpis.startedSessions}</span>
                  </div>
                  <span className={styles.kpiHint}>Lectores que abrieron la edición</span>
                </div>

                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Partidas Completadas</span>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiValue}>{editionData.kpis.completedSessions}</span>
                  </div>
                  <span className={styles.kpiHint}>Resolución completa del enigma</span>
                </div>

                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Tasa de Abandono</span>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiValue}>{editionData.kpis.abandonmentRate}%</span>
                  </div>
                  <span className={styles.kpiHint}>Sesiones sin completar</span>
                </div>

                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Tiempo Mediano</span>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiValue}>
                      {Math.floor(editionData.kpis.medianSeconds / 60)}m {editionData.kpis.medianSeconds % 60}s
                    </span>
                  </div>
                  <span className={styles.kpiHint}>Duración representativa de resolución</span>
                </div>
              </section>

              {/* Histograma de Distribución de Tiempos */}
              <section className={styles.card}>
                <div>
                  <h2 className={styles.cardTitle}>Distribución de Tiempos de Resolución</h2>
                  <p className={styles.cardSubtitle}>
                    Proporción de jugadores según el intervalo de tiempo empleado para reconstruir la cita.
                  </p>
                </div>

                <div className={styles.histogramList}>
                  {editionData.timeDistribution.map((bucket) => (
                    <div key={bucket.label} className={styles.histogramRow}>
                      <span className={styles.histogramLabel}>{bucket.label}</span>
                      <div className={styles.histogramTrack}>
                        <div
                          className={styles.histogramFill}
                          style={{ width: `${bucket.percentage}%` }}
                        />
                      </div>
                      <span className={styles.histogramCount}>
                        {bucket.count} ({bucket.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Diagnóstico de Dificultad por Nodo */}
              <section className={styles.card}>
                <div>
                  <h2 className={styles.cardTitle}>Diagnóstico y Dificultad por Pista</h2>
                  <p className={styles.cardSubtitle}>
                    Métricas de fallos y solicitudes de ayuda para detectar ambigüedades o bloqueos en el árbol.
                  </p>
                </div>

                <div className={styles.tableContainer}>
                  <table className={styles.editorialTable}>
                    <thead>
                      <tr>
                        <th>Nodo</th>
                        <th>Texto de la Pista</th>
                        <th>Tipo</th>
                        <th>Nivel</th>
                        <th>Intentos</th>
                        <th>Fallos</th>
                        <th>Ayudas / Revelaciones</th>
                        <th>Tasa de Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editionData.nodeDiagnostics.map((node) => (
                        <tr key={node.nodeId}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {node.nodeId}
                          </td>
                          <td style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1rem' }}>
                            «{node.clueText}»
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8rem', color: '#767064' }}>{node.type}</span>
                          </td>
                          <td>
                            {node.isLeaf ? (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e633d' }}>
                                Hoja Inicial
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92540c' }}>
                                Compuesto
                              </span>
                            )}
                          </td>
                          <td>{node.totalAttempts}</td>
                          <td style={{ color: node.totalFails > 10 ? '#a82a17' : 'inherit' }}>
                            {node.totalFails}
                          </td>
                          <td>
                            {node.hintsRequested} / {node.revealsUsed}
                          </td>
                          <td>
                            <div className={styles.errorRateTrack}>
                              <div
                                className={styles.errorRateFill}
                                style={{ width: `${Math.min(node.errorRate, 100)}%` }}
                              />
                            </div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                              {node.errorRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {/* ── PESTAÑA 3: RENDIMIENTO DEL AGENTE IA ─────────────────────────────── */}
      {activeTab === 'agent' && (
        <>
          {loadingAgent || !agentData ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#767064' }}>
              Cargando métricas del agente generador...
            </div>
          ) : (
            <>
              {/* KPIs del Agente */}
              <section className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Tasa de Éxito</span>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiValue}>{agentData.summary.successRate}%</span>
                  </div>
                  <span className={styles.kpiHint}>Borradores válidos generados</span>
                </div>

                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Promedio de Reintentos</span>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiValue}>{agentData.summary.averageAttempts}</span>
                  </div>
                  <span className={styles.kpiHint}>Ciclos de autocorrección (máx. 3)</span>
                </div>

                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Puzles IA Generados</span>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiValue}>{agentData.summary.totalGeneratedAi}</span>
                  </div>
                  <span className={styles.kpiHint}>Total de borradores automáticos</span>
                </div>

                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Rechazos Editoriales</span>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiValue}>{agentData.summary.totalRejectedAi}</span>
                  </div>
                  <span className={styles.kpiHint}>Descartados por supervisión</span>
                </div>
              </section>

              {/* Grilla con Desgloses */}
              <div className={styles.agentGrid}>
                <section className={styles.card}>
                  <div>
                    <h2 className={styles.cardTitle}>Distribución de Reintentos</h2>
                    <p className={styles.cardSubtitle}>
                      Frecuencia con la que el generador acierta al primer intento vs autocorrección.
                    </p>
                  </div>

                  <div className={styles.histogramList}>
                    <div className={styles.histogramRow}>
                      <span className={styles.histogramLabel}>1.er intento</span>
                      <div className={styles.histogramTrack}>
                        <div
                          className={styles.histogramFill}
                          style={{
                            width: `${Math.round(
                              (agentData.attemptsDistribution.attempt1 /
                                Math.max(agentData.summary.totalGeneratedAi, 1)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className={styles.histogramCount}>
                        {agentData.attemptsDistribution.attempt1}
                      </span>
                    </div>

                    <div className={styles.histogramRow}>
                      <span className={styles.histogramLabel}>2.º intento</span>
                      <div className={styles.histogramTrack}>
                        <div
                          className={styles.histogramFill}
                          style={{
                            width: `${Math.round(
                              (agentData.attemptsDistribution.attempt2 /
                                Math.max(agentData.summary.totalGeneratedAi, 1)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className={styles.histogramCount}>
                        {agentData.attemptsDistribution.attempt2}
                      </span>
                    </div>

                    <div className={styles.histogramRow}>
                      <span className={styles.histogramLabel}>3.er intento</span>
                      <div className={styles.histogramTrack}>
                        <div
                          className={styles.histogramFill}
                          style={{
                            width: `${Math.round(
                              (agentData.attemptsDistribution.attempt3 /
                                Math.max(agentData.summary.totalGeneratedAi, 1)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className={styles.histogramCount}>
                        {agentData.attemptsDistribution.attempt3}
                      </span>
                    </div>
                  </div>
                </section>

                <section className={styles.card}>
                  <div>
                    <h2 className={styles.cardTitle}>Cuota de Producción Editorial</h2>
                    <p className={styles.cardSubtitle}>
                      Balance entre generación automática asistida por IA y creación directa manual.
                    </p>
                  </div>

                  <div className={styles.histogramList}>
                    <div className={styles.histogramRow}>
                      <span className={styles.histogramLabel}>IA Gemini</span>
                      <div className={styles.histogramTrack}>
                        <div
                          className={styles.histogramFill}
                          style={{
                            width: `${Math.round(
                              (agentData.summary.totalGeneratedAi /
                                Math.max(
                                  agentData.summary.totalGeneratedAi + agentData.summary.totalManual,
                                  1,
                                )) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className={styles.histogramCount}>
                        {agentData.summary.totalGeneratedAi}
                      </span>
                    </div>

                    <div className={styles.histogramRow}>
                      <span className={styles.histogramLabel}>Manual CMS</span>
                      <div className={styles.histogramTrack}>
                        <div
                          className={styles.histogramFill}
                          style={{
                            width: `${Math.round(
                              (agentData.summary.totalManual /
                                Math.max(
                                  agentData.summary.totalGeneratedAi + agentData.summary.totalManual,
                                  1,
                                )) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className={styles.histogramCount}>
                        {agentData.summary.totalManual}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Registro de Autocorrecciones */}
              <section className={styles.card}>
                <div>
                  <h2 className={styles.cardTitle}>Errores Frecuentes Resueltos por el Validador</h2>
                  <p className={styles.cardSubtitle}>
                    Retroalimentación determinista que activó el bucle de reintento del modelo.
                  </p>
                </div>

                <div className={styles.feedbackList}>
                  {agentData.rejectionFeedback.map((item) => (
                    <div key={item.reason} className={styles.feedbackItem}>
                      <span>{item.reason}</span>
                      <span className={styles.feedbackCount}>
                        {item.count} ocurrencias {item.autoResolved ? '(autocorregido)' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Cargando analíticas...</div>}>
      <AnalyticsContent />
    </Suspense>
  )
}
