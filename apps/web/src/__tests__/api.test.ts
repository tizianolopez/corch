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
})
