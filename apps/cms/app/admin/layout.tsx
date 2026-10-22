'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_ROLE_COOKIE,
  supabase,
} from '../../src/lib/supabase'
import styles from './adminLayout.module.css'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // Si estamos en la página de login, renderizar únicamente la página sin sidebar
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  const handleLogout = async () => {
    // 1. Cerrar sesión en Supabase si está disponible
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignorar fallos de red en signOut
    }

    // 2. Eliminar cookies administrativas
    document.cookie = `${ADMIN_COOKIE_NAME}=; path=/; max-age=0`
    document.cookie = `${ADMIN_ROLE_COOKIE}=; path=/; max-age=0`

    // 3. Redirigir a login
    router.push('/admin/login')
    router.refresh()
  }

  const navLinks = [
    { href: '/admin', label: 'Cola de Borradores' },
    { href: '/admin/calendar', label: 'Calendario de Publicación' },
    { href: '/admin/editor', label: 'Editor Manual' },
    { href: '/admin/analytics', label: 'Analíticas y Métricas' },
  ]

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logo}>Corchetes</div>
          <span className={styles.badge}>Panel Editorial</span>
        </div>

        <nav className={styles.nav}>
          {navLinks.map((link) => {
            const isActive =
              link.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navItem} ${
                  isActive ? styles.navItemActive : ''
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className={styles.footer}>
          <button
            type="button"
            onClick={handleLogout}
            className={styles.btnLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            Supervisión y Publicación Diaria
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  )
}
