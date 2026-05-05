import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Lock,
  Key,
  FileText,
  BarChart3,
  Cloud,
  Smartphone,
  Github,
  Linkedin,
  ArrowRight,
  Globe,
} from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { SimpleThemeToggle } from "@/components/theme-toggle";

// ─── Animation variants ─────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

// ─── Nav ─────────────────────────────────────────────────────────────────────
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50"
          : "bg-transparent"
      }`}
    >
      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Skip to content
      </a>

      <nav
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"
        aria-label="Main navigation"
      >
        <Link href="/" aria-label="IronVault home">
          <span className="flex items-center gap-2.5 group">
            <AppLogo size={32} />
            <span className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              IronVault
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <SimpleThemeToggle />
          <Link href="/auth/login">
            <Button variant="ghost" size="sm" className="font-medium" data-testid="nav-sign-in">
              Sign In
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button
              size="sm"
              className="font-semibold bg-gradient-to-r from-emerald-500 to-teal-400 text-white hover:from-emerald-600 hover:to-teal-500 shadow-[0_4px_14px_-4px_rgba(16,185,129,0.6)]"
              data-testid="nav-get-started"
            >
              Get Started
            </Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section
      id="hero"
      className="landing-hero-bg relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden px-6 pt-24 pb-12 sm:pt-28 sm:pb-16"
      aria-label="Hero"
    >
      {/* Floating particles — pure CSS, no JS */}
      <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden="true">
        <span className="landing-particle landing-particle-1" />
        <span className="landing-particle landing-particle-2" />
        <span className="landing-particle landing-particle-3" />
        <span className="landing-particle landing-particle-4" />
        <span className="landing-particle landing-particle-5" />
        <span className="landing-particle landing-particle-6" />
      </div>

      {/* Floating app-screen mockups behind the hero — pure CSS / Tailwind,
          no images. They suggest a vault/password-manager surface (chip
          rows, stat tiles, encrypted items) without us shipping any binary
          assets. Lower opacity so they don't fight the headline. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {/* Left mockup — tilted */}
        <div className="absolute -left-12 top-[18%] sm:top-1/4 w-44 sm:w-52 rounded-3xl border border-emerald-500/15 bg-gradient-to-b from-slate-800/90 to-slate-900/90 dark:from-slate-800/95 dark:to-slate-950/95 -rotate-12 opacity-25 sm:opacity-35 shadow-2xl">
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
              <div className="h-2 w-16 rounded bg-white/15" />
            </div>
            <div className="h-2 w-full rounded bg-white/10" />
            <div className="h-9 w-full rounded-lg bg-white/5 border border-white/10" />
            <div className="h-9 w-full rounded-lg bg-white/5 border border-white/10" />
            <div className="h-9 w-full rounded-lg bg-white/5 border border-white/10" />
            <div className="h-9 w-full rounded-lg bg-white/5 border border-white/10" />
            <div className="h-3 w-20 rounded bg-emerald-500/25 mt-2" />
          </div>
        </div>

        {/* Right mockup — tilted other way */}
        <div className="absolute -right-12 top-[28%] sm:top-1/3 w-44 sm:w-52 rounded-3xl border border-violet-500/15 bg-gradient-to-b from-slate-800/90 to-slate-900/90 dark:from-slate-800/95 dark:to-slate-950/95 rotate-12 opacity-25 sm:opacity-35 shadow-2xl">
          <div className="p-3 space-y-2.5">
            <div className="flex gap-2 mb-3">
              <div className="h-9 w-9 rounded-full bg-emerald-500/25" />
              <div className="flex-1 space-y-1.5 mt-1">
                <div className="h-2 w-20 rounded bg-white/20" />
                <div className="h-2 w-28 rounded bg-white/10" />
              </div>
            </div>
            <div className="h-16 w-full rounded-xl bg-white/5 border border-white/10 p-2 space-y-1">
              <div className="h-2 w-24 rounded bg-white/15" />
              <div className="h-2 w-full rounded bg-white/5" />
              <div className="h-2 w-3/4 rounded bg-white/5" />
            </div>
            <div className="h-16 w-full rounded-xl bg-white/5 border border-white/10 p-2 space-y-1">
              <div className="h-2 w-20 rounded bg-violet-500/25" />
              <div className="h-2 w-full rounded bg-white/5" />
            </div>
          </div>
        </div>

        {/* Center back mockup — desktop only, larger and barely-tilted */}
        <div className="hidden md:block absolute left-1/2 -translate-x-1/2 -bottom-24 w-72 rounded-3xl border border-emerald-500/15 bg-gradient-to-b from-slate-800/60 to-slate-900/60 dark:from-slate-800/70 dark:to-slate-950/70 opacity-15 shadow-2xl">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/30" />
              <div className="h-3 w-24 rounded bg-white/15" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-16 rounded-xl bg-emerald-500/15 border border-emerald-500/25" />
              <div className="h-16 rounded-xl bg-violet-500/15 border border-violet-500/25" />
              <div className="h-16 rounded-xl bg-amber-500/15 border border-amber-500/25" />
              <div className="h-16 rounded-xl bg-sky-500/15 border border-sky-500/25" />
            </div>
            <div className="h-20 rounded-xl bg-white/5 border border-white/10" />
          </div>
        </div>
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-3xl mx-auto text-center w-full"
      >
        {/* Animated logo — smaller on mobile so the headline + CTAs always
            fit above the fold without scroll, even on a 5" phone. Larger
            soft emerald glow behind it for depth. */}
        <motion.div variants={fadeUp} className="mb-5 sm:mb-8 flex justify-center">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="absolute inset-0 -m-10 bg-emerald-500/25 rounded-full blur-3xl animate-pulse" aria-hidden="true" />
            <div className="absolute inset-0 -m-4 bg-emerald-400/30 rounded-full blur-xl" aria-hidden="true" />
            <div className="relative w-16 h-16 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-[0_20px_40px_-12px_rgba(16,185,129,0.7)]">
              <Shield className="w-8 h-8 sm:w-12 sm:h-12 text-white" strokeWidth={2.4} />
            </div>
          </motion.div>
        </motion.div>

        {/* Headline — `text-3xl` on mobile keeps it on two lines instead of
            three, freeing room for the CTAs to stay above the fold. */}
        <motion.h1
          variants={fadeUp}
          className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]"
        >
          Your passwords, finances, and{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
            secrets
          </span>
          {" "}— vaulted.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={fadeUp}
          className="mt-4 sm:mt-6 text-base sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto"
        >
          Zero-knowledge encryption. AES-256-GCM. Your data, only yours.
        </motion.p>

        {/* CTAs — exactly two. Stacked vertically on mobile, side-by-side
            on desktop. Buttons are full-width on mobile so the tap target
            is unmistakable. */}
        <motion.div
          variants={fadeUp}
          className="mt-7 sm:mt-10 flex flex-col sm:flex-row gap-3 justify-center w-full max-w-md mx-auto sm:max-w-none"
        >
          <Link href="/auth/signup" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto text-base font-semibold px-8 h-12 bg-gradient-to-r from-emerald-500 to-teal-400 text-white hover:from-emerald-600 hover:to-teal-500 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.7)]"
              data-testid="hero-get-started"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
          <Link href="/auth/login" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto text-base font-medium px-8 h-12 border-border/60"
              data-testid="hero-sign-in"
            >
              Sign In
            </Button>
          </Link>
        </motion.div>

        {/* Trust badges — visible signal that we're a real security product
            without needing screenshots or third-party logos we don't have
            permission for. */}
        <motion.div
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-6 sm:mt-8 text-xs sm:text-sm text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500" /> 256-bit AES
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-500" /> Zero Knowledge
          </span>
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-500" /> Cross Platform
          </span>
        </motion.div>

        <motion.p
          variants={fadeUp}
          className="mt-4 sm:mt-5 text-xs sm:text-sm text-muted-foreground"
        >
          Free forever · No credit card required
        </motion.p>
      </motion.div>

      {/* Scroll hint — hidden on mobile to save vertical space */}
      <div
        className="hidden sm:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-1.5 text-xs text-muted-foreground/60"
        aria-hidden="true"
      >
        <span className="uppercase tracking-widest">Scroll</span>
        <span className="block w-px h-8 bg-gradient-to-b from-muted-foreground/60 to-transparent" />
      </div>

      {/* Thin gradient line separating hero from features section below */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"
        aria-hidden="true"
      />
    </section>
  );
}

// ─── Feature showcase ───────────────────────────────────────────────────────
function FeaturesSection() {
  const features = [
    {
      icon: Shield,
      title: "256-bit Encryption",
      desc: "AES-256-GCM with Argon2id key derivation. Industry-standard, audit-ready.",
      tint: "from-emerald-500/20 to-teal-500/10",
      iconColor: "text-emerald-400",
    },
    {
      icon: Key,
      title: "Password Manager",
      desc: "Generate, store, and autofill — across web, mobile, and desktop.",
      tint: "from-violet-500/20 to-purple-500/10",
      iconColor: "text-violet-400",
    },
    {
      icon: FileText,
      title: "Secure Notes",
      desc: "Rich-text notes with templates for meetings, journals, recipes, and more.",
      tint: "from-amber-500/20 to-orange-500/10",
      iconColor: "text-amber-400",
    },
    {
      icon: BarChart3,
      title: "Expense Tracker",
      desc: "Splitwise-style group expenses with auto-balanced settlements.",
      tint: "from-pink-500/20 to-rose-500/10",
      iconColor: "text-pink-400",
    },
    {
      icon: Cloud,
      title: "Cloud Sync",
      desc: "End-to-end encrypted sync across all your devices. Zero-knowledge.",
      tint: "from-sky-500/20 to-blue-500/10",
      iconColor: "text-sky-400",
    },
    {
      icon: Lock,
      title: "2FA Protection",
      desc: "Biometric unlock and 2FA support for an extra layer of security.",
      tint: "from-indigo-500/20 to-blue-500/10",
      iconColor: "text-indigo-400",
    },
  ];

  return (
    <section className="py-20 md:py-28" aria-labelledby="features-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center mb-12"
        >
          <motion.h2
            id="features-heading"
            variants={fadeUp}
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground"
          >
            Everything that matters,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
              one vault
            </span>
            .
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Six pillars of digital security, all encrypted on your device before they ever leave.
          </motion.p>
        </motion.div>
      </div>

      {/* Horizontal scroll-snap card row. Bleeds to the screen edge so cards
          can swipe naturally on mobile; centered with max-width on desktop. */}
      <div
        className="landing-feature-scroll px-4 sm:px-6 lg:px-8 pb-2"
        role="list"
        aria-label="IronVault features"
      >
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              role="listitem"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
              className="landing-feature-card"
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.tint} flex items-center justify-center mb-5`}>
                <Icon className={`w-6 h-6 ${f.iconColor}`} strokeWidth={2} />
              </div>
              <h3 className="text-lg font-bold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Pricing — single row, single CTA per card ──────────────────────────────
