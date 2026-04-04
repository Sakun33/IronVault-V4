/**
 * SEO Head Component
 * 
 * Dynamically generates SEO-optimized meta tags for each page.
 * Includes Open Graph, Twitter Cards, and JSON-LD schema.
 */

import { useLocation } from 'wouter';

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    tags?: string[];
  };
  noindex?: boolean;
  canonicalUrl?: string;
}

export function SEOHead({
  title,
  description,
  keywords,
  ogImage = 'https://www.ironvault.app/og-image-default.jpg',
  ogType = 'website',
  article,
  noindex = false,
  canonicalUrl,
}: SEOHeadProps) {
  const [location] = useLocation();
  const canonical = canonicalUrl || `https://www.ironvault.app${location}`;
  const fullTitle = title.includes('IronVault')
    ? title
    : `${title} | IronVault`;

  // Update document head
  if (typeof document !== 'undefined') {
    // Title
    document.title = fullTitle;

    // Description
    updateMetaTag('name', 'description', description);

    // Keywords
    if (keywords) {
      updateMetaTag('name', 'keywords', keywords);
    }

    // Robots
    if (noindex) {
      updateMetaTag('name', 'robots', 'noindex, nofollow');
    } else {
      updateMetaTag('name', 'robots', 'index, follow');
    }

    // Canonical
    updateLinkTag('canonical', canonical);

    // Open Graph
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:image', ogImage);
    updateMetaTag('property', 'og:url', canonical);
    updateMetaTag('property', 'og:type', ogType);
    updateMetaTag('property', 'og:site_name', 'IronVault');

    // Article-specific OG tags
    if (article && ogType === 'article') {
      if (article.publishedTime) {
        updateMetaTag('property', 'article:published_time', article.publishedTime);
      }
      if (article.modifiedTime) {
        updateMetaTag('property', 'article:modified_time', article.modifiedTime);
      }
      if (article.author) {
        updateMetaTag('property', 'article:author', article.author);
      }
      // Note: Multiple article:tag tags would need special handling
    }

    // Twitter Card
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', description);
    updateMetaTag('name', 'twitter:image', ogImage);

    // Additional
    updateMetaTag('name', 'author', 'IronVault');
    updateMetaTag('name', 'copyright', 'IronVault');
  }

  return null;
}

function updateMetaTag(
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string
) {
  let element = document.querySelector(
    `meta[${attributeName}="${attributeValue}"]`
  ) as HTMLMetaElement;

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function updateLinkTag(rel: string, href: string) {
  let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
}
