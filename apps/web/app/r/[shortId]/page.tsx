import type { Metadata } from 'next'
import { CommunityGameClient } from './CommunityGameClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortId: string }>
}): Promise<Metadata> {
  const { shortId } = await params
  const title = `Reto de la comunidad #${shortId} — Corchetes`
  const description =
    'Resuelve este enigma literario creado por un lector de la comunidad de Corchetes.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://corchetes.es/r/${shortId}`,
      images: [
        {
          url: `/api/og?edition=${shortId}`,
          width: 1200,
          height: 630,
          alt: `Corchetes — Reto de la comunidad #${shortId}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og?edition=${shortId}`],
    },
  }
}

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ shortId: string }>
}) {
  const { shortId } = await params
  return <CommunityGameClient shortId={shortId} />
}
