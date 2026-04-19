const BRAND_COLORS: Record<string, string> = {
  google: '#4285F4',
  gmail: '#EA4335',
  youtube: '#FF0000',
  netflix: '#E50914',
  spotify: '#1DB954',
  amazon: '#FF9900',
  facebook: '#1877F2',
  instagram: '#E4405F',
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  github: '#181717',
  gitlab: '#FC6D26',
  apple: '#A2AAAD',
  icloud: '#3693F3',
  microsoft: '#00A4EF',
  office: '#D83B01',
  outlook: '#0078D4',
  discord: '#5865F2',
  slack: '#4A154B',
  whatsapp: '#25D366',
  telegram: '#26A5E4',
  signal: '#3A76F0',
  reddit: '#FF4500',
  pinterest: '#E60023',
  tiktok: '#010101',
  snapchat: '#FFFC00',
  twitch: '#9146FF',
  paypal: '#003087',
  stripe: '#635BFF',
  revolut: '#0075EB',
  wise: '#48C2B0',
  venmo: '#3D95CE',
  cashapp: '#00D64F',
  chase: '#117ACA',
  hdfc: '#004C8F',
  sbi: '#22409A',
  icici: '#F36F21',
  axis: '#97144D',
  kotak: '#ED1C24',
  steam: '#1B2838',
  epic: '#313131',
  xbox: '#107C10',
  playstation: '#003087',
  nintendo: '#E60012',
  notion: '#000000',
  figma: '#F24E1E',
  adobe: '#FF0000',
  canva: '#00C4CC',
  zoom: '#2D8CFF',
  dropbox: '#0061FF',
  onedrive: '#0078D4',
  proton: '#6D4AFF',
  nordvpn: '#4687FF',
  expressvpn: '#DA1D29',
  '1password': '#1A8CFF',
  lastpass: '#D32D27',
  bitwarden: '#175DDC',
  dashlane: '#0E353D',
  cloudflare: '#F38020',
  vercel: '#000000',
  netlify: '#00C7B7',
  aws: '#FF9900',
  azure: '#0078D4',
  digitalocean: '#0080FF',
  heroku: '#430098',
  hulu: '#1CE783',
  'disney+': '#113CCF',
  'prime video': '#00A8E0',
  max: '#002BE7',
  peacock: '#F0368E',
  deezer: '#FF0092',
  tidal: '#000000',
  spotify: '#1DB954',
  'apple music': '#FC3C44',
  'apple tv': '#000000',
};

export function getBrandColor(name: string): string {
  const n = name.toLowerCase().trim();
  for (const [k, color] of Object.entries(BRAND_COLORS)) {
    if (n === k) return color;
  }
  for (const [k, color] of Object.entries(BRAND_COLORS)) {
    if (n.includes(k) || k.includes(n)) return color;
  }
  return '#6366F1';
}

export interface CategoryConfig {
  color: string;
  emoji: string;
}

export const EXPENSE_CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  'Food & Dining': { color: '#f97316', emoji: '🍽️' },
  'Transportation': { color: '#3b82f6', emoji: '🚗' },
  'Housing': { color: '#8b5cf6', emoji: '🏠' },
  'Bills & Utilities': { color: '#eab308', emoji: '⚡' },
  'Healthcare': { color: '#ef4444', emoji: '💊' },
  'Health & Fitness': { color: '#22c55e', emoji: '💪' },
  'Shopping': { color: '#ec4899', emoji: '🛍️' },
  'Entertainment': { color: '#a855f7', emoji: '🎬' },
  'Education': { color: '#0ea5e9', emoji: '📚' },
  'Travel': { color: '#06b6d4', emoji: '✈️' },
  'Insurance': { color: '#64748b', emoji: '🛡️' },
  'Subscriptions': { color: '#8b5cf6', emoji: '♾️' },
  'Business': { color: '#6366f1', emoji: '💼' },
  'Investments': { color: '#10b981', emoji: '📈' },
  'Personal Care': { color: '#f43f5e', emoji: '✨' },
  'Gifts & Donations': { color: '#f59e0b', emoji: '🎁' },
  'Other': { color: '#6366f1', emoji: '💰' },
};

export function getExpenseCategoryConfig(category: string): CategoryConfig {
  return EXPENSE_CATEGORY_CONFIG[category] ?? { color: '#6366F1', emoji: '💰' };
}

export const INVESTMENT_TYPE_CONFIG: Record<string, CategoryConfig> = {
  fixed_deposit: { color: '#6366F1', emoji: '🏦' },
  recurring_deposit: { color: '#8b5cf6', emoji: '💰' },
  mutual_fund: { color: '#0ea5e9', emoji: '📈' },
  stocks: { color: '#10b981', emoji: '📊' },
  bonds: { color: '#3b82f6', emoji: '📋' },
  crypto: { color: '#f59e0b', emoji: '₿' },
  nft: { color: '#ec4899', emoji: '🎨' },
  futures: { color: '#ef4444', emoji: '⚡' },
  debt: { color: '#64748b', emoji: '📄' },
  real_estate: { color: '#8b5cf6', emoji: '🏠' },
  other: { color: '#6366F1', emoji: '📦' },
};

export function getInvestmentTypeConfig(type: string): CategoryConfig {
  return INVESTMENT_TYPE_CONFIG[type] ?? { color: '#6366F1', emoji: '📦' };
}
