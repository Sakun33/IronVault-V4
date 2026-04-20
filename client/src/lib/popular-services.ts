export interface PopularPasswordService {
  name: string;
  url: string;
  category: string;
  icon?: string;
}

export const POPULAR_PASSWORD_SERVICES: PopularPasswordService[] = [
  { name: 'Google', url: 'https://google.com', category: 'Email' },
  { name: 'GitHub', url: 'https://github.com', category: 'Developer Tools' },
  { name: 'Apple', url: 'https://appleid.apple.com', category: 'Cloud Storage' },
  { name: 'Microsoft', url: 'https://microsoft.com', category: 'Productivity' },
  { name: 'Netflix', url: 'https://netflix.com', category: 'Entertainment' },
  { name: 'Amazon', url: 'https://amazon.com', category: 'Shopping' },
  { name: 'Twitter/X', url: 'https://x.com', category: 'Social Media' },
  { name: 'LinkedIn', url: 'https://linkedin.com', category: 'Social Media' },
  { name: 'Facebook', url: 'https://facebook.com', category: 'Social Media' },
  { name: 'Instagram', url: 'https://instagram.com', category: 'Social Media' },
  { name: 'Dropbox', url: 'https://dropbox.com', category: 'Cloud Storage' },
  { name: 'Slack', url: 'https://slack.com', category: 'Work' },
];

export interface PopularSubscriptionService {
  name: string;
  url: string;
  category: string;
  cost?: number;
  billingCycle?: 'monthly' | 'yearly';
}

export const POPULAR_SUBSCRIPTION_SERVICES: PopularSubscriptionService[] = [
  { name: 'Netflix', url: 'https://netflix.com', category: 'Streaming', cost: 15.49, billingCycle: 'monthly' },
  { name: 'Spotify', url: 'https://spotify.com', category: 'Music', cost: 9.99, billingCycle: 'monthly' },
  { name: 'Apple Music', url: 'https://music.apple.com', category: 'Music', cost: 10.99, billingCycle: 'monthly' },
  { name: 'YouTube Premium', url: 'https://youtube.com/premium', category: 'Streaming', cost: 13.99, billingCycle: 'monthly' },
  { name: 'Disney+', url: 'https://disneyplus.com', category: 'Streaming', cost: 7.99, billingCycle: 'monthly' },
  { name: 'Amazon Prime', url: 'https://amazon.com/prime', category: 'Shopping', cost: 14.99, billingCycle: 'monthly' },
  { name: 'iCloud+', url: 'https://icloud.com', category: 'Cloud Storage', cost: 2.99, billingCycle: 'monthly' },
  { name: 'Google One', url: 'https://one.google.com', category: 'Cloud Storage', cost: 2.99, billingCycle: 'monthly' },
  { name: 'Microsoft 365', url: 'https://microsoft365.com', category: 'Productivity', cost: 9.99, billingCycle: 'monthly' },
  { name: 'Notion', url: 'https://notion.so', category: 'Productivity', cost: 10, billingCycle: 'monthly' },
  { name: 'ChatGPT Plus', url: 'https://chat.openai.com', category: 'AI Tools', cost: 20, billingCycle: 'monthly' },
  { name: 'Claude Pro', url: 'https://claude.ai', category: 'AI Tools', cost: 20, billingCycle: 'monthly' },
  { name: 'GitHub Copilot', url: 'https://github.com/copilot', category: 'Developer Tools', cost: 10, billingCycle: 'monthly' },
  { name: 'Figma', url: 'https://figma.com', category: 'Design', cost: 15, billingCycle: 'monthly' },
  { name: 'Adobe CC', url: 'https://adobe.com', category: 'Design', cost: 54.99, billingCycle: 'monthly' },
  { name: 'Hulu', url: 'https://hulu.com', category: 'Streaming', cost: 7.99, billingCycle: 'monthly' },
  { name: 'HBO Max', url: 'https://max.com', category: 'Streaming', cost: 15.99, billingCycle: 'monthly' },
  { name: '1Password', url: 'https://1password.com', category: 'Security', cost: 2.99, billingCycle: 'monthly' },
  { name: 'NordVPN', url: 'https://nordvpn.com', category: 'Security', cost: 3.99, billingCycle: 'monthly' },
  { name: 'Duolingo Plus', url: 'https://duolingo.com', category: 'Education', cost: 6.99, billingCycle: 'monthly' },
];

export const POPULAR_API_SERVICES = [
  'OpenAI', 'Anthropic', 'Stripe', 'Twilio', 'SendGrid', 'AWS', 'Google Cloud',
  'Azure', 'GitHub', 'GitLab', 'Cloudflare', 'Vercel', 'Supabase', 'Firebase',
  'Mapbox', 'Algolia', 'Pinecone', 'Hugging Face', 'Replicate', 'Groq',
];

export function detectCategoryFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (/github|gitlab|bitbucket|stackoverflow|dev\.to|heroku|netlify|vercel/.test(u)) return 'Developer Tools';
  if (/google|gmail|yahoo|outlook|protonmail/.test(u)) return 'Email';
  if (/netflix|hulu|disney|youtube|twitch|spotify|apple\.com\/music/.test(u)) return 'Entertainment';
  if (/facebook|instagram|twitter|x\.com|linkedin|tiktok|reddit|pinterest/.test(u)) return 'Social Media';
  if (/amazon|ebay|etsy|shopify|shop|store/.test(u)) return 'Shopping';
  if (/bank|paypal|stripe|wise|revolut|coinbase|crypto/.test(u)) return 'Finance';
  if (/notion|slack|asana|trello|jira|monday|zoom|teams|meet/.test(u)) return 'Work';
  if (/dropbox|drive|icloud|onedrive|box\.com/.test(u)) return 'Cloud Storage';
  if (/vpn|1password|bitwarden|lastpass|dashlane/.test(u)) return 'Security';
  if (/edu|university|coursera|udemy|duolingo|khan/.test(u)) return 'Education';
  return '';
}
