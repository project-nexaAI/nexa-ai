import { Cta } from '@/components/landing/Cta'
import { Feed } from '@/components/landing/Feed'
import { Footer } from '@/components/landing/Footer'
import { Hero } from '@/components/landing/Hero'
import { How } from '@/components/landing/How'
import { Marquee } from '@/components/landing/Marquee'
import { Nav } from '@/components/landing/Nav'
import { Pricing } from '@/components/landing/Pricing'
import { Proof } from '@/components/landing/Proof'
import { Roadmap } from '@/components/landing/Roadmap'
import { Rules } from '@/components/landing/Rules'
import { Sprite } from '@/components/landing/Sprite'
import { Token } from '@/components/landing/Token'
import { LandingEffects } from '@/components/LandingEffects'
import { api, safe } from '@/lib/api'
import { loadNxData } from '@/lib/nx-data'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [data, market, radar] = await Promise.all([loadNxData(), safe(api().getMarket()), safe(api().getRugRadar())])
  return (
    <>
      <Sprite />
      <Nav />
      <Hero />
      <Marquee />
      <main className="wrap">
        <Proof latest={data.latest} />
        <Feed market={market} radar={radar} />
        <How />
        <Pricing />
        <Rules />
        <Token />
        <Roadmap />
      </main>
      <Cta />
      <Footer />
      <LandingEffects data={data} />
    </>
  )
}
