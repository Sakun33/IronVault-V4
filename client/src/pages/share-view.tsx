import { useState, useEffect } from 'react';
import { Copy, Eye, EyeOff, AlertTriangle, Lock, ExternalLink, Check } from 'lucide-react';
import { AppLogo } from '@/components/app-logo';

interface ShareData {
  name: string;
  username?: string;
  password?: string;
  url?: string;
  sharedBy?: string;
}

export default function ShareView() {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const token = window.location.pathname.split('/share/')[1];
    if (!token) { setError('Invalid link'); setLoading(false); return; }

    fetch(`/api/share/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d.data);
      })
      .catch(() => setError('Failed to load — check your connection'))
      .finally(() => setLoading(false));
  }, []);

  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3">
        <AppLogo size={36} variant="hero" />
        <span className="text-white font-bold text-xl tracking-tight">IronVault</span>
      </div>

      <div className="w-full max-w-sm">
        {loading && (
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Loading secure share...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-slate-400" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">
              {error.includes('expired') || error.includes('used') ? 'Link Expired' : 'Link Not Found'}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              {error.includes('used')
                ? 'This one-time link has already been viewed. For security, each link can only be opened once.'
                : error.includes('expired')
                ? 'This link has passed its 24-hour expiry window.'
                : 'This share link is invalid or has been removed.'}
            </p>
            <a
              href="https://www.ironvault.app"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              Get IronVault <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {!loading && data && (
          <>
            {/* One-time warning */}
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200 text-xs leading-relaxed">
                <strong>One-time link</strong> — Save these details now. This link has already been marked as viewed and will not open again.
              </p>
            </div>

            {/* Credential card */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-slate-700 px-5 py-4">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Shared credential</p>
                <h1 className="text-white font-bold text-xl">{data.name}</h1>
                {data.url && (
                  <a
                    href={data.url.startsWith('http') ? data.url : `https://${data.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-xs hover:text-blue-300 flex items-center gap-1 mt-1 transition-colors"
                  >
                    {data.url} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Fields */}
              <div className="p-5 space-y-4">
                {data.username && (
                  <div>
                    <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-2">
                      Username / Email
                    </label>
                    <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-4 py-3">
                      <span className="text-white text-sm flex-1 font-mono">{data.username}</span>
                      <button
                        onClick={() => copy(data.username!, 'username')}
                        className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
                      >
                        {copiedField === 'username'
                          ? <Check className="w-4 h-4 text-green-400" />
                          : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {data.password && (
                  <div>
                    <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-2">
                      Password
                    </label>
                    <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-4 py-3">
                      <span className="text-white text-sm flex-1 font-mono tracking-wider">
                        {showPassword ? data.password : '•'.repeat(Math.min(data.password.length, 16))}
                      </span>
                      <button
                        onClick={() => setShowPassword(v => !v)}
                        className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => copy(data.password!, 'password')}
                        className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
                      >
                        {copiedField === 'password'
                          ? <Check className="w-4 h-4 text-green-400" />
                          : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-slate-500 text-xs mt-6">
              Shared securely via{' '}
              <a href="https://www.ironvault.app" className="text-slate-400 hover:text-white transition-colors">
                IronVault
              </a>
              {' '}· Your passwords, your control
            </p>
          </>
        )}
      </div>
    </div>
  );
}
