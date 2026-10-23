import React from 'react'
import { ImageResponse } from 'next/og'

export interface OgCardOptions {
  editionNumber?: string | number
  date?: string
  author?: string
  work?: string
  year?: string | number
  rank?: string
  score?: string | number
  precision?: string | number
  time?: string
  structure?: string
}

const RANK_BADGES: Record<string, string> = {
  'gran maestro': '★ GRAN MAESTRO',
  'maestro': '■ MAESTRO',
  'cronista': '▲ CRONISTA',
  'escriba': '◆ ESCRIBA',
  'aprendiz': '● APRENDIZ',
}

/** Formatea una fecha en formato hemerográfico español en mayúsculas */
export function formatHemerographicDate(date: Date = new Date()): string {
  const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO']
  const months = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
  ]
  const dayName = days[date.getDay()]
  const dayNum = date.getDate()
  const monthName = months[date.getMonth()]
  const year = date.getFullYear()
  return `${dayName}, ${dayNum} DE ${monthName} DE ${year}`
}

/** Formatea el número de edición con relleno a 5 dígitos */
export function formatEditionLabel(edition?: string | number): string {
  if (!edition || edition === 'today') return 'EDICIÓN DIARIA'
  const num = typeof edition === 'number' ? edition : parseInt(edition, 10)
  if (!isNaN(num)) {
    return `N.º ${num.toString().padStart(5, '0')}`
  }
  return `EDICIÓN ${edition.toString().toUpperCase()}`
}

/**
 * Genera la respuesta ImageResponse con la ficha hemerográfica de Corchetes.
 * Dimensiones: 1200 x 630 px.
 */
