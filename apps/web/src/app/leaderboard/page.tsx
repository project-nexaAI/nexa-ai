import type { Metadata } from 'next'
import { Empty, PageShell } from '@/components/pages/PageShell'
import { api, safe } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'NEXA vs KOL · NEXA', alternates: { canonical: '/leaderboard' } }

export default async function LeaderboardPage() {
  const board = await safe(api().getLeaderboard())
  const kols = board?.entries.filter((e) => !e.isNexa) ?? []
  return (
    <PageShell
      label="NEXA vs KOL"
      title="Accuracy,"
      dim="not follower count."
      intro="A public leaderboard of call accuracy. Only KOLs who agreed to be scored appear here, and every call links to the original post."
    >
      {!board ? (
        <Empty title="Data unavailable">The leaderboard could not be loaded right now. Try again in a moment.</Empty>
      ) : (
        <>
          <div className="pg-list">
            {board.entries.map((e) => (
              <div key={e.handle} className={`pg-row lb${e.isNexa ? ' nexa' : ''}`}>
                <span className="pg-rank">{e.rank ? `#${e.rank}` : '—'}</span>
                <div className="main">
                  <b>{e.displayName}</b>
                  <span>@{e.handle}</span>
                </div>
                <div className="cell">
                  <span className="k">Win rate</span>
                  <span className="mono-v">{e.formatted.winRate ?? '—'}</span>
                </div>
                <div className="cell">
                  <span className="k">Avg return</span>
                  <span className="mono-v">{e.formatted.avgReturn ?? '—'}</span>
                </div>
                <div className="cell">
                  <span className="k">Scored · pending</span>
                  <span className="mono-v">
                    {e.scored} · {e.pending}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {kols.length === 0 ? (
            <div style={{ marginTop: 18 }}>
              <Empty title="No KOLs scored yet">KOLs who want to be judged are added with a link to each public call.</Empty>
            </div>
          ) : null}
          <p className="pg-note" style={{ marginTop: 22 }}>
            Ranking needs at least {board.minScored} scored calls; below that the rank shows “—”. NEXA’s calls are committed on-chain before they are posted. KOL calls are
            not, so they are scored from the linked public post and the oracle price: the evidence is weaker. Return is measured in the direction of the call.
          </p>
        </>
      )}
    </PageShell>
  )
}
