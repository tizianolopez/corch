import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import {
  getOrCreateAnonymousId,
  isValidUuid,
  ANONYMOUS_ID_STORAGE_KEY,
  ANONYMOUS_ID_COOKIE,
  getAnonymousIdFromCookie,
} from '../lib/anonymousSession'

class MockStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

let cookieStore = ''
const mockDocument = {
  get cookie() {
    return cookieStore
  },
  set cookie(val: string) {
    if (val.includes('max-age=0')) {
      cookieStore = ''
    } else {
      cookieStore = val.split(';')[0] ?? ''
    }
  },
}

describe('Anonymous Session Management (Fase 5.1)', () => {
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalLocalStorage = globalThis.localStorage

  beforeEach(() => {
    cookieStore = ''
    const storage = new MockStorage()
    // @ts-expect-error Mocking browser globals in Node test environment
    globalThis.window = {}
    // @ts-expect-error Mocking browser globals in Node test environment
    globalThis.document = mockDocument
    // @ts-expect-error Mocking browser globals in Node test environment
    globalThis.localStorage = storage
  })

  afterAll(() => {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.localStorage = originalLocalStorage
  })

  it('valida correctamente cadenas con formato UUIDv4', () => {
    expect(isValidUuid('c389bf44-6721-4fa3-80f4-5f5647573981')).toBe(true)
    expect(isValidUuid('invalid-uuid')).toBe(false)
    expect(isValidUuid(12345)).toBe(false)
    expect(isValidUuid(null)).toBe(false)
  })

  it('genera y persiste un anonymousId en localStorage y cookie si no existe', () => {
    const id = getOrCreateAnonymousId()

    expect(isValidUuid(id)).toBe(true)
    expect(localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY)).toBe(id)
    expect(getAnonymousIdFromCookie()).toBe(id)
  })

  it('reutiliza el mismo anonymousId en llamadas consecutivas', () => {
    const firstId = getOrCreateAnonymousId()
    const secondId = getOrCreateAnonymousId()

    expect(firstId).toBe(secondId)
  })

  it('recupera el anonymousId existente en localStorage si la cookie está vacía', () => {
    const existingId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d'
    localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, existingId)

    const retrieved = getOrCreateAnonymousId()
    expect(retrieved).toBe(existingId)
    expect(getAnonymousIdFromCookie()).toBe(existingId)
  })

  it('recupera el anonymousId existente en la cookie si localStorage está vacío', () => {
    const cookieId = '99999999-8888-4777-9666-555555555555'
    document.cookie = `${ANONYMOUS_ID_COOKIE}=${cookieId}; path=/`

    const retrieved = getOrCreateAnonymousId()
    expect(retrieved).toBe(cookieId)
    expect(localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY)).toBe(cookieId)
  })
})
