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
      className="landing-hero-bg relative min-h-[100dvh] flex items-center justify-center overflow-hidden"
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

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="max-w-3xl mx-auto px-4 sm:px-6 text-center"
      >
        {/* Animated logo */}
        <motion.div variants={fadeUp} className="mb-8 flex justify-center">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="absolute inset-0 -m-6 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-[0_20px_40px_-12px_rgba(16,185,129,0.7)]">
              <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-white" strokeWidth={2.4} />
            </div>
          </motion.div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={fadeUp}
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]"
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
          className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto"
        >
          Zero-knowledge encryption. AES-256-GCM. Your data, only yours.
        </motion.p>

        {/* CTAs — exactly two */}
        <motion.div
          variants={fadeUp}
          className="mt-10 flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link href="/auth/signup">
            <Button
              size="lg"
              className="w-full sm:w-auto text-base font-semibold px-8 h-12 bg-gradient-to-r from-emerald-500 to-teal-400 text-white hover:from-emerald-600 hover:to-teal-500 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.7)]"
              data-testid="hero-get-started"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
          <Link href="/auth/login">
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

        <motion.p
          variants={fadeUp}
          className="mt-6 text-sm text-muted-foreground"
        >
          Free forever · No credit card required
        </motion.p>
      </motion.div>

      {/* Scroll hint */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-xs text-muted-foreground/60"
        aria-hidden="true"
      >
        <span className="uppercase tracking-widest">Scroll</span>
        <span className="block w-px h-8 bg-gradient-to-b from-muted-foreground/60 to-transparent" />
      </div>
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
