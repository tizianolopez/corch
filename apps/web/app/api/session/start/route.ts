import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sessionId = randomUUID()
    const now = new Date()

    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
    if (dbUrl) {
      try {
        const { createDb, playSessions } = await import('@corchetes/db')
        const db = createDb(dbUrl)
        await db.insert(playSessions).values({
          id: sessionId,
          puzzleId: body.puzzleId,
          userId: body.userId || null,
          anonymousId: body.userId ? null : body.anonymousId || randomUUID(),
          startedAt: now,
          mistakesCount: 0,
          hintsUsed: [],
          isComplete: false,
        })
      } catch (err) {
        console.warn('Error al guardar sesión en BD en Next.js route:', err)
      }
    }

    return NextResponse.json({
      sessionId,
      puzzleId: body.puzzleId,
      startedAt: now.toISOString(),
      anonymousId: body.anonymousId,
    })
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
}
