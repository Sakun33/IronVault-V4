/**
 * JSON-LD Schema Markup Component
 * 
 * Generates structured data for search engines.
 * Supports Organization, SoftwareApplication, Article, FAQPage, and BreadcrumbList schemas.
 */

import { useEffect } from 'react';

interface SchemaMarkupProps {
  type: 'Organization' | 'SoftwareApplication' | 'Article' | 'FAQPage' | 'BreadcrumbList';
  data?: any;
}

export function SchemaMarkup({ type, data = {} }: SchemaMarkupProps) {
  useEffect(() => {
    const schema = generateSchema(type, data);
    const scriptId = `schema-${type.toLowerCase()}`;

    // Remove existing script if present
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    // Create and append new script
    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [type, data]);

  return null;
}

function generateSchema(type: string, data: any) {
  const baseUrl = 'https://www.ironvault.app';

  switch (type) {
    case 'Organization':
      return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'IronVault',
        alternateName: 'IronVault',
        url: baseUrl,
        logo: `${baseUrl}/logo.png`,
        description:
          'Secure offline password manager with intelligent autofill and zero-knowledge encryption',
        email: 'subsafeironvault@gmail.com',
        foundingDate: '2024',
        sameAs: [],
      };

    case 'SoftwareApplication':
      return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'IronVault',
        applicationCategory: 'SecurityApplication',
        operatingSystem: 'Windows, macOS, Linux, iOS, Android',
        offers: {
          '@type': 'Offer',
          price: '149',
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
        },
        aggregateRating: data.rating
          ? {
              '@type': 'AggregateRating',
              ratingValue: data.rating.value || '4.8',
              ratingCount: data.rating.count || '1250',
            }
          : undefined,
        description:
          'Secure offline password manager with intelligent autofill, subscription tracking, and expense management. AES-256 encryption with zero-knowledge architecture.',
        featureList: [
          'Password Management',
          'Intelligent Autofill',
          'Subscription Tracking',
          'Expense Management',
          'Investment Tracking',
          'Dark Mode',
          'Multi-Currency Support',
          'Offline-First',
        ],
      };

    case 'Article':
      return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: data.title,
        description: data.description,
        image: data.image || `${baseUrl}/og-image-default.jpg`,
        datePublished: data.publishedDate,
        dateModified: data.modifiedDate || data.publishedDate,
        author: {
          '@type': 'Organization',
          name: 'IronVault',
        },
        publisher: {
          '@type': 'Organization',
          name: 'IronVault',
          logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/logo.png`,
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': data.url || baseUrl,
        },
      };

    case 'FAQPage':
      return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: (data.questions || []).map((q: any) => ({
          '@type': 'Question',
          name: q.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: q.answer,
          },
        })),
      };

    case 'BreadcrumbList':
      return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: (data.breadcrumbs || []).map((crumb: any, index: number) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          item: `${baseUrl}${crumb.url}`,
        })),
      };

    default:
      return {};
  }
}
