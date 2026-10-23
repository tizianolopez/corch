import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient, ApiClientError } from '../api/client'
import { usePuzzleStore } from '../../store/usePuzzleStore'
import { saveState, loadSavedState } from '../../store/usePuzzlePersistence'
import type { PuzzleState, ClientPayload } from '@corchetes/core'

describe('Conexión apps/web con apps/api (Fase 2.5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    usePuzzleStore.getState().resetGame()
  })

  it('apiClient.startSession llama a POST /api/session/start y devuelve sessionId', async () => {
    const mockResponse = {
      sessionId: 'test-session-uuid-1234',
      puzzleId: 'puzzle-daily-001',
      startedAt: '2026-10-22T10:00:00.000Z',
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await apiClient.startSession('puzzle-daily-001')

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/session/start'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ puzzleId: 'puzzle-daily-001' }),
      }),
    )
    expect(result.sessionId).toBe('test-session-uuid-1234')
    expect(result.puzzleId).toBe('puzzle-daily-001')
  })

  it('apiClient.requestHint solicita pista de tipo "reveal" devolviendo solución en texto plano', async () => {
    const mockResponse = {
      success: true,
      hintType: 'reveal',
      nodeId: 'n3',
      solution: 'molinos',
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await apiClient.requestHint('test-session-123', 'n3', 'reveal')

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/session/hint'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-123',
          nodeId: 'n3',
          hintType: 'reveal',
        }),
      }),
    )
    expect(result.success).toBe(true)
    if (result.hintType === 'reveal') {
      expect(result.solution).toBe('molinos')
    }
  })

  it('apiClient.requestHint solicita pista de tipo "matrix" devolviendo initialLetter', async () => {
    const mockResponse = {
      success: true,
      hintType: 'matrix',
      nodeId: 'n2',
      initialLetter: 'Q',
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await apiClient.requestHint('test-session-123', 'n2', 'matrix')

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/session/hint'),
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(result.success).toBe(true)
    if (result.hintType === 'matrix') {
      expect(result.initialLetter).toBe('Q')
    }
  })

  it('apiClient.completeSession reporta resultados y recibe el percentil del jugador', async () => {
    const mockResponse = {
      success: true,
      sessionId: 'session-123',
      isComplete: true,
      score: 95,
      rankAchieved: 'Gran Maestro',
      percentile: 88,
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await apiClient.completeSession({
      sessionId: 'session-123',
      durationMs: 75000,
      mistakesCount: 1,
      hintsUsed: [],
      score: 95,
      rankAchieved: 'Gran Maestro',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/session/complete'),
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(result.percentile).toBe(88)
    expect(result.isComplete).toBe(true)
  })

  it('apiClient maneja errores HTTP lanzando ApiClientError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response)

    await expect(apiClient.startSession('non-existent')).rejects.toThrow(
      ApiClientError,
    )
  })

  it('usePuzzleStore almacena sessionId y actualiza percentile al completar la partida', async () => {
    const mockPayload: ClientPayload = {
      puzzleId: 'puzzle-test',
      editionNumber: 1,
      publishDate: '2026-10-22',
      rootTemplate: 'Texto con {{n1}}',
      dailySalt: 'salt',
      nodes: {
        n1: {
          id: 'n1',
          clueText: 'Pista 1',
          children: [],
          parent: null,
          type: 'definition',
          solutionHash: 'hash-n1',
          solutionCipher: 'molinos',
        },
      },
      quoteAuthor: 'Autor',
      quoteWork: 'Obra',
      quoteYear: 2000,
      editorialNote: 'Nota editorial de prueba.',
    }

    // Mock completeSession response
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        sessionId: 'session-store-test',
        isComplete: true,
        score: 100,
        rankAchieved: 'Gran Maestro',
        percentile: 92,
      }),
    } as Response)

    const store = usePuzzleStore.getState()
    store.loadPuzzle(
      mockPayload,
      async () => 'hash-n1',
      async () => 'molinos',
      'session-store-test',
    )

    expect(usePuzzleStore.getState().sessionId).toBe('session-store-test')
    expect(usePuzzleStore.getState().percentile).toBeNull()

    // Resolver el último nodo -> completa el puzzle y llama a completeSession
    await usePuzzleStore.getState().submitAnswer('molinos')

    // Esperar microtask para resolución de async completeSession
    await new Promise((r) => setTimeout(r, 50))

    expect(usePuzzleStore.getState().puzzleState?.completedAt).not.toBeNull()
    expect(usePuzzleStore.getState().percentile).toBe(92)
  })

  it('persistencia guarda y recupera sessionId y percentile junto al estado', () => {
    const dummyState: PuzzleState = {
      puzzleId: 'puzzle-persist-test',
      editionNumber: 142,
      publishDate: '2026-10-22',
      rootTemplate: 'Plantilla {{n1}}',
      nodes: {},
      startedAt: Date.now() - 60000,
      completedAt: Date.now(),
      hintsUsed: [],
      mistakesCount: 0,
      score: 100,
      quoteAuthor: 'Cervantes',
      quoteWork: 'Quijote',
      quoteYear: 1605,
      editorialNote: 'Comentario editorial de la obra.',
    }

    const mockStorage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mockStorage.set(key, value)
      },
      removeItem: (key: string) => {
        mockStorage.delete(key)
      },
    })

    // Guardar
    saveState(dummyState, 'persisted-session-123', 85)

    // Recuperar
    const restored = loadSavedState('2026-10-22')
    expect(restored).not.toBeNull()
    expect(restored?.state.puzzleId).toBe('puzzle-persist-test')
    expect(restored?.sessionId).toBe('persisted-session-123')
    expect(restored?.percentile).toBe(85)
  })

  it('apiClient.mergeAnonymousSession envía POST /api/auth/merge y devuelve estadísticas', async () => {
    const mockMergeResponse = {
      success: true,
      userId: 'usr-abc-123',
      anonymousId: 'anon-xyz-789',
      mergedSessionsCount: 3,
      stats: {
        totalPlays: 3,
        totalWins: 2,
        streakCurrent: 2,
        streakMax: 2,
      },
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockMergeResponse,
    } as Response)

    const res = await apiClient.mergeAnonymousSession(
      'anon-xyz-789',
      'usr-abc-123',
      'lector@corchetes.es',
      'Lector',
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/merge'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          anonymousId: 'anon-xyz-789',
          userId: 'usr-abc-123',
          email: 'lector@corchetes.es',
          displayName: 'Lector',
        }),
      }),
    )

    expect(res.success).toBe(true)
    expect(res.mergedSessionsCount).toBe(3)
    expect(res.stats.streakCurrent).toBe(2)
  })

  it('apiClient.getUserStats obtiene las estadísticas acumuladas del usuario', async () => {
    const mockStats = {
      userId: 'usr-123',
      email: 'lector@corchetes.es',
      displayName: 'Lector',
      streakCurrent: 5,
      streakMax: 7,
      totalPlays: 12,
      totalWins: 10,
      winRate: 0.83,
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    } as Response)

    const res = await apiClient.getUserStats('usr-123')

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/user/usr-123/stats'),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(res.streakCurrent).toBe(5)
    expect(res.streakMax).toBe(7)
    expect(res.totalWins).toBe(10)
  })

  it('apiClient.getUserHistory obtiene la lista de crónicas jugadas', async () => {
    const mockHistory = {
      userId: 'usr-123',
      history: [
        {
          sessionId: 'sess-1',
          puzzleId: 'puz-1',
          editionNumber: 142,
          publishDate: '2026-10-23',
          quoteAuthor: 'Cervantes',
          quoteWork: 'Quijote',
          score: 100,
          rankAchieved: 'Gran Maestro',
          durationMs: 95000,
          mistakesCount: 0,
          hintsCount: 0,
          isComplete: true,
          completedAt: '2026-10-23T08:30:00.000Z',
          startedAt: '2026-10-23T08:28:25.000Z',
        },
      ],
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockHistory,
    } as Response)

    const res = await apiClient.getUserHistory('usr-123')

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/user/usr-123/history'),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(res.history.length).toBe(1)
    expect(res.history[0]?.editionNumber).toBe(142)
    expect(res.history[0]?.rankAchieved).toBe('Gran Maestro')
  })

  it('apiClient.createCommunityPuzzle envía POST /api/community/create y devuelve shortId y url', async () => {
    const mockRes = {
      shortId: 'x8k9p2m1',
      url: '/r/x8k9p2m1',
      creatorAlias: 'Lector Test',
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockRes,
    } as Response)

    const payload = {
      markup: 'En un [lugar|sitio] de la Mancha',
      creatorAlias: 'Lector Test',
      nodes: [{ id: 'n1', solution: 'lugar' }],
    }

    const result = await apiClient.createCommunityPuzzle(payload)

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/community/create'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    )
    expect(result.shortId).toBe('x8k9p2m1')
    expect(result.url).toBe('/r/x8k9p2m1')
  })

  it('apiClient.getCommunityPuzzle envía GET /api/community/:shortId y devuelve el reto', async () => {
    const mockPuzzle = {
      id: 'x8k9p2m1',
      creatorAlias: 'Lector Test',
      clientPayload: {
        puzzleId: 'x8k9p2m1',
        editionNumber: 0,
        publishDate: '2026-10-23',
        rootTemplate: 'En un {{n1}} de la Mancha',
        dailySalt: 'salt-x8k9p2m1',
        nodes: {},
        quoteAuthor: 'Cervantes',
        quoteWork: 'Quijote',
        quoteYear: 1605,
        editorialNote: '',
      },
      playsCount: 3,
      createdAt: '2026-10-23T08:00:00.000Z',
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockPuzzle,
    } as Response)

    const result = await apiClient.getCommunityPuzzle('x8k9p2m1')

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/community/x8k9p2m1'),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result.id).toBe('x8k9p2m1')
    expect(result.creatorAlias).toBe('Lector Test')
    expect(result.playsCount).toBe(3)
  })
})



