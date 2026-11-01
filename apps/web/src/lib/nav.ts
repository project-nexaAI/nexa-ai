/** Menu navbar dan footer dikelompokkan di satu tempat. `hash` = jangkar di landing (diawali `base`), `href` = rute. */
export interface NavItem {
  label: string
  href?: string
  hash?: string
}
export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Track record',
    items: [
      { label: 'Proof of Intelligence', href: '/proof' },
      { label: 'NEXA vs KOL', href: '/leaderboard' },
      { label: 'Burn tracker', href: '/burn' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Rug radar', href: '/rug-radar' },
      { label: 'Ask NEXA', href: '/ask' },
      { label: 'Signals API', href: '/signals' },
    ],
  },
  {
    label: 'Plans',
    items: [
      { label: 'NEXA Pro', href: '/pro' },
      { label: 'Sponsored report', href: '/sponsored' },
      { label: 'Pricing overview', hash: '#pricing' },
    ],
  },
]

/** Tautan tunggal di navbar (bagian landing) di luar grup. */
export const NAV_DIRECT: NavItem[] = [
  { label: 'How it works', hash: '#how' },
  { label: '$NEXA', hash: '#token' },
]

export const itemHref = (i: NavItem, base: string) => i.href ?? `${base}${i.hash ?? ''}`
