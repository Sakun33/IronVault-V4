import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export interface SubscriptionTermsAccordionProps {
  platform: 'ios' | 'android' | 'web';
  termsUrl?: string;
  privacyUrl?: string;
}

export function SubscriptionTermsAccordion({ platform, termsUrl, privacyUrl }: SubscriptionTermsAccordionProps) {
  if (platform !== 'ios') return null;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="terms">
        <AccordionTrigger className="text-sm">Subscription Terms</AccordionTrigger>
        <AccordionContent className="text-xs text-muted-foreground space-y-2">
          <p>
            Payment will be charged to your Apple ID account at confirmation of purchase.
            Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
          </p>
          <p>
            Account will be charged for renewal within 24 hours prior to the end of the current period.
            Manage or cancel in App Store account settings.
          </p>
          {(termsUrl || privacyUrl) && (
            <div className="flex gap-3 pt-2">
              {termsUrl && (
                <a 
                  href={termsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Terms of Service
                </a>
              )}
              {privacyUrl && (
                <a 
                  href={privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer" 
                  className="text-primary hover:underline"
                >
                  Privacy Policy
                </a>
              )}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
