// Token sesi login wallet disimpan di sessionStorage (hilang saat tab ditutup). Semua akses dibungkus try/catch:
// penyimpanan bisa diblokir (mode privat) dan halaman harus tetap jalan tanpanya.
const KEY = 'nexa_session'

export function getToken(): string | null {
  try {
    return window.sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    window.sessionStorage.setItem(KEY, token)
  } catch {
    /* tanpa penyimpanan: sesi hanya hidup selama halaman terbuka */
  }
}

export function clearToken(): void {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    /* abaikan */
  }
}
