import { describe, it, expect } from 'vitest'
import {
  isAdminUser,
  isValidAdminSessionToken,
  ADMIN_COOKIE_NAME,
  ADMIN_ROLE_COOKIE,
  ADMIN_DEV_SECRET,
} from '../lib/supabase'
import { shouldRedirectToLogin } from '../../middleware'
import type { User } from '@supabase/supabase-js'

describe('Supabase Auth & Roles (Fase 4.1)', () => {
  // ── 1. Verificación de rol de administrador ─────────────────────────────────

  it('isAdminUser devuelve true si app_metadata.role es admin', () => {
    const adminUser = {
      id: 'usr-1',
      app_metadata: { role: 'admin' },
      user_metadata: {},
    } as unknown as User

    expect(isAdminUser(adminUser)).toBe(true)
  })

  it('isAdminUser devuelve true si app_metadata.roles incluye admin', () => {
    const adminUser = {
      id: 'usr-2',
      app_metadata: { roles: ['editor', 'admin'] },
      user_metadata: {},
    } as unknown as User

    expect(isAdminUser(adminUser)).toBe(true)
  })

  it('isAdminUser devuelve true si user_metadata.role es admin', () => {
    const adminUser = {
      id: 'usr-3',
      app_metadata: {},
      user_metadata: { role: 'admin' },
    } as unknown as User

    expect(isAdminUser(adminUser)).toBe(true)
  })

  it('isAdminUser devuelve false para usuarios estándar o sin rol admin', () => {
    const regularUser = {
      id: 'usr-4',
      app_metadata: { role: 'player' },
      user_metadata: { role: 'user' },
    } as unknown as User

    expect(isAdminUser(regularUser)).toBe(false)
    expect(isAdminUser(null)).toBe(false)
    expect(isAdminUser(undefined)).toBe(false)
  })

  // ── 2. Validación de tokens de sesión de administración ──────────────────────

  it('isValidAdminSessionToken valida el token secreto de administración y variantes válidas', () => {
    expect(isValidAdminSessionToken(ADMIN_DEV_SECRET)).toBe(true)
    expect(isValidAdminSessionToken('admin')).toBe(true)
    expect(isValidAdminSessionToken('admin-session-xyz123')).toBe(true)

    expect(isValidAdminSessionToken('token-invalido')).toBe(false)
    expect(isValidAdminSessionToken('')).toBe(false)
    expect(isValidAdminSessionToken(null)).toBe(false)
    expect(isValidAdminSessionToken(undefined)).toBe(false)
  })

  // ── 3. Lógica del middleware de protección de rutas /admin/* ────────────────

  describe('shouldRedirectToLogin (Middleware)', () => {
    it('no redirige la página de login /admin/login', () => {
      const redirect = shouldRedirectToLogin('/admin/login', {})
      expect(redirect).toBe(false)
    })

    it('no redirige rutas públicas como /api o /_next', () => {
      expect(shouldRedirectToLogin('/api/health', {})).toBe(false)
      expect(shouldRedirectToLogin('/_next/static/chunk.js', {})).toBe(false)
    })

    it('redirige /admin y subrutas cuando no existen cookies de autenticación', () => {
      expect(shouldRedirectToLogin('/admin', {})).toBe(true)
      expect(shouldRedirectToLogin('/admin/calendar', {})).toBe(true)
      expect(shouldRedirectToLogin('/admin/editor', {})).toBe(true)
    })

    it('permite el acceso cuando existe una cookie de sesión de admin válida', () => {
      const cookies = {
        [ADMIN_COOKIE_NAME]: ADMIN_DEV_SECRET,
      }
      expect(shouldRedirectToLogin('/admin', cookies)).toBe(false)
      expect(shouldRedirectToLogin('/admin/drafts', cookies)).toBe(false)
    })

    it('permite el acceso cuando existe la cookie corchetes_admin_role=admin', () => {
      const cookies = {
        [ADMIN_ROLE_COOKIE]: 'admin',
      }
      expect(shouldRedirectToLogin('/admin', cookies)).toBe(false)
    })

    it('permite el acceso cuando la cookie de Supabase Auth contiene usuario con rol admin', () => {
      const supabaseUser = {
        user: {
          app_metadata: { role: 'admin' },
        },
      }
      const cookies = {
        'sb-project-auth-token': encodeURIComponent(JSON.stringify(supabaseUser)),
      }
      expect(shouldRedirectToLogin('/admin', cookies)).toBe(false)
    })

    it('redirige al login cuando la cookie de Supabase Auth es de un usuario sin rol admin', () => {
      const standardUser = {
        user: {
          app_metadata: { role: 'player' },
        },
      }
      const cookies = {
        'sb-project-auth-token': encodeURIComponent(JSON.stringify(standardUser)),
      }
      expect(shouldRedirectToLogin('/admin', cookies)).toBe(true)
    })
  })
})
