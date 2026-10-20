/**
 * Utilidades criptográficas de Corchetes.
 *
 * Implementadas con la Web Crypto API nativa (disponible en Node.js ≥ 19,
 * navegadores modernos y Deno). Sin dependencias externas.
 *
 * Fuente de verdad: arquitectura_corchetes.md §9
 *
 * REGLA CRÍTICA: Este módulo nunca expone una función que devuelva la
 * solución en claro sin requerir la propia respuesta del usuario como clave.
 */

import type { ClientClueNode, ClientPayload } from '@corchetes/core'

// ─── SHA-256 ──────────────────────────────────────────────────────────────────

/**
 * Calcula el hash SHA-256 de una cadena UTF-8.
 * Devuelve el resultado como string hexadecimal en minúsculas (64 chars).
 *
 * Usado para verificar respuestas del jugador en el cliente.
 * El mismo hash se genera en el servidor durante compilePuzzlePayload().
 *
 * @param input - Cadena a hashear
 * @returns Hash hex de 64 caracteres
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── AES-GCM ──────────────────────────────────────────────────────────────────

/**
 * Deriva una clave AES-256-GCM a partir de una cadena de texto (la respuesta normalizada).
 * Usa SHA-256 de la cadena como material de clave (32 bytes = 256 bits).
 *
 * @internal
 */
async function deriveKey(keyString: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = encoder.encode(keyString)
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyMaterial)

  return crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

/**
 * Cifra un texto con AES-256-GCM.
 * La clave es la respuesta normalizada del jugador.
 *
 * El resultado es una cadena Base64 con el formato: {iv_hex}:{ciphertext_base64}
 * El IV (12 bytes) es aleatorio y se incluye en el resultado.
 *
 * @param plaintext - Texto a cifrar (solución original, ej. "Sendero")
 * @param key - Clave de cifrado (respuesta normalizada, ej. "sendero")
 * @returns Cadena cifrada en formato "{iv_hex}:{ciphertext_base64}"
 */
export async function aesGcmEncrypt(plaintext: string, key: string): Promise<string> {
  const cryptoKey = await deriveKey(key)
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  // IV aleatorio de 12 bytes (96 bits) — recomendado para AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data)

  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)))

  return `${ivHex}:${cipherBase64}`
}

/**
 * Descifra un texto cifrado con AES-256-GCM.
 * La clave debe ser la misma respuesta normalizada que se usó para cifrar.
 *
 * @param cipher - Cadena en formato "{iv_hex}:{ciphertext_base64}"
 * @param key - Clave de descifrado (respuesta normalizada del jugador)
 * @returns Texto original descifrado
 * @throws Error si la clave es incorrecta o el cifrado está corrupto
 */
export async function aesGcmDecrypt(cipher: string, key: string): Promise<string> {
  const colonIndex = cipher.indexOf(':')
  if (colonIndex === -1) {
    throw new Error('aesGcmDecrypt: formato de cipher inválido (debe ser "{iv_hex}:{ciphertext}")')
  }

  const ivHex = cipher.slice(0, colonIndex)
  const cipherBase64 = cipher.slice(colonIndex + 1)

  // Reconstruir IV desde hex
  const matches = ivHex.match(/.{2}/g)
  if (!matches) {
    throw new Error('aesGcmDecrypt: formato de IV hexadecimal inválido')
  }
  const iv = new Uint8Array(matches.map((byte) => parseInt(byte, 16)))

  // Reconstruir ciphertext desde Base64
  const cipherBytes = Uint8Array.from(atob(cipherBase64), (c) => c.charCodeAt(0))

  const cryptoKey = await deriveKey(key)

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    cipherBytes,
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedBuffer)
}

// ─── Compilación del payload seguro ──────────────────────────────────────────

export interface RawPuzzleNode {
  id: string
  clueText: string
  children: string[]
  parent: string | null
  type: ClientClueNode['type']
  /** Solución en texto plano (solo existe en el servidor) */
  solution: string
}

export interface RawPuzzle {
  puzzleId: string
  editionNumber: number
  publishDate: string
  rootTemplate: string
  nodes: Record<string, RawPuzzleNode>
  quoteAuthor: string
  quoteWork: string
  quoteYear: number
  editorialNote: string
}

/**
 * Compila el payload seguro que se envía al cliente.
 *
 * Para cada nodo:
 *   1. Normaliza la solución.
 *   2. Genera solutionHash = SHA-256(normalized:puzzleId:nodeId:dailySalt)
 *   3. Genera solutionCipher = AES-GCM(soluciónOriginal, clave=normalized)
 *   4. Incluye en el payload solo hash + cipher, nunca la solución.
 *
 * @param raw - Puzle completo con soluciones en texto plano (solo en servidor)
 * @param dailySalt - Salt público del día (rotado diariamente)
 * @param normalizeFn - Función de normalización de @corchetes/core
 * @returns ClientPayload seguro, listo para cachear en CDN
 */
export async function compilePuzzlePayload(
  raw: RawPuzzle,
  dailySalt: string,
  normalizeFn: (input: string) => string,
): Promise<ClientPayload> {
  const clientNodes: Record<string, ClientClueNode> = {}

  for (const [id, node] of Object.entries(raw.nodes)) {
    const normalizedSolution = normalizeFn(node.solution)
    const hashInput = `${normalizedSolution}:${raw.puzzleId}:${id}:${dailySalt}`

    const [solutionHash, solutionCipher] = await Promise.all([
      sha256(hashInput),
      aesGcmEncrypt(node.solution, normalizedSolution),
    ])

    clientNodes[id] = {
      id: node.id,
      clueText: node.clueText,
      children: node.children,
      parent: node.parent,
      type: node.type,
      solutionHash,
      solutionCipher,
    }
  }

  return {
    puzzleId: raw.puzzleId,
    editionNumber: raw.editionNumber,
    publishDate: raw.publishDate,
    rootTemplate: raw.rootTemplate,
    nodes: clientNodes,
    dailySalt,
    quoteAuthor: raw.quoteAuthor,
    quoteWork: raw.quoteWork,
    quoteYear: raw.quoteYear,
    editorialNote: raw.editorialNote,
  }
}
