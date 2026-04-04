import { Mail, Shield } from 'lucide-react';
import { Link } from 'wouter';

export function Footer() {
  const currentYear = new Date().getFullYear();

  // Compact footer links for mobile
  const quickLinks = [
    { name: 'Privacy', href: '/privacy' },
    { name: 'Terms', href: '/terms' },
    { name: 'Support', href: '/support' },
  ];

  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Compact single row for mobile */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
              <Shield className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-foreground">IronVault</span>
            <span className="text-xs text-muted-foreground">© {currentYear}</span>
          </div>

          {/* Quick Links */}
          <div className="flex items-center gap-4">
            {quickLinks.map((link) => (
              <Link key={link.name} href={link.href}>
                <a className="text-sm font-medium text-foreground hover:text-primary transition-colors underline underline-offset-2">
                  {link.name}
                </a>
              </Link>
            ))}
          </div>

          {/* Email */}
          <a 
            href="mailto:subsafeironvault@gmail.com" 
            className="text-sm text-foreground hover:text-primary flex items-center gap-1"
          >
            <Mail className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">subsafeironvault@gmail.com</span>
            <span className="sm:hidden">Contact</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

