import type { ReactElement } from 'react'
import styles from './Masthead.module.css'

export interface MastheadProps {
  /** Número de edición, ej. 142 -> "N.º 00142" */
  editionNumber?: number
  /** Fecha en formato YYYY-MM-DD o Date */
  publishDate?: string | Date
  /** Etiqueta central, por defecto "EDICIÓN DIARIA" */
  editionLabel?: string
  /** Clases CSS adicionales */
  className?: string
}

/** Formatea una fecha en mayúsculas estilo cabecera de periódico */
function formatMastheadDate(dateInput?: string | Date): string {
  let date: Date
  if (!dateInput) {
    date = new Date()
  } else if (typeof dateInput === 'string') {
    date = new Date(`${dateInput}T12:00:00`)
  } else {
    date = dateInput
  }

  const days = [
    'DOMINGO',
    'LUNES',
    'MARTES',
    'MIÉRCOLES',
    'JUEVES',
    'VIERNES',
    'SÁBADO',
  ]
  const months = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE',
  ]

  const dayName = days[date.getDay()] ?? 'HOY'
  const day = date.getDate().toString()
  const month = months[date.getMonth()] ?? ''
  const year = date.getFullYear().toString()

  return `${dayName}, ${day} DE ${month} DE ${year}`
}

/**
 * Cabecera editorial clásica de Corchetes estilo prensa decimonónica.
 *
 * Implementa el doble filete tipográfico superior (3px + 1px) e inferior (1px + 3px),
 * fecha en mayúsculas, edición diaria, número de tirada y tracking amplio.
 */
export function Masthead({
  editionNumber = 1,
  publishDate,
  editionLabel = 'EDICIÓN DIARIA',
  className = '',
}: MastheadProps): ReactElement {
  const formattedDate = formatMastheadDate(publishDate)
  const formattedEdition = `N.º ${editionNumber.toString().padStart(5, '0')}`

  return (
    <header className={`${styles.container} ${className}`.trim()} role="banner">
      {/* Filete superior doble */}
      <div className={styles.doubleRuleTop} aria-hidden="true" />

      {/* Metadatos de edición */}
      <div className={styles.metaRow}>
        <time className={styles.date}>{formattedDate}</time>
        <span className={styles.editionLabel}>{editionLabel}</span>
        <span className={styles.editionNumber}>{formattedEdition}</span>
      </div>

      {/* Filete separador simple */}
      <hr className={styles.singleRule} aria-hidden="true" />

      {/* Titular del diario */}
      <div className={styles.branding}>
        <h1 className={styles.title}>C O R C H E T E S</h1>
        <p className={styles.subtitle}>El juego de reconstrucción léxica</p>
      </div>

      {/* Filete inferior doble */}
      <div className={styles.doubleRuleBottom} aria-hidden="true" />
    </header>
  )
}
