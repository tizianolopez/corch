import type { ClientPayload } from '@corchetes/core'
import { getOrCreateAnonymousId } from '../lib/anonymousSession'

export interface StartSessionResponse {
  sessionId: string
  puzzleId: string
  startedAt: string
  anonymousId?: string
}

export interface HintRevealResponse {
  success: boolean
  hintType: 'reveal'
  nodeId: string
  solution: string
}

export interface HintMatrixResponse {
  success: boolean
  hintType: 'matrix'
  nodeId: string
  initialLetter: string
}

export type HintResponse = HintRevealResponse | HintMatrixResponse

export interface CompleteSessionPayload {
  sessionId: string
  durationMs: number
  mistakesCount: number
  hintsUsed: {
    nodeId: string
    type: 'matrix' | 'reveal'
    at: number
  }[]
  score: number
  rankAchieved: string
}

export interface CompleteSessionResponse {
  success: boolean
  sessionId: string
  isComplete: boolean
  score: number
  rankAchieved: string
  percentile: number
}

export interface MergeSessionResponse {
  success: boolean
  userId: string
  anonymousId: string
  mergedSessionsCount: number
  stats: {
    totalPlays: number
    totalWins: number
    streakCurrent: number
    streakMax: number
  }
}

export interface UserStatsResponse {
  userId: string
  email: string | null
  displayName: string | null
  streakCurrent: number
  streakMax: number
  totalPlays: number
  totalWins: number
  winRate: number
}

export interface UserHistoryItem {
  sessionId: string
  puzzleId: string
  editionNumber: number | null
  publishDate: string | null
  quoteAuthor: string | null
  quoteWork: string | null
  score: number | null
  rankAchieved: string | null
  durationMs: number | null
  mistakesCount: number
  hintsCount: number
  isComplete: boolean
  completedAt: string | null
  startedAt: string
}

export interface UserHistoryResponse {
  userId: string
  history: UserHistoryItem[]
}


export class ApiClientError extends Error {
  statusCode?: number
  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'ApiClientError'
    this.statusCode = statusCode
  }
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || ''
  }
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
}

/**
 * Cliente HTTP tipado para apps/api
 */
