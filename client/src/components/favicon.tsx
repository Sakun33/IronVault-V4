import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface FaviconProps {
  url?: string;
  name: string;
  className?: string;
}

export function Favicon({ url, name, className = "w-10 h-10" }: FaviconProps) {
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setError(true);
      return;
    }

    // Extract domain from URL
    let domain: string;
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      domain = urlObj.hostname;
    } catch {
      setError(true);
      return;
    }

    // Try multiple favicon sources
    const faviconSources = [
      `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      `https://favicons.githubusercontent.com/${domain}`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://${domain}/favicon.ico`
    ];

    const tryFavicon = async (sources: string[], index = 0) => {
      if (index >= sources.length) {
        setError(true);
        return;
      }

      try {
        const response = await fetch(sources[index], { method: 'HEAD' });
        if (response.ok) {
          setFaviconUrl(sources[index]);
        } else {
          tryFavicon(sources, index + 1);
        }
      } catch {
        tryFavicon(sources, index + 1);
      }
    };

    tryFavicon(faviconSources);
  }, [url]);

  if (error || !faviconUrl) {
    // Fallback to initials with category-based colors
    const getCategoryColor = (name: string) => {
      const category = name.toLowerCase();
      if (category.includes('social') || category.includes('facebook') || category.includes('twitter') || category.includes('instagram')) {
        return 'bg-primary';
      } else if (category.includes('email') || category.includes('mail') || category.includes('gmail')) {
        return 'bg-red-500';
      } else if (category.includes('bank') || category.includes('finance') || category.includes('paypal')) {
        return 'bg-green-500';
      } else if (category.includes('shopping') || category.includes('amazon') || category.includes('store')) {
        return 'bg-orange-500';
      } else if (category.includes('work') || category.includes('office') || category.includes('business')) {
        return 'bg-purple-500';
      } else if (category.includes('game') || category.includes('gaming') || category.includes('steam')) {
        return 'bg-indigo-500';
      } else if (category.includes('music') || category.includes('spotify') || category.includes('apple')) {
        return 'bg-pink-500';
      } else if (category.includes('video') || category.includes('youtube') || category.includes('netflix')) {
        return 'bg-red-600';
      } else {
        return 'bg-primary/10';
      }
    };

    return (
      <div className={`${className} ${getCategoryColor(name)} rounded-lg flex items-center justify-center text-white font-semibold`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={faviconUrl}
      alt={`${name} favicon`}
      className={`${className} rounded-lg object-cover`}
      onError={() => setError(true)}
    />
  );
}
