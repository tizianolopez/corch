import type { ClientPayload } from '@corchetes/core'

export interface StartSessionResponse {
  sessionId: string
  puzzleId: string
  startedAt: string
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
      headers: { credentials: 'omit' },
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
    const res = await fetch(`${getBaseUrl()}/api/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        puzzleId,
        ...(anonymousId ? { anonymousId } : {}),
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
}
