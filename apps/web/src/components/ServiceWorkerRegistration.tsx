'use client'

import { useEffect, useState, type ReactElement } from 'react'
import styles from './ServiceWorkerRegistration.module.css'

export function ServiceWorkerRegistration(): ReactElement | null {
  const [isOffline, setIsOffline] = useState(false)
  const [justCameOnline, setJustCameOnline] = useState(false)

  useEffect(() => {
    // 1. Registro del Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            // Comprobar actualizaciones
            registration.onupdatefound = () => {
              const installingWorker = registration.installing
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                      // Nueva versión disponible en segundo plano
                    }
                  }
                }
              }
            }
          })
          .catch((err) => {
            console.warn('[PWA] Error al registrar el Service Worker:', err)
          })
      })
    }

    // 2. Detección de conectividad online/offline
    const handleOffline = () => {
      setIsOffline(true)
      setJustCameOnline(false)
    }

    const handleOnline = () => {
      setIsOffline(false)
      setJustCameOnline(true)
      setTimeout(() => setJustCameOnline(false), 3000)
    }

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine)
      window.addEventListener('offline', handleOffline)
      window.addEventListener('online', handleOnline)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('offline', handleOffline)
        window.removeEventListener('online', handleOnline)
      }
    }
  }, [])

  if (isOffline) {
    return (
      <aside className={styles.offlineNotice} role="status" aria-live="polite">
        <span className={styles.badgeDot}>■</span>
        <span>Modo sin conexión · Pliego disponible en caché</span>
      </aside>
    )
  }

  if (justCameOnline) {
    return (
      <aside
        className={[styles.offlineNotice, styles.offlineNoticeOnline].join(' ')}
        role="status"
        aria-live="polite"
      >
        <span className={styles.badgeDotOnline}>●</span>
        <span>Conexión restablecida · En línea</span>
      </aside>
    )
  }

  return null
}
