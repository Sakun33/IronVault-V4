import { useState } from 'react';

// Maps common service names to their domains so we can fetch favicons
// even when no URL is stored on the entry.
const SERVICE_DOMAINS: Record<string, string> = {
  // Streaming / Video
  netflix: 'netflix.com',
  youtube: 'youtube.com',
  'youtube premium': 'youtube.com',
  'disney+': 'disneyplus.com',
  'disney plus': 'disneyplus.com',
  hulu: 'hulu.com',
  'hbo max': 'hbomax.com',
  'max': 'max.com',
  'prime video': 'primevideo.com',
  'amazon prime': 'primevideo.com',
  twitch: 'twitch.tv',
  crunchyroll: 'crunchyroll.com',
  peacock: 'peacocktv.com',
  'apple tv': 'tv.apple.com',
  'apple tv+': 'tv.apple.com',
  // Music
  spotify: 'spotify.com',
  'apple music': 'music.apple.com',
  'amazon music': 'music.amazon.com',
  tidal: 'tidal.com',
  deezer: 'deezer.com',
  soundcloud: 'soundcloud.com',
  pandora: 'pandora.com',
  // Social / Messaging
  facebook: 'facebook.com',
  instagram: 'instagram.com',
  twitter: 'twitter.com',
  x: 'x.com',
  'twitter/x': 'x.com',
  linkedin: 'linkedin.com',
  snapchat: 'snapchat.com',
  tiktok: 'tiktok.com',
  reddit: 'reddit.com',
  pinterest: 'pinterest.com',
  tumblr: 'tumblr.com',
  discord: 'discord.com',
  slack: 'slack.com',
  telegram: 'telegram.org',
  whatsapp: 'whatsapp.com',
  signal: 'signal.org',
  mastodon: 'mastodon.social',
  // Tech / Cloud
  google: 'google.com',
  'google one': 'one.google.com',
  microsoft: 'microsoft.com',
  'microsoft 365': 'microsoft.com',
  'office 365': 'microsoft365.com',
  apple: 'apple.com',
  icloud: 'icloud.com',
  'icloud+': 'icloud.com',
  github: 'github.com',
  gitlab: 'gitlab.com',
  dropbox: 'dropbox.com',
  'google drive': 'drive.google.com',
  onedrive: 'onedrive.live.com',
  notion: 'notion.so',
  figma: 'figma.com',
  adobe: 'adobe.com',
  'adobe creative cloud': 'adobe.com',
  canva: 'canva.com',
  vercel: 'vercel.com',
  netlify: 'netlify.com',
  cloudflare: 'cloudflare.com',
  aws: 'aws.amazon.com',
  'amazon web services': 'aws.amazon.com',
  'google cloud': 'cloud.google.com',
  azure: 'azure.microsoft.com',
  digitalocean: 'digitalocean.com',
  heroku: 'heroku.com',
  // Shopping / E-commerce
  amazon: 'amazon.com',
  ebay: 'ebay.com',
  shopify: 'shopify.com',
  etsy: 'etsy.com',
  // Finance / Banking
  paypal: 'paypal.com',
  stripe: 'stripe.com',
  revolut: 'revolut.com',
  wise: 'wise.com',
  'google pay': 'pay.google.com',
  'apple pay': 'apple.com',
  venmo: 'venmo.com',
  cashapp: 'cash.app',
  'cash app': 'cash.app',
  chase: 'chase.com',
  'bank of america': 'bankofamerica.com',
  wells: 'wellsfargo.com',
  'wells fargo': 'wellsfargo.com',
  hdfc: 'hdfcbank.com',
  'hdfc bank': 'hdfcbank.com',
  sbi: 'onlinesbi.sbi.co.in',
  icici: 'icicibank.com',
  'icici bank': 'icicibank.com',
  axis: 'axisbank.com',
  'axis bank': 'axisbank.com',
  kotak: 'kotak.com',
  // Productivity / Tools
  zoom: 'zoom.us',
  'google meet': 'meet.google.com',
  teams: 'teams.microsoft.com',
  'microsoft teams': 'teams.microsoft.com',
  jira: 'atlassian.net',
  atlassian: 'atlassian.com',
  confluence: 'atlassian.net',
  trello: 'trello.com',
  asana: 'asana.com',
  monday: 'monday.com',
  'monday.com': 'monday.com',
  basecamp: 'basecamp.com',
  clickup: 'clickup.com',
  airtable: 'airtable.com',
  todoist: 'todoist.com',
  '1password': '1password.com',
  lastpass: 'lastpass.com',
  dashlane: 'dashlane.com',
  bitwarden: 'bitwarden.com',
  nordvpn: 'nordvpn.com',
  expressvpn: 'expressvpn.com',
  proton: 'proton.me',
  'proton mail': 'proton.me',
  'proton vpn': 'protonvpn.com',
  protonmail: 'proton.me',
  gmail: 'gmail.com',
  outlook: 'outlook.live.com',
  yahoo: 'yahoo.com',
  // Gaming
  steam: 'store.steampowered.com',
  epic: 'epicgames.com',
  'epic games': 'epicgames.com',
  xbox: 'xbox.com',
  'xbox game pass': 'xbox.com',
  playstation: 'playstation.com',
  'playstation plus': 'playstation.com',
  'ps plus': 'playstation.com',
  nintendo: 'nintendo.com',
  'nintendo switch online': 'nintendo.com',
  // News / Reading
  medium: 'medium.com',
  substack: 'substack.com',
  patreon: 'patreon.com',
  'new york times': 'nytimes.com',
  nytimes: 'nytimes.com',
  'the economist': 'economist.com',
  audible: 'audible.com',
  kindle: 'kindle.amazon.com',
};

