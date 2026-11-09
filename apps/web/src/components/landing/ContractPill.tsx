import { NEXA_CA, NEXA_CA_URL } from '@/lib/site'

/** Contract address $NEXA (hanya alamat); klik membuka halaman token di explorer Robinhood Chain. */
export function ContractPill() {
  return (
    <a className="ca" href={NEXA_CA_URL} target="_blank" rel="noopener" aria-label={`$NEXA contract address ${NEXA_CA}, buka di explorer Robinhood Chain`}>
      {NEXA_CA}
    </a>
  )
}
