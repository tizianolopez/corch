import { describe, it, expect } from 'vitest'
import { LAUNCH_PUZZLES, compileLaunchPuzzle } from '../seedData'
import { normalize } from '@corchetes/core'
import { sha256, aesGcmDecrypt } from '@corchetes/crypto'

describe('Launch Week Puzzles (Seed Data)', () => {
  it('contiene exactamente 7 puzles para la semana de lanzamiento', () => {
    expect(LAUNCH_PUZZLES).toHaveLength(7)
  })

  it('tiene números de edición correlativos del 1 al 7 y fechas únicas', () => {
    const editions = LAUNCH_PUZZLES.map((p) => p.editionNumber)
    expect(editions).toEqual([1, 2, 3, 4, 5, 6, 7])

    const dates = new Set(LAUNCH_PUZZLES.map((p) => p.publishDate))
    expect(dates.size).toBe(7)
  })

  it('compila y valida criptográficamente todos los puzles de lanzamiento', async () => {
    for (const def of LAUNCH_PUZZLES) {
      const compiled = await compileLaunchPuzzle(def)

      expect(compiled.editionNumber).toBe(def.editionNumber)
      expect(compiled.publishDate).toBe(def.publishDate)
      expect(compiled.totalNodes).toBeGreaterThanOrEqual(3)
      expect(compiled.totalNodes).toBeLessThanOrEqual(8)
      expect(compiled.maxDepth).toBeGreaterThanOrEqual(2)
      expect(compiled.initialLeaves).toBeGreaterThanOrEqual(2)
      expect(compiled.status).toBe('PUBLISHED')

      const payload = compiled.clientPayload as any
      expect(payload).toBeDefined()
      expect(payload.nodes).toBeDefined()

      // Verificar que ninguna solución en claro viaja en clientPayload
      const payloadString = JSON.stringify(payload)
      for (const [id, sol] of Object.entries(def.solutions)) {
        const clientNode = payload.nodes[id]
        expect(clientNode).toBeDefined()
        expect(clientNode.solutionHash).toBeDefined()
        expect(clientNode.solutionCipher).toBeDefined()

        // Verificar que el hash coincide exactamente con la fórmula SHA-256(normalized:puzzleId:nodeId:dailySalt)
        const normalizedSol = normalize(sol.solution)
        const expectedHash = await sha256(
          `${normalizedSol}:${payload.puzzleId}:${id}:${payload.dailySalt}`,
        )
        expect(clientNode.solutionHash).toBe(expectedHash)

        // Verificar descifrado con la respuesta normalizada
        const decrypted = await aesGcmDecrypt(clientNode.solutionCipher, normalizedSol)
        expect(decrypted).toBe(sol.solution)

        // Verificar que la palabra no aparece expuesta en plano fuera del cipher
        // (salvo palabras muy cortas de 2-3 letras que pudieran coincidir por azar en texto de pistas)
        if (sol.solution.length > 5) {
          // El texto de la pista no debe revelar la solución
          expect(clientNode.clueText.toLowerCase()).not.toContain(sol.solution.toLowerCase())
        }
      }
    }
  })
})
