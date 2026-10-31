import { parseAbi } from 'viem'

// Tanda tangan event dari docs.ponsfamily.com/v2 (2026-10-31). Event lain (CurveCompleted, PoolGraduated, ...)
// belum punya tanda tangan lengkap di docs, jadi belum di-index (lihat BLOCKERS #7).
export const factoryAbi = parseAbi([
  'event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)',
])

// CurveCompleted dipulihkan dari chain (2026-10-31), bukan dari docs Pons: hash topic0 cocok dengan
// CurveCompleted(address,uint256,uint256) dan event nyata muncul tepat saat curve mencapai graduationThreshold
// (kata ke-2 = cadangan quote >= threshold). Nama parameter diberikan sendiri.
export const curveAbi = parseAbi([
  'event CurveCompleted(address token, uint256 quoteReserve, uint256 tokenReserve)',
  'event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)',
  'event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)',
  'function creatorTaxBps() view returns (uint256)',
])

export const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
])

export const transferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])

/** Event Burned dari BurnVault (contracts/src/BurnVault.sol). */
export const burnedAbi = parseAbi(['event Burned(address indexed caller, uint256 pairSpent, uint256 nexaBurned)'])
