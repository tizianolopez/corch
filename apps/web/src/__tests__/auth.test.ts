import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  supabase,
  signInWithMagicLink,
  signInWithGoogle,
  signOutUser,
  getCurrentUser,
  onAuthStateChange,
} from '../lib/supabase'

describe('Player Authentication (Fase 5.2 - Registro y Login)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('signInWithMagicLink', () => {
    it('rechaza direcciones de correo vacías o inválidas sin llamar a Supabase', async () => {
      const emptyRes = await signInWithMagicLink('')
      expect(emptyRes.error).toBeInstanceOf(Error)
      expect(emptyRes.error?.message).toContain('correo electrónico válida')

      const invalidRes = await signInWithMagicLink('correo-invalido-sin-arroba')
      expect(invalidRes.error).toBeInstanceOf(Error)
      expect(invalidRes.error?.message).toContain('correo electrónico válida')
    })

    it('llama a signInWithOtp con el correo limpio y devuelve éxito', async () => {
      const signInOtpSpy = vi
        .spyOn(supabase.auth, 'signInWithOtp')
        .mockResolvedValueOnce({
          data: { user: null, session: null },
          error: null,
        } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithOtp>>)

      const result = await signInWithMagicLink('  Lector@Ejemplo.Com  ', 'https://corchetes.es/auth/callback')

      expect(signInOtpSpy).toHaveBeenCalledWith({
        email: 'lector@ejemplo.com',
        options: {
          emailRedirectTo: 'https://corchetes.es/auth/callback',
        },
      })
      expect(result.error).toBeNull()
    })

    it('devuelve el error si Supabase falla al enviar el Magic Link', async () => {
      vi.spyOn(supabase.auth, 'signInWithOtp').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { name: 'AuthError', message: 'Rate limit exceeded' },
      } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithOtp>>)

      const result = await signInWithMagicLink('lector@ejemplo.com')
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('Rate limit exceeded')
    })
  })

  describe('signInWithGoogle', () => {
    it('llama a signInWithOAuth con el proveedor google y opciones de redirección', async () => {
      const signInOAuthSpy = vi
        .spyOn(supabase.auth, 'signInWithOAuth')
        .mockResolvedValueOnce({
          data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=...' },
          error: null,
        } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithOAuth>>)

      const result = await signInWithGoogle('https://corchetes.es/auth/callback')

      expect(signInOAuthSpy).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'https://corchetes.es/auth/callback',
        },
      })
      expect(result.error).toBeNull()
      expect(result.url).toContain('accounts.google.com')
    })

    it('devuelve error si falla signInWithOAuth', async () => {
      vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValueOnce({
        data: { provider: 'google', url: null },
        error: { name: 'AuthError', message: 'OAuth provider error' },
      } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithOAuth>>)

      const result = await signInWithGoogle()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('OAuth provider error')
    })
  })

  describe('signOutUser', () => {
    it('cierra la sesión del usuario a través de Supabase Auth', async () => {
      const signOutSpy = vi
        .spyOn(supabase.auth, 'signOut')
        .mockResolvedValueOnce({
          error: null,
        } as unknown as Awaited<ReturnType<typeof supabase.auth.signOut>>)

      const result = await signOutUser()

      expect(signOutSpy).toHaveBeenCalled()
      expect(result.error).toBeNull()
    })

    it('propaga error si signOut falla', async () => {
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({
        error: { name: 'AuthError', message: 'No active session' },
      } as unknown as Awaited<ReturnType<typeof supabase.auth.signOut>>)

      const result = await signOutUser()

      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('No active session')
    })
  })

  describe('getCurrentUser', () => {
    it('devuelve el usuario si hay sesión activa', async () => {
      const mockUser = { id: 'usr-123', email: 'lector@corchetes.es' }
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>)

      const user = await getCurrentUser()

      expect(user).toEqual(mockUser)
    })

    it('devuelve null si no hay usuario o hay error', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: { user: null },
        error: { name: 'AuthError', message: 'Invalid JWT' },
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>)

      const user = await getCurrentUser()

      expect(user).toBeNull()
    })
  })

  describe('onAuthStateChange', () => {
    it('registra el listener y devuelve una función de desuscripción', () => {
      const mockUnsubscribe = vi.fn()
      const onAuthSpy = vi
        .spyOn(supabase.auth, 'onAuthStateChange')
        .mockReturnValueOnce({
          data: {
            subscription: {
              id: 'sub-1',
              callback: vi.fn(),
              unsubscribe: mockUnsubscribe,
            },
          },
          error: null,
        } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>)

      const callback = vi.fn()
      const sub = onAuthStateChange(callback)

      expect(onAuthSpy).toHaveBeenCalledWith(callback)
      sub.unsubscribe()
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    })
  })
})
