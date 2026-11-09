import { NEXA_CA, NEXA_CA_URL } from '@/lib/site'

/** Contract address $NEXA; klik membuka halaman token di explorer Robinhood Chain. */
export function ContractPill() {
  const short = `${NEXA_CA.slice(0, 6)}…${NEXA_CA.slice(-4)}`
  return (
    <a className="ca" href={NEXA_CA_URL} target="_blank" rel="noopener" aria-label={`$NEXA contract address ${NEXA_CA}, buka di explorer Robinhood Chain`}>
      <span className="ca-k">CA</span>
      <span className="ca-full">{NEXA_CA}</span>
      <span className="ca-short">{short}</span>
      <span className="ca-ar" aria-hidden="true">↗</span>
    </a>
  )
}
