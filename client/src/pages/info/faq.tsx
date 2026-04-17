import { InfoLayout } from '@/components/info-layout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    q: "Is IronVault really zero-knowledge?",
    a: "Yes. Your master password is used to derive an encryption key on your device using PBKDF2-SHA256 (600,000+ iterations). The raw password is never transmitted. All vault data is encrypted with AES-256-GCM before leaving your device — our servers only ever see ciphertext. We have no way to read your data, even with a court order.",
  },
  {
    q: "What happens if I forget my master password?",
    a: "Because IronVault is zero-knowledge, we cannot reset your password for you. If you set up a recovery backup code during vault creation, you can use that to regain access. Without a recovery code, a forgotten master password means the vault cannot be decrypted — this is an intentional security property, not a bug.",
  },
  {
    q: "How does the Family plan work?",
    a: "The Family plan (launching Q3 2026) allows up to 6 members under one subscription. Each member gets their own fully private vault that other family members cannot access. A shared family vault can be used for household passwords, subscription reminders, and joint expenses.",
  },
  {
    q: "Can I use IronVault completely offline?",
    a: "Yes. The core vault — passwords, notes, documents, reminders — works entirely offline. Cloud sync is optional and end-to-end encrypted. The free plan uses local storage only; Pro adds optional encrypted sync.",
  },
  {
    q: "Is my data stored in India?",
    a: "Cloud sync infrastructure is hosted on servers in India (Mumbai region). Encrypted data in transit uses TLS 1.3, and encrypted data at rest is stored with AES-256. All personal data is processed in compliance with India's DPDP Act 2023.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "You can cancel anytime from your account profile or by emailing support@ironvault.app. Cancellations take effect at the end of the billing period — we do not offer mid-cycle refunds unless required by applicable law. Your data remains accessible on the free plan after cancellation.",
  },
  {
    q: "Is IronVault open source?",
    a: "The cryptographic primitives (PBKDF2-SHA256 key derivation with 600,000+ iterations, AES-256-GCM authenticated encryption) are implemented using the Web Crypto API — an open, auditable browser standard. The app source code is proprietary but built on open-source libraries. We plan to open-source the client-side crypto module for independent audit.",
  },
  {
    q: "What about Apple iOS?",
    a: "An iOS native app is on the roadmap for late 2026. In the meantime, IronVault works as a full-featured Progressive Web App (PWA) on iPhone Safari — install it from the share sheet for an app-like experience including offline access and biometric unlock via Face ID.",
  },
  {
    q: "How do I import data from another password manager?",
    a: "Go to Profile → Import/Export. IronVault supports importing from CSV (compatible with 1Password, Bitwarden, LastPass, and Chrome exports) and IronVault's native JSON format. All imported data is encrypted locally before being stored.",
  },
  {
    q: "Can I use biometric unlock on Android?",
    a: "Yes. On supported Android devices, you can enable fingerprint or face unlock from Profile → Security. Biometric unlock stores a reference to your encrypted vault key in the device's hardware-backed keystore — your master password never leaves the device.",
  },
];

export default function FAQPage() {
  return (
    <InfoLayout title="Frequently Asked Questions">
      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-card border border-border/50 rounded-xl px-5 data-[state=open]:border-primary/30 transition-colors"
            >
              <AccordionTrigger className="text-left text-sm font-semibold text-foreground hover:no-underline py-4 gap-3">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </InfoLayout>
  );
}
