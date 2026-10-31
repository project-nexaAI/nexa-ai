/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skrip gerak dari desain memanipulasi DOM sekali saat mount; StrictMode (efek dobel di dev) akan menjalankannya dua kali.
  reactStrictMode: false,
  transpilePackages: ['@nexa-ai/api-client'],
  // Fixture API ada di docs/ (di luar apps/web), jadi pelacakan file memakai root monorepo.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
}

export default nextConfig