function getDomain(url?: string, name?: string): string | null {
  // 1. Try extracting domain from URL
  if (url) {
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      return u.hostname.replace(/^www\./, '');
    } catch { /* fall through */ }
  }
  // 2. Look up service name in map
  if (name) {
    const key = name.toLowerCase().trim();
    if (SERVICE_DOMAINS[key]) return SERVICE_DOMAINS[key];
    // Partial match: check if any key is contained in the name
    for (const [k, domain] of Object.entries(SERVICE_DOMAINS)) {
      if (key.includes(k) || k.includes(key)) return domain;
    }
    // 3. Best-guess: treat name as domain (e.g. "GitHub" → "github.com")
    const guessed = key.replace(/\s+/g, '') + '.com';
    return guessed;
  }
  return null;
}

function getFallbackColor(name: string): string {
  const n = name.toLowerCase();
  if (['netflix', 'youtube', 'gmail', 'instagram'].some(s => n.includes(s))) return 'bg-red-500';
  if (['spotify', 'paypal', 'hdfc', 'sbi', 'icici'].some(s => n.includes(s))) return 'bg-green-500';
  if (['amazon', 'soundcloud'].some(s => n.includes(s))) return 'bg-orange-500';
  if (['microsoft', 'office', 'outlook', 'jira', 'notion'].some(s => n.includes(s))) return 'bg-blue-500';
  if (['apple', 'icloud', 'discord', 'slack'].some(s => n.includes(s))) return 'bg-gray-500';
  if (['google', 'linkedin'].some(s => n.includes(s))) return 'bg-sky-500';
  if (['facebook', 'twitter', 'x.com'].some(s => n.includes(s))) return 'bg-primary';
  if (['steam', 'epic', 'xbox', 'playstation'].some(s => n.includes(s))) return 'bg-indigo-500';
  return 'bg-primary/20';
}

export function getFaviconUrl(url?: string, name?: string): string | null {
  const domain = getDomain(url, name);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
}

interface FaviconProps {
  url?: string;
  name: string;
  className?: string;
}

export function Favicon({ url, name, className = 'w-10 h-10' }: FaviconProps) {
  const [failed, setFailed] = useState(false);

  const domain = getDomain(url, name);
  const src = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : null;

  if (!src || failed) {
    const color = getFallbackColor(name);
    const textColor = color === 'bg-primary/20' ? 'text-primary' : 'text-white';
    return (
      <div className={`${className} ${color} rounded-xl flex items-center justify-center font-semibold ${textColor} select-none`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      className={`${className} rounded-xl object-contain bg-white`}
      onError={() => setFailed(true)}
    />
  );
}
