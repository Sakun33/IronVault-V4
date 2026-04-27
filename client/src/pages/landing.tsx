import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Shield,
  Lock,
  Key,
  Bookmark,
  FileText,
  Bell,
  RefreshCw,
  Building2,
  Check,
  X,
  Menu,
  Github,
  Linkedin,
  Smartphone,
  Fingerprint,
  CloudOff,
  Zap,
  Star,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { SimpleThemeToggle } from "@/components/theme-toggle";

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ─── Nav ──────────────────────────────────────────────────────────────────────
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navLinks = [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Security", href: "/security" },
    { label: "FAQ", href: "/faq" },
    { label: "Download", href: "#download" },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/60 shadow-sm"
          : "bg-transparent"
      }`}
    >
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:outline-none"
      >
        Skip to content
      </a>

      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link href="/" aria-label="IronVault home">
          <span className="flex items-center gap-2.5 group">
            <AppLogo size={32} />
            <span className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              IronVault
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-7" role="list">
          {navLinks.map((link) => (
            <li key={link.href}>
              {link.href.startsWith('#') ? (
                <a
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  {link.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          <SimpleThemeToggle />
          <Link href="/auth/login">
            <Button variant="ghost" size="sm" className="font-medium">
              Log in
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button size="sm" className="font-medium">
              Get started free
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <div className="md:hidden flex items-center gap-2">
          <SimpleThemeToggle />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border/60 px-4 pb-5 pt-2">
          <ul className="space-y-1" role="list">
            {navLinks.map((link) => (
              <li key={link.href}>
                {link.href.startsWith('#') ? (
                  <a
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="w-full text-left px-3 min-h-[44px] flex items-center rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="w-full text-left px-3 min-h-[44px] flex items-center rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/auth/login">
              <Button variant="outline" className="w-full" onClick={() => setMobileOpen(false)}>
                Log in
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="w-full" onClick={() => setMobileOpen(false)}>
                Get started free
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section
      id="main-content"
      className="relative min-h-[100dvh] flex items-center pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden"
      aria-label="Hero"
    >
      {/* Gradient bg */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background dark:from-primary/15" />
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Copy */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            <motion.div variants={fadeUp}>
              <Badge variant="secondary" className="mb-4 text-xs font-semibold tracking-wide uppercase">
                Zero-knowledge · Open-source crypto
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                Your passwords,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-500">
                  finances, and secrets
                </span>{" "}
                — vaulted.
              </h1>
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl"
            >
              IronVault protects everything that matters — passwords, bank statements, subscriptions, secure notes, and investments — with zero-knowledge encryption, cross-device sync, and family sharing. Your master password never leaves your device.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
              <Link href="/auth/signup">
                <Button size="lg" className="w-full sm:w-auto text-base font-semibold px-6">
                  Get started free
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto text-base font-medium px-6"
                >
                  Log In
                </Button>
              </Link>
              <a
                href="https://play.google.com/store/apps/details?id=com.bytebookpro.ironvault"
                target="_blank"
                rel="noopener noreferrer"
                id="download"
              >
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full sm:w-auto text-base font-medium px-6"
                >
                  <Smartphone className="mr-2 w-4 h-4" />
                  Download for Android
                </Button>
              </a>
            </motion.div>

            <motion.p variants={fadeUp} className="text-sm text-muted-foreground">
              Free forever · No credit card required · Available on Android & Web
            </motion.p>
          </motion.div>

          {/* App mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="relative"
            aria-hidden="true"
          >
            <div className="relative mx-auto max-w-sm lg:max-w-none">
              {/* Glow */}
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-violet-500/20 rounded-3xl blur-2xl" />
              {/* Phone frame */}
              <div className="relative bg-card border border-border/60 rounded-[2rem] shadow-2xl overflow-hidden">
                {/* Status bar */}
                <div className="bg-muted/50 px-6 py-3 flex items-center justify-between border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <AppLogo size={20} />
                    <span className="text-sm font-bold text-foreground">IronVault</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-muted-foreground">Encrypted</span>
                  </div>
                </div>

                {/* Mock dashboard */}
                <div className="p-4 space-y-3 bg-background">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Passwords", value: "247", color: "text-primary" },
                      { label: "Subscriptions", value: "12", color: "text-purple-500" },
                      { label: "Notes", value: "38", color: "text-orange-500" },
                    ].map((s) => (
                      <div key={s.label} className="bg-muted/50 rounded-xl p-2.5 text-center">
                        <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-[10px] text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recent items */}
                  <div className="space-y-2">
                    {[
                      { icon: Key, label: "GitHub", sub: "github.com", color: "bg-primary/10 text-primary" },
                      { icon: Bookmark, label: "Spotify", sub: "₹119/mo · renews in 14d", color: "bg-purple-500/10 text-purple-500" },
                      { icon: FileText, label: "Server passwords", sub: "Secure note", color: "bg-orange-500/10 text-orange-500" },
                      { icon: Building2, label: "HDFC Statement", sub: "Feb 2026 · OCR done", color: "bg-indigo-500/10 text-indigo-500" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-3 bg-muted/30 rounded-xl px-3 py-2.5"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{item.label}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{item.sub}</div>
                        </div>
                        <Lock className="ml-auto w-3 h-3 text-muted-foreground/40 shrink-0" />
                      </div>
                    ))}
                  </div>

                  {/* Encryption badge */}
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      Vault sealed · Argon2id + AES-256-GCM
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Trust strip ──────────────────────────────────────────────────────────────
function TrustStrip() {
  const items = [
    { icon: CloudOff, text: "Zero-knowledge encryption" },
    { icon: Fingerprint, text: "Biometric unlock" },
    { icon: RefreshCw, text: "End-to-end encrypted cloud sync" },
    { icon: Shield, text: "2FA support" },
    { icon: Lock, text: "Open-source crypto primitives" },
  ];

  return (
    <section
      aria-label="Trust indicators"
      className="py-10 border-y border-border/40 bg-muted/30"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ul
          className="flex flex-wrap justify-center gap-x-8 gap-y-4"
          role="list"
        >
          {items.map((item) => (
            <li
              key={item.text}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <item.icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              {item.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
function FeaturesSection() {
  const features = [
    {
      icon: Key,
      title: "Password Manager",
      desc: "Store, generate, and auto-fill passwords with unlimited entries on Pro. Organised by category, searchable in milliseconds.",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Building2,
      title: "Bank Statement Analysis",
      desc: "Import PDF bank statements and let the OCR engine categorise your transactions automatically. Spot trends without sharing data with any server.",
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
    {
      icon: Bookmark,
      title: "Subscription Tracker",
      desc: "Never get surprised by a renewal again. Track every subscription with cost, billing cycle, and upcoming renewal reminders.",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      icon: FileText,
      title: "Secure Notes",
      desc: "Encrypted freeform notes for recovery codes, SSH keys, WiFi passwords, and anything else that belongs in a vault.",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      icon: Bell,
      title: "Reminders",
      desc: "Set deadline and recurring reminders tied to any vault item. Never miss a password rotation or subscription cancellation window.",
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
    {
      icon: RefreshCw,
      title: "Cross-device Sync",
      desc: "Encrypted vault sync across all your devices — Android, web, and iOS coming soon. Your data is end-to-end encrypted before it ever leaves your device.",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <section
      id="features"
      className="py-20 md:py-28"
      aria-labelledby="features-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
            Everything in one vault
          </motion.p>
          <motion.h2
            variants={fadeUp}
            id="features-heading"
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground"
          >
            One app. Every secret.
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            IronVault brings your passwords, finances, and sensitive data under one zero-knowledge roof — no silos, no third-party risks.
          </motion.p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          role="list"
        >
          {features.map((f) => (
            <motion.div key={f.title} variants={fadeUp} role="listitem">
              <Card className="h-full border-border/50 hover:border-primary/40 hover:shadow-md transition-all duration-300 group">
                <CardHeader className="pb-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center ${f.bg} mb-3 group-hover:scale-110 transition-transform duration-300`}
                    aria-hidden="true"
                  >
                    <f.icon className={`w-5 h-5 ${f.color}`} />
                  </div>
                  <CardTitle className="text-base font-semibold">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Security ─────────────────────────────────────────────────────────────────
