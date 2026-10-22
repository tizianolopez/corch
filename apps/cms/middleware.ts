/**
 * @module middleware
 *
 * Middleware de Next.js para proteger todas las rutas del panel de administración (/admin/*).
 * Redirige a /admin/login si el usuario no tiene una sesión de rol `admin`.
 *
 * Fuente de verdad: docs/tasks.md §4.1
 */

import { NextResponse, type NextRequest } from 'next/server'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_ROLE_COOKIE,
  isValidAdminSessionToken,
} from './src/lib/supabase'

/**
 * Determina de forma pura si una petición a una ruta administrativa debe ser redirigida
 * a la pantalla de login.
 * (Exportada para tests unitarios exhaustivos con Vitest).
 *
 * @param pathname Ruta solicitada
 * @param cookies Mapa de cookies recibidas
 */
export function shouldRedirectToLogin(
  pathname: string,
  cookies: Record<string, string | undefined>,
): boolean {
  // 1. Las rutas públicas o estáticas nunca se redirigen
  if (
    !pathname.startsWith('/admin') ||
    pathname === '/admin/login' ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next')
  ) {
    return false
  }

  // 2. Comprobar cookie de sesión de admin de Corchetes
  const sessionToken = cookies[ADMIN_COOKIE_NAME]
  const roleToken = cookies[ADMIN_ROLE_COOKIE]

  if (isValidAdminSessionToken(sessionToken) || roleToken === 'admin') {
    return false
  }

  // 3. Comprobar cookies estándar de Supabase Auth (sb-*-auth-token)
  for (const [key, value] of Object.entries(cookies)) {
    if (key.startsWith('sb-') && key.endsWith('-auth-token') && value) {
      try {
        const parsed = JSON.parse(decodeURIComponent(value))
        const user = parsed?.user ?? parsed?.[0]?.user
        const role = user?.app_metadata?.role || user?.user_metadata?.role
        if (role === 'admin') {
          return false
        }
      } catch {
        // Formato no JSON o token crudo
      }
    }
  }

  // Si no se encontró ninguna sesión válida de admin, redirigir al login
  return true
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Extraer cookies en un record simple
  const cookiesRecord: Record<string, string | undefined> = {}
  request.cookies.getAll().forEach((c) => {
    cookiesRecord[c.name] = c.value
  })

  if (shouldRedirectToLogin(pathname, cookiesRecord)) {
    const loginUrl = new URL('/admin/login', request.url)
    if (pathname !== '/admin') {
      loginUrl.searchParams.set('redirect', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
