import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId, score, rankAchieved } = body

    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
    if (dbUrl && sessionId) {
      try {
        const { createDb, playSessions } = await import('@corchetes/db')
        const { eq } = await import('drizzle-orm')
        const db = createDb(dbUrl)
        await db
          .update(playSessions)
          .set({
            isComplete: true,
            completedAt: new Date(),
            durationMs: body.durationMs,
            mistakesCount: body.mistakesCount,
            score: body.score,
            rankAchieved: body.rankAchieved,
          })
          .where(eq(playSessions.id, sessionId))
      } catch (err) {
        console.warn('Error al actualizar sesión en BD:', err)
      }
    }

    return NextResponse.json({
      success: true,
      sessionId,
      isComplete: true,
      score: score ?? 1000,
      rankAchieved: rankAchieved ?? 'Gran Maestro',
      percentile: 85,
    })
  } catch {
    return NextResponse.json({ error: 'Error al completar sesión' }, { status: 400 })
  }
}
