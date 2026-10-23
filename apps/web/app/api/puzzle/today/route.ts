import { NextResponse } from 'next/server'
import type { ClientPayload } from '@corchetes/core'

/**
 * Puzle canónico de la Edición 1 ("Un día como hoy") utilizado como fallback
 * garantizado si la base de datos PostgreSQL en la nube no está disponible.
 */
const CANONICAL_FALLBACK_PAYLOAD: ClientPayload = {
  puzzleId: 'corchetes-daily-2026-10-23',
  editionNumber: 1,
  publishDate: '2026-10-23',
  rootTemplate: 'Un día como hoy, pero en 1940, nace en {{n1}} el {{n2}}, recordado por anotar más de mil {{n4}}.',
  dailySalt: 'salt-2026-10-23',
  nodes: {
    n1: {
      id: 'n1',
      clueText: 'la patria de la samba y el carnaval',
      children: [],
      parent: null,
      type: 'reference',
      solutionHash: '88c1ed0828cfc28d5b785f2c440034c543225dcd9c5da5a7b280e500f862641f',
      solutionCipher: '6b8cf57d28e3b26686736dca:84BGpbtTaPrXXabFQO1j8NP5RaYhRg==',
    },
    n2: {
      id: 'n2',
      clueText: 'delantero de Santos que alzó tres {{n3}}',
      children: ['n3'],
      parent: null,
      type: 'reference',
      solutionHash: 'ff5a727fd01736936f8f8dc11295de87b1d51051daea35e9a61501eb8eddb202',
      solutionCipher: 'cf4ecd65555160f27f0b4b6a:avQQfyoJQZqHIjj+YjC9yFcswtSr',
    },
    n3: {
      id: 'n3',
      clueText: 'campeonatos universales de selecciones de fútbol',
      children: [],
      parent: 'n2',
      type: 'definition',
      solutionHash: '184db3b5b3fb585bd5a72c0ab0618bab8ad7df4e9372d889601209a99c19a931',
      solutionCipher: 'a87b31b603b13b056b53d568:85pBKsEy0xE7WkZmJJZCe+mbDTCMs5Wmng==',
    },
    n4: {
      id: 'n4',
      clueText: 'tantos introducidos en la portería',
      children: [],
      parent: null,
      type: 'definition',
      solutionHash: 'be5ef6e06b65b7327fd89c493cd39493c3df89c45c08d86fa0578339b4c22242',
      solutionCipher: '7c6fece1a5c68f2fe6c8bf5e:tX/uF555J1fOQ0+lA2aQhO1s/9s=',
    },
  },
  quoteAuthor: 'Efeméride deportiva y cultural',
  quoteWork: 'Nacimiento de Edson Arantes do Nascimento (Pelé)',
  quoteYear: 1940,
  editorialNote:
    'Un día como hoy en 1940 nace Pelé en Três Corações, coronado como "O Rei" y tricampeón mundial.',
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

  if (dbUrl) {
    try {
      const { createDb, puzzles } = await import('@corchetes/db')
      const { eq, and } = await import('drizzle-orm')
      const db = createDb(dbUrl)
      const today = new Date().toISOString().slice(0, 10)

      const result = await db
        .select()
        .from(puzzles)
        .where(and(eq(puzzles.publishDate, today), eq(puzzles.status, 'PUBLISHED')))
        .limit(1)

      if (result.length > 0 && result[0]?.clientPayload) {
        return NextResponse.json(result[0].clientPayload as ClientPayload, {
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        })
      }
    } catch (err) {
      console.warn('Next.js API route: error al conectar a la BD, usando payload canónico:', err)
    }
  }

  return NextResponse.json(CANONICAL_FALLBACK_PAYLOAD, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
