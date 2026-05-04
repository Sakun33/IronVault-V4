import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'motion/react';
import { Search, Lock, FileText, CreditCard, Bell, DollarSign, ArrowRight, Plus, Cog, KeyRound } from 'lucide-react';
import { useVault } from '@/contexts/vault-context';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

type Result = {
  id: string;
  category: 'Passwords' | 'Notes' | 'Subscriptions' | 'Reminders' | 'Expenses' | 'Actions';
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  shortcut?: string;
  go: () => void;
};

// Cheap fuzzy match — returns true if every char of `q` appears in `text` in
// order (case-insensitive). Plenty for a palette over a few thousand items.
function fuzzy(text: string, q: string): boolean {
  if (!q) return true;
  const t = text.toLowerCase();
  const needle = q.toLowerCase();
  let i = 0;
  for (const ch of t) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, setLocation] = useLocation();
  const { passwords, notes, subscriptions, reminders, expenses } = useVault();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset query + focus when palette opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      // Defer focus until the modal is mounted
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const close = () => onOpenChange(false);
  const goto = (path: string) => { close(); setLocation(path); };

  const actions: Result[] = useMemo(() => ([
    { id: 'a-add-password',   category: 'Actions', title: 'Add password',     icon: Plus,     iconColor: 'text-emerald-300', iconBg: 'bg-emerald-500/15', shortcut: 'P', go: () => goto('/passwords?action=add') },
    { id: 'a-new-note',       category: 'Actions', title: 'New note',         icon: Plus,     iconColor: 'text-amber-300',   iconBg: 'bg-amber-500/15',   shortcut: 'N', go: () => goto('/notes?action=add') },
    { id: 'a-log-expense',    category: 'Actions', title: 'Log expense',      icon: DollarSign, iconColor: 'text-emerald-300', iconBg: 'bg-emerald-500/15', go: () => goto('/expenses?action=add') },
    { id: 'a-set-reminder',   category: 'Actions', title: 'Set reminder',     icon: Bell,     iconColor: 'text-orange-300',  iconBg: 'bg-orange-500/15',  go: () => goto('/reminders?action=add') },
    { id: 'a-generator',      category: 'Actions', title: 'Password generator', icon: KeyRound, iconColor: 'text-cyan-300',  iconBg: 'bg-cyan-500/15',    go: () => goto('/passwords?action=generate') },
    { id: 'a-settings',       category: 'Actions', title: 'Open settings',    icon: Cog,      iconColor: 'text-slate-300',   iconBg: 'bg-slate-500/15',   go: () => goto('/settings') },
  ]), []); // eslint-disable-line react-hooks/exhaustive-deps

  const results: Result[] = useMemo(() => {
    const q = query.trim();
    const out: Result[] = [];

    for (const p of passwords) {
      const hay = `${p.name} ${p.username || ''} ${p.url || ''}`;
      if (fuzzy(hay, q)) out.push({
        id: `pwd-${p.id}`,
        category: 'Passwords',
        title: p.name,
        subtitle: p.username || p.url,
        icon: Lock,
        iconColor: 'text-indigo-300',
        iconBg: 'bg-indigo-500/15',
        go: () => goto('/passwords'),
      });
    }
    for (const n of notes) {
      const hay = `${n.title || ''} ${n.notebook || ''}`;
      if (fuzzy(hay, q)) out.push({
        id: `note-${n.id}`,
        category: 'Notes',
        title: n.title || 'Untitled',
        subtitle: n.notebook || undefined,
        icon: FileText,
        iconColor: 'text-amber-300',
        iconBg: 'bg-amber-500/15',
        go: () => goto('/notes'),
      });
    }
    for (const s of subscriptions) {
      if (fuzzy(s.name || '', q)) out.push({
        id: `sub-${s.id}`,
        category: 'Subscriptions',
        title: s.name,
        subtitle: s.billingCycle,
        icon: CreditCard,
        iconColor: 'text-purple-300',
        iconBg: 'bg-purple-500/15',
        go: () => goto('/subscriptions'),
      });
    }
    for (const r of reminders.slice(0, 60)) {
      if (fuzzy(r.title || '', q)) out.push({
        id: `rem-${r.id}`,
        category: 'Reminders',
        title: r.title,
        icon: Bell,
        iconColor: 'text-orange-300',
        iconBg: 'bg-orange-500/15',
        go: () => goto('/reminders'),
      });
    }
    for (const e of expenses.slice(0, 60)) {
      const hay = `${e.description || ''} ${e.category || ''}`;
      if (fuzzy(hay, q)) out.push({
        id: `exp-${e.id}`,
        category: 'Expenses',
        title: e.description || e.category || 'Expense',
        subtitle: e.category,
        icon: DollarSign,
        iconColor: 'text-emerald-300',
        iconBg: 'bg-emerald-500/15',
        go: () => goto('/expenses'),
      });
    }

    const matchedActions = actions.filter(a => fuzzy(a.title, q));

    // Vault items first (most specific), actions at the end. Cap each
    // category so a huge vault doesn't overflow the modal.
    const cap = q ? 30 : 6;
    const grouped: Result[] = [];
    const order: Result['category'][] = ['Passwords', 'Notes', 'Subscriptions', 'Reminders', 'Expenses', 'Actions'];
    for (const cat of order) {
      const list = cat === 'Actions' ? matchedActions : out.filter(r => r.category === cat).slice(0, cap);
      grouped.push(...list);
    }
    return grouped;
  }, [query, passwords, notes, subscriptions, reminders, expenses, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group adjacent items by category for rendering — preserves the order
  // chosen above without forcing the keyboard nav to skip headers.
  const groups = useMemo(() => {
    const out: Array<{ category: Result['category']; items: Result[] }> = [];
    for (const r of results) {
      const last = out[out.length - 1];
      if (last && last.category === r.category) last.items.push(r);
      else out.push({ category: r.category, items: [r] });
    }
    return out;
  }, [results]);

  // Clamp the active index whenever the result list shrinks below it
  useEffect(() => {
    if (activeIdx >= results.length) setActiveIdx(Math.max(0, results.length - 1));
  }, [results.length, activeIdx]);

  // Scroll the active row into view as the user arrows through results
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Global Cmd/Ctrl+K is wired in App.tsx — local handler covers Esc, arrows
  // and Enter while the palette is mounted.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const r = results[activeIdx];
        if (r) r.go();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, activeIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  let runningIdx = 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cmdk-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4 bg-background/60 backdrop-blur-md"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            key="cmdk-panel"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl glass-card overflow-hidden shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)]"
          >
            {/* Search row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08]">
              <Search className="w-4 h-4 text-muted-foreground/70" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                placeholder="Search vault, notes, subscriptions, actions…"
                className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground/60"
                aria-label="Command palette search"
              />
              <kbd className="text-[10px] font-mono text-muted-foreground/70 px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04]">esc</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[55vh] overflow-y-auto smooth-scrollbar p-2">
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="w-8 h-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No matches for "{query}"</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try a shorter query or a different word</p>
                </div>
              ) : (
                <motion.div
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.015 } } }}
                  initial="hidden"
                  animate="show"
                >
                  {groups.map(group => (
                    <div key={group.category} className="mb-2 last:mb-0">
                      <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                        {group.category}
                      </div>
                      <div>
                        {group.items.map((r) => {
                          const idx = runningIdx++;
                          const isActive = idx === activeIdx;
                          const Icon = r.icon;
                          return (
                            <motion.button
                              key={r.id}
                              data-idx={idx}
                              variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                              type="button"
                              onMouseEnter={() => setActiveIdx(idx)}
                              onClick={() => r.go()}
                              className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors ${isActive ? 'bg-emerald-500/10 ring-1 ring-emerald-400/25' : 'hover:bg-white/[0.04]'}`}
                            >
                              <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${r.iconBg}`}>
                                <Icon className={`w-4 h-4 ${r.iconColor}`} />
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm text-foreground truncate">{r.title}</span>
                                {r.subtitle && (
                                  <span className="block text-[11px] text-muted-foreground truncate">{r.subtitle}</span>
                                )}
                              </span>
                              {r.shortcut && (
                                <kbd className="text-[10px] font-mono text-muted-foreground/70 px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04]">{r.shortcut}</kbd>
                              )}
                              <ArrowRight className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity ${isActive ? 'text-emerald-300 opacity-100' : 'text-muted-foreground/40 opacity-0'}`} />
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.08] text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><kbd className="font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04]">↑</kbd><kbd className="font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04]">↓</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04]">↵</kbd> open</span>
              </div>
              <span>{results.length} result{results.length === 1 ? '' : 's'}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