interface PlanCard {
  name: string;
  price: string;
  priceNote: string;
  description: string;
  features: string[];
  href: string;
  popular?: boolean;
}

function PricingSection() {
  const plans: PlanCard[] = [
    {
      name: "Free",
      price: "₹0",
      priceNote: "forever",
      description: "All the essentials to get started.",
      features: [
        "50 passwords",
        "10 secure notes",
        "1 vault (mobile only)",
        "Local storage",
      ],
      href: "/auth/signup",
    },
    {
      name: "Pro",
      price: "₹149",
      priceNote: "/month",
      description: "Full access. 14-day free trial.",
      features: [
        "Unlimited everything",
        "5 vaults · cloud sync",
        "Bank import (OCR)",
        "Expense tracking",
        "Priority support",
      ],
      href: "/auth/signup",
      popular: true,
    },
    {
      name: "Lifetime",
      price: "₹9,999",
      priceNote: "one-time",
      description: "Pay once, use forever.",
      features: [
        "Everything in Pro",
        "Lifetime access",
        "All future updates",
        "Premium support",
      ],
      href: "/auth/signup",
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-muted/20 border-y border-border/40" aria-labelledby="pricing-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center mb-12"
        >
          <motion.h2
            id="pricing-heading"
            variants={fadeUp}
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground"
          >
            Simple, honest pricing.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Free forever for the basics. Pro when you need more.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
              className={`relative flex flex-col rounded-3xl p-6 transition-all ${
                plan.popular
                  ? "border-2 border-emerald-500/60 bg-gradient-to-br from-emerald-500/[0.08] to-teal-400/[0.05] shadow-[0_20px_50px_-20px_rgba(16,185,129,0.45)] md:scale-[1.03]"
                  : "border border-border/50 bg-card hover:border-emerald-500/30 hover:shadow-[0_12px_32px_-12px_rgba(16,185,129,0.25)]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-white text-xs font-bold shadow-md">
                  MOST POPULAR
                </div>
              )}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {plan.name}
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.priceNote}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

              <ul className="mt-5 space-y-2.5 text-sm flex-1" role="list">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Link href={plan.href} className="mt-6">
                <Button
                  className={`w-full h-11 font-semibold ${
                    plan.popular
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-white hover:from-emerald-600 hover:to-teal-500"
                      : ""
                  }`}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.popular ? "Start Free Trial" : "Choose " + plan.name}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Plans billed in INR. Available on Web and{" "}
          <a
            href="https://play.google.com/store/apps/details?id=com.bytebookpro.ironvault"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Android
          </a>
          .
        </p>
      </div>
    </section>
  );
}

// ─── Footer (minimal) ────────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer
      className="border-t border-border/50 bg-background py-10"
      aria-label="Site footer"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" aria-label="IronVault home">
            <span className="flex items-center gap-2.5">
              <AppLogo size={28} />
              <span className="text-base font-bold tracking-tight text-foreground">
                IronVault
              </span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link href="/privacy">
              <span className="hover:text-foreground transition-colors cursor-pointer">Privacy</span>
            </Link>
            <Link href="/terms">
              <span className="hover:text-foreground transition-colors cursor-pointer">Terms</span>
            </Link>
            <a
              href="mailto:support@ironvault.app"
              className="hover:text-foreground transition-colors"
            >
              Support
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.bytebookpro.ironvault"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <Smartphone className="w-3.5 h-3.5" /> Android
            </a>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://github.com/bytebookpro/ironvault"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="IronVault on GitHub"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="https://linkedin.com/company/bytebookpro"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="IronVault on LinkedIn"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          © 2026 ByteBook Pro · Made in India 🇮🇳
        </p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      <LandingNav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
      </main>
      <LandingFooter />
    </div>
  );
}
