import { NextResponse } from 'next/server'
import type { ClientPayload } from '@corchetes/core'
import { TODAY_PAYLOAD } from '../../../../src/data/puzzles'

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

  return NextResponse.json(TODAY_PAYLOAD, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
