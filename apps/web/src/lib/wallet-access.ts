type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> }

/**
 * Cabut izin koneksi situs di wallet (wallet_revokePermissions) supaya Sign out juga memutus MetaMask.
 * Upaya terbaik: wallet yang tidak mendukungnya (atau menolak) dibiarkan apa adanya, tanpa galat dan tanpa perubahan.
 */
export async function revokeWalletAccess(): Promise<boolean> {
  try {
    const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum
    if (!eth) return false
    await eth.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] })
    return true
  } catch {
    return false
  }
}
