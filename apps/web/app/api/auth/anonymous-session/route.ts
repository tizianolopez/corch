import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  ANONYMOUS_ID_COOKIE,
  isValidUuid,
} from '../../../../src/lib/anonymousSession'

export async function GET() {
  const cookieStore = await cookies()
  const existingCookie = cookieStore.get(ANONYMOUS_ID_COOKIE)

  let anonymousId = existingCookie?.value

  if (!anonymousId || !isValidUuid(anonymousId)) {
    anonymousId = crypto.randomUUID()
  }

  const response = NextResponse.json({ anonymousId })

  // Establecer cookie con protección HttpOnly y duración de 1 año
  response.cookies.set(ANONYMOUS_ID_COOKIE, anonymousId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 31536000, // 1 año
  })

  return response
}

export async function POST(request: Request) {
  let requestedId: string | null = null
  try {
    const body = await request.json()
    if (body && typeof body.anonymousId === 'string' && isValidUuid(body.anonymousId)) {
      requestedId = body.anonymousId
    }
  } catch {
    // Body vacío o inválido
  }

  const anonymousId = requestedId || crypto.randomUUID()
  const response = NextResponse.json({ anonymousId })

  response.cookies.set(ANONYMOUS_ID_COOKIE, anonymousId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 31536000,
  })

  return response
}
