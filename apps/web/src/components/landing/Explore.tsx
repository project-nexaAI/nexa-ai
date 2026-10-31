const ITEMS = [
  { href: '/proof', title: 'Proof of Intelligence', text: 'Win rate, average return, and every commit with its Blockscout link.' },
  { href: '/rug-radar', title: 'Rug radar', text: 'New Pons V2 launches in real time, with creator tax and concentration flags.' },
  { href: '/leaderboard', title: 'NEXA vs KOL', text: 'An accuracy leaderboard for KOLs who agree to be scored.' },
  { href: '/burn', title: 'Burn tracker', text: 'Every $NEXA buy-and-burn, verifiable on-chain.' },
  { href: '/ask', title: 'Ask NEXA', text: 'A $1 risk summary for any token, paid in USDG.' },
  { href: '/account', title: 'Account', text: 'Sign in with your wallet to check $NEXA holder benefits.' },
] as const

/** Pintu masuk ke halaman dashboard dari landing. */
export function Explore() {
  return (
    <section className="sec" id="explore">
      <div className="head">
        <div>
          <div className="label">Dashboards</div>
          <h2>
            Look at the data
            <br />
            <span className="dim">yourself.</span>
          </h2>
        </div>
      </div>
      <div className="ex-grid">
        {ITEMS.map((i) => (
          <a key={i.href} href={i.href} className="card ex-card">
            <h3>{i.title}</h3>
            <p>{i.text}</p>
            <span className="go">Open →</span>
          </a>
        ))}
      </div>
    </section>
  )
}