function SecuritySection() {
  const pillars = [
    {
      icon: Lock,
      title: "Your master password never leaves your device",
      desc: "We derive an encryption key from your password using Argon2id (memory-hard, GPU-resistant). The raw password is immediately discarded. We have zero ability to recover it.",
    },
    {
      icon: Shield,
      title: "AES-256-GCM authenticated encryption",
      desc: "Every vault item is encrypted with AES-256-GCM before storage or sync. The authentication tag detects any tampering, even if someone gets hold of the encrypted blob.",
    },
    {
      icon: CloudOff,
      title: "We literally cannot read your vault",
      desc: "IronVault is zero-knowledge by design. Our servers store only encrypted ciphertext. We have no keys, no backdoors, and no ability to decrypt your data — even under legal compulsion.",
    },
    {
      icon: Fingerprint,
      title: "Biometric unlock — no password typing",
      desc: "On Android, biometric unlock uses the device keystore to release a locally-held session key. Your master password is never stored; biometrics are processed entirely on-device.",
    },
  ];

  return (
    <section
      id="security"
      className="py-20 md:py-28 bg-muted/20"
      aria-labelledby="security-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="space-y-6"
          >
            <motion.div variants={fadeUp}>
              <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
                Zero-knowledge security
              </p>
              <h2
                id="security-heading"
                className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground"
              >
                Your master password never leaves your device.{" "}
                <span className="text-muted-foreground font-medium">
                  We literally cannot read your vault — even if we wanted to.
                </span>
              </h2>
            </motion.div>
            <motion.p variants={fadeUp} className="text-muted-foreground leading-relaxed">
              Security isn't a feature checkbox — it's an architecture decision. IronVault's threat model assumes that our own servers can be compromised. That's why your data is encrypted on your device, with keys you control, before it ever touches our infrastructure.
            </motion.p>
            <motion.div variants={fadeUp} className="flex gap-3">
              <Link href="/security">
                <Button variant="outline" className="gap-2">
                  Read our security model
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Pillars */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="space-y-4"
          >
            {pillars.map((p) => (
              <motion.div
                key={p.title}
                variants={fadeUp}
                className="flex gap-4 bg-card border border-border/50 rounded-2xl p-5 hover:border-primary/30 transition-colors"
              >
                <div
                  className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  <p.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
interface PricingCardProps {
  name: string;
  price: string;
  priceNote: string;
  description: string;
  features: string[];
  notIncluded?: string[];
  cta: string;
  ctaHref: string;
  popular?: boolean;
  highlight?: boolean;
}

function PricingCard({
  name,
  price,
  priceNote,
  description,
  features,
  notIncluded,
  cta,
  ctaHref,
  popular,
  highlight,
}: PricingCardProps) {
  return (
    <Card
      className={`relative flex flex-col h-full transition-all duration-300 ${
        popular
          ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
          : "border-border/50 hover:border-primary/30 hover:shadow-md"
      }`}
    >
      {popular && (
        <div className="absolute -top-3.5 inset-x-0 flex justify-center">
          <Badge className="bg-primary text-primary-foreground px-3 py-0.5 text-xs font-bold shadow-sm">
            <Star className="w-3 h-3 mr-1 inline-block" aria-hidden="true" />
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="pb-4 pt-6">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">{name}</p>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="text-3xl font-extrabold text-foreground">{price}</span>
          {priceNote && <span className="text-sm text-muted-foreground">{priceNote}</span>}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 gap-6">
        <ul className="space-y-2.5" role="list" aria-label={`${name} plan features`}>
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-label="Included" />
              <span className="text-foreground">{f}</span>
            </li>
          ))}
          {notIncluded?.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <X className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" aria-label="Not included" />
              <span className="text-muted-foreground/60">{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto">
          <Link href={ctaHref}>
            <Button
              className="w-full"
              variant={popular ? "default" : "outline"}
              size="lg"
            >
              {cta}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function PricingSection() {
  const [yearly, setYearly] = useState(false);

  const plans: PricingCardProps[] = [
    {
      name: "Free",
      price: "₹0",
      priceNote: "forever",
      description: "All the essentials to get started.",
      features: [
        "50 passwords",
        "10 subscriptions",
        "10 secure notes",
        "10 reminders",
        "5 documents",
        "1 vault (mobile only)",
        "Local storage only",
        "Basic support",
      ],
      notIncluded: ["Cloud sync", "Bank statement import", "Expense tracking"],
      cta: "Get started free",
      ctaHref: "/auth/signup",
    },
    {
      name: "Pro Monthly",
      price: yearly ? "₹1,499" : "₹149",
      priceNote: yearly ? "/year" : "/month",
      description: yearly ? "Save ~17% vs. monthly. 14-day free trial." : "Full access. 14-day free trial.",
      features: [
        "14-day free trial",
        "Unlimited passwords",
        "Unlimited subscriptions",
        "Unlimited notes & reminders",
        "Unlimited documents",
        "Up to 5 vaults total (local + cloud)",
        "Bank statement import (OCR)",
        "Expense tracking & analytics",
        "Investment tracking",
        "Biometric authentication",
        "Cross-device cloud sync",
        "Priority support",
      ],
      cta: "Start free trial",
      ctaHref: "/auth/signup",
      popular: true,
    },
    {
      name: "Pro Family",
      price: yearly ? "₹2,999" : "₹299",
      priceNote: yearly ? "/year" : "/month",
      description: yearly ? "Save ~17% vs. monthly." : "Everything in Pro, shared.",
      features: [
        "Everything in Pro",
        "Up to 6 family members",
        "5 vaults total for the family head (local + cloud)",
        "2 vaults total for each invited member (local + cloud)",
        "Family spending dashboard",
        "Priority support",
      ],
      cta: "Coming soon",
      ctaHref: "#pricing",
    },
    {
      name: "Lifetime",
      price: "₹9,999",
      priceNote: "one-time",
      description: "Pay once, use forever. No recurring fees.",
      features: [
        "Everything in Pro",
        "Up to 5 vaults total (local + cloud)",
        "Lifetime access",
        "No recurring payments",
        "All future updates",
        "Early access to new features",
        "Premium support",
      ],
      cta: "Get lifetime access",
      ctaHref: "/auth/signup",
      highlight: true,
    },
  ];

  return (
    <section
      id="pricing"
      className="py-20 md:py-28"
      aria-labelledby="pricing-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center mb-12"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
            Transparent pricing
          </motion.p>
          <motion.h2
            variants={fadeUp}
            id="pricing-heading"
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground"
          >
            Start free. Upgrade when you're ready.
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
            No surprise charges. Cancel anytime.
          </motion.p>

          {/* Billing toggle */}
          <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-4">
            <span
              className={`text-sm font-medium transition-colors ${!yearly ? "text-foreground" : "text-muted-foreground"}`}
            >
              Monthly
            </span>
            <button
              role="switch"
              aria-checked={yearly}
              aria-label="Toggle yearly billing"
              onClick={() => setYearly((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                yearly ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  yearly ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium transition-colors ${yearly ? "text-foreground" : "text-muted-foreground"}`}
            >
              Yearly
              <Badge variant="secondary" className="ml-2 text-[10px] py-0">
                Save 17%
              </Badge>
            </span>
          </motion.div>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch"
        >
          {plans.map((plan) => (
            <motion.div key={plan.name} variants={fadeUp} className="flex">
              <PricingCard {...plan} />
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center text-xs text-muted-foreground mt-8"
        >
          All prices in Indian Rupees (INR). Pro Family launches Q3 2026. Questions?{" "}
          <a href="mailto:support@ironvault.app" className="text-primary hover:underline">
            support@ironvault.app
          </a>
        </motion.p>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
function FAQSection() {
  const faqs = [
    {
      q: "Is IronVault really zero-knowledge?",
      a: "Yes. Your master password is used to derive an encryption key on your device using Argon2id. The raw password is never transmitted. All vault data is encrypted with AES-256-GCM before leaving your device — our servers only ever see ciphertext. We have no way to read your data, even with a court order.",
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
      a: "The cryptographic primitives (Argon2id key derivation, AES-256-GCM encryption, PBKDF2 fallback) are implemented using the Web Crypto API — an open, auditable browser standard. The app source code is proprietary but built on open-source libraries. We plan to open-source the client-side crypto module for independent audit.",
    },
    {
      q: "What about Apple iOS?",
      a: "An iOS native app is on the roadmap for late 2026. In the meantime, IronVault works as a full-featured Progressive Web App (PWA) on iPhone Safari — install it from the share sheet for an app-like experience including offline access and biometric unlock via Face ID.",
    },
  ];

  return (
    <section
      id="faq"
      className="py-20 md:py-28 bg-muted/20"
      aria-labelledby="faq-heading"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center mb-12"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
            Common questions
          </motion.p>
          <motion.h2
            variants={fadeUp}
            id="faq-heading"
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground"
          >
            Frequently asked questions
          </motion.h2>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
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
        </motion.div>
      </div>
    </section>
  );
}

// ─── CTA Band ─────────────────────────────────────────────────────────────────
function CTABand() {
  return (
    <section
      className="py-20 md:py-28 relative overflow-hidden"
      aria-label="Call to action"
    >
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-background to-violet-500/10"
        aria-hidden="true"
      />
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6"
      >
        <motion.div variants={fadeUp}>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6" aria-hidden="true">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Ready to secure your digital life?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free, upgrade anytime. No credit card required.
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/auth/signup">
            <Button size="lg" className="w-full sm:w-auto text-base font-semibold px-8">
              Get started free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base font-medium px-8">
              See all plans
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function LandingFooter() {
  const cols = [
    {
      heading: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Blog", href: "/blog" },
        { label: "Careers", href: "/about" },
        { label: "Press", href: "/about" },
      ],
    },
    {
      heading: "Product",
      links: [
        { label: "Features", href: "/features" },
        { label: "Pricing", href: "/pricing" },
        { label: "Download", href: "/#download" },
        { label: "Changelog", href: "/changelog" },
      ],
    },
    {
      heading: "Resources",
      links: [
        { label: "Security", href: "/security" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Status", href: "/status" },
      ],
    },
    {
      heading: "Support",
      links: [
        { label: "Help & Docs", href: "/docs" },
        { label: "Contact support", href: "mailto:support@ironvault.app" },
        { label: "Report a bug", href: "mailto:support@ironvault.app?subject=Bug+Report" },
        { label: "Privacy", href: "/privacy" },
      ],
    },
  ];

  return (
    <footer
      className="border-t border-border/50 bg-muted/20 pt-16 pb-8"
      aria-label="Site footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top: logo + cols */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand col */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/">
              <span className="flex items-center gap-2.5 mb-4">
                <AppLogo size={28} />
                <span className="text-base font-bold tracking-tight text-foreground">IronVault</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
              Zero-knowledge vault for passwords, finances, and secrets.
            </p>
            {/* Social */}
            <div className="flex items-center gap-3 mt-5">
              <a
                href="https://x.com/ironvaultapp"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="IronVault on X (Twitter)"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://github.com/bytebookpro/ironvault"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="IronVault on GitHub"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Github className="w-4 h-4" aria-hidden="true" />
              </a>
              <a
                href="https://linkedin.com/company/bytebookpro"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="IronVault on LinkedIn"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Linkedin className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Link cols */}
          {cols.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-4">
                {col.heading}
              </h3>
              <ul className="space-y-3" role="list">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("mailto:") ? (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href}>
                        <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                          {link.label}
                        </span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © 2026 ByteBook Pro · Made in India 🇮🇳
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                Privacy
              </span>
            </Link>
            <Link href="/terms">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                Terms
              </span>
            </Link>
            <a
              href="mailto:support@ironvault.app"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              support@ironvault.app
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Quick category links ─────────────────────────────────────────────────────
function QuickLinksGrid() {
  const items = [
    { icon: Key, label: "Passwords", href: "/features", color: "text-primary", bg: "bg-primary/10" },
    { icon: Building2, label: "Bank Statements", href: "/features", color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { icon: Bookmark, label: "Subscriptions", href: "/features", color: "text-purple-500", bg: "bg-purple-500/10" },
    { icon: FileText, label: "Secure Notes", href: "/features", color: "text-orange-500", bg: "bg-orange-500/10" },
    { icon: Bell, label: "Reminders", href: "/features", color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { icon: RefreshCw, label: "Cloud Sync", href: "/security", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <section className="py-10 bg-background" aria-label="Feature overview">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {items.map((item) => (
            <Link key={item.label} href={item.href}>
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-accent transition-colors text-center cursor-pointer">
                <div className={`p-2.5 rounded-xl ${item.bg}`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} aria-hidden="true" />
                </div>
                <span className="text-xs font-medium text-muted-foreground leading-tight">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="text-center mt-4">
          <Link href="/features">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              See all features <ChevronRight className="ml-1 w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      <LandingNav />
      <main>
        <HeroSection />
        <TrustStrip />
        <QuickLinksGrid />
        <CTABand />
      </main>
      <LandingFooter />
    </div>
  );
}
