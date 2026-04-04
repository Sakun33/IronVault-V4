/**
 * Google Analytics 4 Integration
 * 
 * Privacy-friendly analytics with event tracking for SEO KPIs.
 */

declare global {
  interface Window {
    gtag: any;
    dataLayer: any[];
  }
}

export const GA_TRACKING_ID = process.env.VITE_GA_TRACKING_ID || 'G-XXXXXXXXXX';

// Initialize GA4
export function initGA() {
  if (typeof window === 'undefined') return;
  if (GA_TRACKING_ID === 'G-XXXXXXXXXX') return; // Skip if not configured

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: any[]) {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_TRACKING_ID, {
    page_path: window.location.pathname,
    anonymize_ip: true, // Privacy-friendly
    cookie_flags: 'SameSite=None;Secure',
  });
}

// Track page views
export function trackPageView(url: string) {
  if (typeof window.gtag === 'undefined') return;

  window.gtag('config', GA_TRACKING_ID, {
    page_path: url,
  });
}

// Track events
export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number
) {
  if (typeof window.gtag === 'undefined') return;

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
}

// SEO-specific events
export const seoEvents = {
  // User creates vault (main conversion)
  vaultCreated: () => trackEvent('vault_created', 'Conversion', 'signup'),

  // User adds password
  passwordAdded: () => trackEvent('password_added', 'Engagement', 'password'),

  // User enables autofill
  autofillEnabled: () => trackEvent('autofill_enabled', 'Feature', 'autofill'),

  // User views pricing
  pricingViewed: (plan: string) => trackEvent('pricing_viewed', 'Interest', plan),

  // User exports vault
  vaultExported: () => trackEvent('vault_exported', 'Engagement', 'export'),

  // User imports vault
  vaultImported: () => trackEvent('vault_imported', 'Engagement', 'import'),

  // External link clicked
  externalLinkClicked: (url: string) => trackEvent('external_link', 'Navigation', url),

  // Download button clicked
  downloadClicked: (platform: string) => trackEvent('download_clicked', 'Conversion', platform),

  // Search performed
  searchPerformed: (query: string) => trackEvent('search', 'Engagement', query),

  // Feature used
  featureUsed: (feature: string) => trackEvent('feature_used', 'Feature', feature),

  // Page time spent (for engagement metrics)
  pageTimeSpent: (seconds: number, page: string) =>
    trackEvent('time_on_page', 'Engagement', page, seconds),

  // Scroll depth (for content engagement)
  scrollDepth: (percentage: number, page: string) =>
    trackEvent('scroll_depth', 'Engagement', page, percentage),

  // CTA clicked
  ctaClicked: (ctaText: string, location: string) =>
    trackEvent('cta_click', 'Conversion', `${location}: ${ctaText}`),

  // Form submission
  formSubmitted: (formName: string) => trackEvent('form_submit', 'Conversion', formName),

  // Error occurred
  errorOccurred: (errorType: string, errorMessage: string) =>
    trackEvent('error', 'Error', `${errorType}: ${errorMessage}`),
};

// Track scroll depth (for SEO engagement metrics)
export function initScrollTracking() {
  if (typeof window === 'undefined') return;

  let maxScroll = 0;
  const milestones = [25, 50, 75, 100];
  const tracked = new Set<number>();

  const handleScroll = () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = (window.scrollY / scrollHeight) * 100;

    if (scrolled > maxScroll) {
      maxScroll = scrolled;

      for (const milestone of milestones) {
        if (scrolled >= milestone && !tracked.has(milestone)) {
          tracked.add(milestone);
          seoEvents.scrollDepth(milestone, window.location.pathname);
        }
      }
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  return () => {
    window.removeEventListener('scroll', handleScroll);
  };
}

// Track time on page
export function initTimeTracking() {
  if (typeof window === 'undefined') return;

  const startTime = Date.now();

  const handleUnload = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    if (timeSpent > 0) {
      seoEvents.pageTimeSpent(timeSpent, window.location.pathname);
    }
  };

  window.addEventListener('beforeunload', handleUnload);

  return () => {
    window.removeEventListener('beforeunload', handleUnload);
  };
}