export function renderOgImage(options: OgCardOptions = {}): ImageResponse {
  const editionLabel = formatEditionLabel(options.editionNumber)
  const dateStr = options.date || formatHemerographicDate()
  const author = options.author || 'Jorge Luis Borges'
  const work = options.work || 'Ficciones'
  const year = options.year ? ` (${options.year})` : ''
  const structure = options.structure || '[ [ · ] [ [ · ] · ] ]'

  const rankKey = options.rank ? options.rank.toLowerCase().trim() : ''
  const rankBadge = RANK_BADGES[rankKey] || (options.rank ? `■ ${options.rank.toUpperCase()}` : null)

  const hasScore = options.score !== undefined && options.score !== null && options.score !== ''
  const scoreStr = hasScore ? `${options.score} PTS` : null
  const precisionStr = options.precision ? `${options.precision}% PRECISIÓN` : null
  const timeStr = options.time ? `${options.time}` : null

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#F7F4EF',
          color: '#1A1917',
          padding: '40px 50px',
          justifyContent: 'space-between',
          fontFamily: 'serif',
          position: 'relative',
        }}
      >
        {/* Marco doble exterior */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            bottom: 20,
            border: '1px solid #C8C4BB',
            pointerEvents: 'none',
            display: 'flex',
          }}
        />

        {/* ── CABECERA HEMEROGRÁFICA ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Fila superior: Gazeta + Fecha */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              fontSize: 13,
              letterSpacing: 2,
              color: '#6E6A63',
              textTransform: 'uppercase',
              paddingBottom: 8,
              borderBottom: '1px solid #1A1917',
            }}
          >
            <span>ARCHIVO HEMEROGRÁFICO DE CORCHETES</span>
            <span>{dateStr}</span>
          </div>

          {/* Masthead principal */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              paddingTop: 14,
              paddingBottom: 14,
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: 52,
                  fontWeight: 800,
                  letterSpacing: 8,
                  lineHeight: 1,
                  color: '#1A1917',
                }}
              >
                C O R C H E T E S
              </span>
              <span
                style={{
                  fontSize: 14,
                  letterSpacing: 4,
                  color: '#6E6A63',
                  textTransform: 'uppercase',
                  marginTop: 6,
                }}
              >
                El juego de reconstrucción léxica
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 3,
                  color: '#1A1917',
                }}
              >
                {editionLabel}
              </span>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  color: '#8B2500',
                  marginTop: 4,
                  textTransform: 'uppercase',
                }}
              >
                EJEMPLAR REGISTRADO
              </span>
            </div>
          </div>

          {/* Doble filete de linotipia (grueso 3px + fino 1px) */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 3 }}>
            <div style={{ height: 3, backgroundColor: '#1A1917', width: '100%' }} />
            <div style={{ height: 1, backgroundColor: '#1A1917', width: '100%' }} />
          </div>
        </div>

        {/* ── CUERPO DE LA FICHA ─────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            padding: '20px 0',
            gap: 40,
          }}
        >
          {/* Columna Izquierda: Ficha de archivo literario */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              backgroundColor: '#EDE8E0',
              border: '1px solid #C8C4BB',
              padding: '24px 28px',
              borderRadius: 2,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 11,
                letterSpacing: 2,
                color: '#8B2500',
                textTransform: 'uppercase',
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              Ficha hemerográfica de la cita
            </div>

            <div
              style={{
                display: 'flex',
                fontSize: 32,
                fontWeight: 700,
                color: '#1A1917',
                fontStyle: 'italic',
                marginBottom: 6,
              }}
            >
              {author}
            </div>

            <div
              style={{
                display: 'flex',
                fontSize: 20,
                color: '#4A4742',
                fontStyle: 'italic',
                marginBottom: 16,
              }}
            >
              {work}
              {year}
            </div>

            <div
              style={{
                display: 'flex',
                fontSize: 13,
                color: '#6E6A63',
                lineHeight: 1.4,
                borderTop: '1px dashed #C8C4BB',
                paddingTop: 12,
              }}
            >
              El texto original permanece custodiado en el archivo. Descifra las pistas
              anidadas para desvelar la cita completa.
            </div>
          </div>

          {/* Columna Derecha: Árbol minimalista + Sello de rango */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: 380,
              gap: 20,
            }}
          >
            {/* Diagrama de árbol minimalista monocromático (SVG) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 16px',
                border: '1px solid #C8C4BB',
                backgroundColor: '#FAF8F5',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 10,
                  letterSpacing: 2,
                  color: '#6E6A63',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Esquema de anidamiento
              </div>

              <svg width="280" height="90" viewBox="0 0 280 90">
                {/* Líneas de conexión */}
                <line x1="140" y1="18" x2="70" y2="48" stroke="#1A1917" strokeWidth="1.5" />
                <line x1="140" y1="18" x2="210" y2="48" stroke="#1A1917" strokeWidth="1.5" />
                <line x1="70" y1="48" x2="35" y2="76" stroke="#1A1917" strokeWidth="1.5" />
                <line x1="70" y1="48" x2="105" y2="76" stroke="#1A1917" strokeWidth="1.5" />
                <line x1="210" y1="48" x2="175" y2="76" stroke="#1A1917" strokeWidth="1.5" />
                <line x1="210" y1="48" x2="245" y2="76" stroke="#1A1917" strokeWidth="1.5" />

                {/* Nodos del árbol */}
                <circle cx="140" cy="18" r="7" fill="#1A1917" />
                <circle cx="70" cy="48" r="6" fill="#1A1917" />
                <circle cx="210" cy="48" r="6" fill="#FAF8F5" stroke="#1A1917" strokeWidth="2" />
                <circle cx="35" cy="76" r="5" fill="#1A1917" />
                <circle cx="105" cy="76" r="5" fill="#FAF8F5" stroke="#1A1917" strokeWidth="2" />
                <circle cx="175" cy="76" r="5" fill="#1A1917" />
                <circle cx="245" cy="76" r="5" fill="#1A1917" />
              </svg>

              <div
                style={{
                  display: 'flex',
                  fontSize: 13,
                  letterSpacing: 3,
                  fontFamily: 'monospace',
                  color: '#1A1917',
                  marginTop: 6,
                }}
              >
                {structure}
              </div>
            </div>

            {/* Sello de rango tipográfico (estilo estampilla de caucho de hemeroteca) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px double #8B2500',
                padding: '12px 24px',
                backgroundColor: '#FAF3EB',
                width: '100%',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: 2,
                  color: '#8B2500',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {rankBadge ? 'Certificación Editorial' : 'Edición en Curso'}
              </span>

              <span
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: 2,
                  color: rankBadge ? '#8B2500' : '#1A1917',
                  textTransform: 'uppercase',
                }}
              >
                {rankBadge || '■ ENIGMA DIARIO'}
              </span>

              {(scoreStr || precisionStr || timeStr) && (
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    fontSize: 11,
                    letterSpacing: 1,
                    color: '#6E6A63',
                    marginTop: 6,
                    textTransform: 'uppercase',
                  }}
                >
                  {scoreStr && <span>{scoreStr}</span>}
                  {precisionStr && <span>· {precisionStr}</span>}
                  {timeStr && <span>· {timeStr}</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── PIE DE PÁGINA ───────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Filetes inferiores (fino 1px + grueso 3px) */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 3, marginBottom: 12 }}>
            <div style={{ height: 1, backgroundColor: '#1A1917', width: '100%' }} />
            <div style={{ height: 3, backgroundColor: '#1A1917', width: '100%' }} />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              color: '#6E6A63',
            }}
          >
            <span style={{ fontWeight: 700, color: '#1A1917', letterSpacing: 1 }}>
              corchetes.es
            </span>
            <span>El pasatiempo diario que se resuelve de dentro hacia afuera</span>
            <span style={{ fontSize: 11, letterSpacing: 1 }}>DEPÓSITO LEGAL M-2026</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
