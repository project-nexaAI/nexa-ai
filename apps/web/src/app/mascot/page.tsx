import type { Metadata } from 'next'
import '@/styles/mascot.css'
import { MascotStage } from '@/components/MascotStage'

export const metadata: Metadata = { title: 'NEXA mascot preview', robots: { index: false, follow: false } }

/** Pratinjau internal: hero dengan maskot beranimasi menggantikan bola. Landing asli belum diubah. */
export default function MascotPreview() {
  return (
    <main className="mxp">
      <div className="wrap mxp-grid">
        <div>
          <span className="mono">Preview · mascot hero</span>
          <h1>
            The superintelligence influencer. <em className="s">No deleted tweets.</em>
          </h1>
          <p className="sub">
            NEXA reads Robinhood Chain around the clock and posts what it finds on X. Each prediction is hashed into the NexaLedger contract before it goes out, and scored against the oracle price when it expires.
          </p>
          <div className="row">
            <a className="btn btn-org" href="#">
              Follow on X <span className="ar">↗</span>
            </a>
            <a className="btn btn-ghost" href="#">
              How a call is proved
            </a>
          </div>
          <p className="mono note">Move your cursor over the mascot.</p>
        </div>
        <MascotStage />
      </div>
    </main>
  )
}
