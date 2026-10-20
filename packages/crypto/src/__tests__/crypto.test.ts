import { describe, it, expect } from 'vitest'
import { sha256, aesGcmEncrypt, aesGcmDecrypt, compilePuzzlePayload } from '../index.js'
import type { RawPuzzle } from '../index.js'

describe('sha256', () => {
  it('genera un hash de 64 caracteres hexadecimales en minúsculas', async () => {
    const hash = await sha256('test')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('es determinista para el mismo input', async () => {
    const hash1 = await sha256('corchetes:2026:n1:salt')
    const hash2 = await sha256('corchetes:2026:n1:salt')
    expect(hash1).toBe(hash2)
  })

  it('produce hashes distintos para inputs ligeramente diferentes', async () => {
    const hashA = await sha256('canon')
    const hashB = await sha256('cañon')
    expect(hashA).not.toBe(hashB)
  })

  it('hashea correctamente el string vacío (SHA-256 conocido)', async () => {
    const emptyHash = await sha256('')
    expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('aesGcmEncrypt y aesGcmDecrypt', () => {
  it('cifra y descifra texto plano preservando mayúsculas y acentos (round-trip)', async () => {
    const plaintext = '¡Cien Años de Soledad!'
    const key = 'cien años de soledad'

    const cipher = await aesGcmEncrypt(plaintext, key)
    expect(cipher).toContain(':')

    const decrypted = await aesGcmDecrypt(cipher, key)
    expect(decrypted).toBe(plaintext)
  })

  it('genera ciphers diferentes para el mismo texto debido al IV aleatorio', async () => {
    const plaintext = 'palabra'
    const key = 'palabra'

    const cipher1 = await aesGcmEncrypt(plaintext, key)
    const cipher2 = await aesGcmEncrypt(plaintext, key)

    expect(cipher1).not.toBe(cipher2)
    // Pero ambos descifran al mismo texto
    expect(await aesGcmDecrypt(cipher1, key)).toBe(plaintext)
    expect(await aesGcmDecrypt(cipher2, key)).toBe(plaintext)
  })

  it('falla al intentar descifrar con clave incorrecta', async () => {
    const plaintext = 'Secreto'
    const correctKey = 'secreto'
    const wrongKey = 'intruso'

    const cipher = await aesGcmEncrypt(plaintext, correctKey)
    await expect(aesGcmDecrypt(cipher, wrongKey)).rejects.toThrow()
  })

  it('lanza error con formato de cipher inválido (sin dos puntos)', async () => {
    await expect(aesGcmDecrypt('formatoinvalido', 'key')).rejects.toThrow(
      'aesGcmDecrypt: formato de cipher inválido',
    )
  })
})

describe('compilePuzzlePayload', () => {
  it('compila raw puzzle a client payload sin exponer la solución en claro', async () => {
    const mockRaw: RawPuzzle = {
      puzzleId: 'puzzle-1',
      editionNumber: 10,
      publishDate: '2026-10-20',
      rootTemplate: 'Frase {{n1}}',
      nodes: {
        n1: {
          id: 'n1',
          clueText: 'Pista de prueba',
          children: [],
          parent: null,
          type: 'definition',
          solution: 'Cañón',
        },
      },
      quoteAuthor: 'Autor',
      quoteWork: 'Obra',
      quoteYear: 1999,
      editorialNote: 'Nota',
    }

    const dailySalt = 'salt-secreto-publico'
    const dummyNormalize = (s: string) => s.toLowerCase().replace('ó', 'o') // simple normalizador

    const clientPayload = await compilePuzzlePayload(mockRaw, dailySalt, dummyNormalize)

    expect(clientPayload.puzzleId).toBe('puzzle-1')
    expect(clientPayload.editionNumber).toBe(10)
    expect(clientPayload.dailySalt).toBe(dailySalt)

    const clientNode = clientPayload.nodes['n1']
    expect(clientNode).toBeDefined()
    expect(clientNode?.clueText).toBe('Pista de prueba')

    // Verificar que NUNCA contiene el campo solution
    expect((clientNode as Record<string, unknown>)['solution']).toBeUndefined()

    // Verificar hash y cipher
    expect(clientNode?.solutionHash).toBeDefined()
    expect(clientNode?.solutionCipher).toBeDefined()

    // Comprobar que descifrando con la solución normalizada obtenemos "Cañón"
    expect(clientNode).toBeDefined()
    if (clientNode) {
      const decrypted = await aesGcmDecrypt(clientNode.solutionCipher, dummyNormalize('Cañón'))
      expect(decrypted).toBe('Cañón')
    }
  })
})