export const apiClient = {
  /**
   * Obtiene el payload seguro del puzle del día (GET /api/puzzle/today)
   */
  async getTodayPuzzle(): Promise<ClientPayload> {
    const res = await fetch(`${getBaseUrl()}/api/puzzle/today`, {
      method: 'GET',
      credentials: 'omit',
    })

    if (!res.ok) {
      throw new ApiClientError(
        `Error al obtener el puzle del día: ${res.statusText}`,
        res.status,
      )
    }

    return (await res.json()) as ClientPayload
  },

  /**
   * Inicia una sesión de juego (POST /api/session/start)
   */
  async startSession(
    puzzleId: string,
    anonymousId?: string,
  ): Promise<StartSessionResponse> {
    const effectiveAnonymousId =
      anonymousId || (typeof window !== 'undefined' ? getOrCreateAnonymousId() : undefined)

    const res = await fetch(`${getBaseUrl()}/api/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        puzzleId,
        ...(effectiveAnonymousId ? { anonymousId: effectiveAnonymousId } : {}),
      }),
    })

    if (!res.ok) {
      throw new ApiClientError(
        `Error al iniciar sesión de juego: ${res.statusText}`,
        res.status,
      )
    }

    return (await res.json()) as StartSessionResponse
  },

  /**
   * Solicita una pista al servidor (POST /api/session/hint)
   * Para 'reveal', el servidor devuelve la solución en texto plano.
   */
  async requestHint(
    sessionId: string,
    nodeId: string,
    hintType: 'matrix' | 'reveal',
  ): Promise<HintResponse> {
    const res = await fetch(`${getBaseUrl()}/api/session/hint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        nodeId,
        hintType,
      }),
    })

    if (!res.ok) {
      throw new ApiClientError(
        `Error al solicitar pista (${hintType}): ${res.statusText}`,
        res.status,
      )
    }

    return (await res.json()) as HintResponse
  },

  /**
   * Notifica la compleción de la partida y obtiene el percentil en tiempo real
   * (POST /api/session/complete)
   */
  async completeSession(
    payload: CompleteSessionPayload,
  ): Promise<CompleteSessionResponse> {
    const res = await fetch(`${getBaseUrl()}/api/session/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new ApiClientError(
        `Error al completar la sesión de juego: ${res.statusText}`,
        res.status,
      )
    }

    return (await res.json()) as CompleteSessionResponse
  },

  /**
   * Vincula las partidas de una sesión anónima a una cuenta de usuario registrada (POST /api/auth/merge)
   */
  async mergeAnonymousSession(
    anonymousId: string,
    userId: string,
    email?: string,
    displayName?: string,
  ): Promise<MergeSessionResponse> {
    const res = await fetch(`${getBaseUrl()}/api/auth/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        anonymousId,
        userId,
        ...(email ? { email } : {}),
        ...(displayName ? { displayName } : {}),
      }),
    })

    if (!res.ok) {
      throw new ApiClientError(
        `Error al fusionar sesión anónima con la cuenta: ${res.statusText}`,
        res.status,
      )
    }

    return (await res.json()) as MergeSessionResponse
  },

  /**
   * Obtiene las estadísticas acumuladas y racha del usuario (GET /api/user/:userId/stats)
   */
  async getUserStats(userId: string): Promise<UserStatsResponse> {
    const res = await fetch(`${getBaseUrl()}/api/user/${encodeURIComponent(userId)}/stats`, {
      method: 'GET',
    })

    if (!res.ok) {
      throw new ApiClientError(
        `Error al obtener estadísticas del usuario: ${res.statusText}`,
        res.status,
      )
    }

    return (await res.json()) as UserStatsResponse
  },

  /**
   * Obtiene el historial de crónicas y ediciones jugadas (GET /api/user/:userId/history)
   */
  async getUserHistory(userId: string): Promise<UserHistoryResponse> {
    const res = await fetch(`${getBaseUrl()}/api/user/${encodeURIComponent(userId)}/history`, {
      method: 'GET',
    })

    if (!res.ok) {
      throw new ApiClientError(
        `Error al obtener historial del usuario: ${res.statusText}`,
        res.status,
      )
    }

    return (await res.json()) as UserHistoryResponse
  },

  /**
   * Crea un nuevo reto de la comunidad (POST /api/community/create)
   */
  async createCommunityPuzzle(
    data: CreateCommunityPuzzlePayload,
  ): Promise<CreateCommunityPuzzleResponse> {
    const res = await fetch(`${getBaseUrl()}/api/community/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new ApiClientError(
        errorData.message || `Error al crear el reto de la comunidad: ${res.statusText}`,
        res.status,
      )
    }

    return (await res.json()) as CreateCommunityPuzzleResponse
  },

  /**
   * Obtiene un reto de la comunidad por su ID corto (GET /api/community/:shortId)
   */
  async getCommunityPuzzle(shortId: string): Promise<CommunityPuzzleResponse> {
    const res = await fetch(`${getBaseUrl()}/api/community/${encodeURIComponent(shortId)}`, {
      method: 'GET',
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new ApiClientError(
        errorData.message || `Error al obtener el reto de la comunidad: ${res.statusText}`,
        res.status,
      )
    }

    return (await res.json()) as CommunityPuzzleResponse
  },
}

export interface CreateCommunityPuzzlePayload {
  markup: string
  creatorAlias?: string
  quoteAuthor?: string
  quoteWork?: string
  quoteYear?: number
  editorialNote?: string
  nodes?: {
    id: string
    solution: string
    type?: string
  }[]
}

export interface CreateCommunityPuzzleResponse {
  shortId: string
  url: string
  creatorAlias: string
}

export interface CommunityPuzzleResponse {
  id: string
  creatorAlias: string
  clientPayload: ClientPayload
  playsCount: number
  createdAt: string
}



