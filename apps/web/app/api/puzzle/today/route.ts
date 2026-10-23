import { NextResponse } from 'next/server'
import type { ClientPayload } from '@corchetes/core'

/**
 * Puzle canónico de la Edición 1 ("Un día como hoy") utilizado como fallback
 * garantizado si la base de datos PostgreSQL en la nube no está disponible.
 */
const CANONICAL_FALLBACK_PAYLOAD: ClientPayload = {
  puzzleId: 'corchetes-tutorial',
  editionNumber: 0,
  publishDate: '2026-10-23',
  rootTemplate: 'En Corchetes se avanza siempre hacia {{n1}}, descifrando cada {{n3}} con {{n4}} por el lenguaje.',
  dailySalt: 'salt-tutorial',
  nodes: {
    n1: {
      id: 'n1',
      clueText: 'el destino al que sales desde {{n2}}',
      children: ['n2'],
      parent: null,
      type: 'reference',
      solutionHash: 'f126f80b3601c4effbf6f0bf0a4ba8a33dfba60e8259f08b2a9b637f7e6ef65a',
      solutionCipher: '67a6e0b3389fb73db1242e13:+RBwdYMGB9SrDbOM6c12nbf6+2l6kg==',
    },
    n2: {
      id: 'n2',
      clueText: 'lo contrario de fuera',
      children: [],
      parent: 'n1',
      type: 'definition',
      solutionHash: 'd369d51bfe8e83ed9d3903b7affad7aafd4145ef37232ebb058039faf3fa49d3',
      solutionCipher: '5adfa928dbc759e6505a6d0f:hI5k5/rEdLP8GxZyGov5HRG2neD80A==',
    },
    n3: {
      id: 'n3',
      clueText: 'misterio que se guarda oculto',
      children: [],
      parent: null,
      type: 'definition',
      solutionHash: 'e96151def46afe4211366c1b10092937abc4cf74f37f13b801779ef3230cb4ac',
      solutionCipher: '1fb97dd4f47506274c3ace72:Ev+YjG6pgcZYLzGXw3PhDPPJHv3HVvg=',
    },
    n4: {
      id: 'n4',
      clueText: 'el deshojado y revuelto RAMO',
      children: [],
      parent: null,
      type: 'anagram',
      solutionHash: '3199e42d0f6b656014a762ce0ccf8efe416a1d2c4bcb73d9a956e305b1963d5e',
      solutionCipher: '67a5e88897642bb6c6a1cc11:rZrmjbJ+mT6lH66SkR1udkGK/UE=',
    },
  },
  quoteAuthor: 'Guía del iniciado',
  quoteWork: 'Cómo jugar a Corchetes',
  quoteYear: 2026,
  editorialNote:
    '¡Enhorabuena! Has completado el tutorial. Recuerda: en Corchetes se resuelve de dentro hacia afuera. Al resolver «dentro», desbloqueaste la pista exterior para hallar «afuera».',
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
