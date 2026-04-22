import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { Plus, X, Key, StickyNote, DollarSign, Bell, Shield, FileText, CreditCard, BarChart3, Files, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/currency-context';
import { PasswordGenerator } from '@/lib/password-generator';
import { EXPENSE_CATEGORIES, PASSWORD_CATEGORIES } from '@shared/schema';
import { format, addDays, addWeeks } from 'date-fns';
import { useLocation } from 'wouter';

type QuickMode = 'password' | 'note' | 'expense' | 'reminder' | null;

const FAB_KEY = 'iv_fab_pos';
const PILL_W = 132;  // approx collapsed pill width
const PILL_H = 40;   // approx pill height
const NAV_H = 88;    // bottom nav + safe area estimate
const MIN_DRAG = 6;  // px threshold to distinguish tap vs drag
const TRAY_W = 256;  // expanded tray width
const TRAY_H = 340;  // estimated tray height for positioning

interface FabPos { x: number; y: number }

function defaultPos(): FabPos {
  return {
    x: window.innerWidth - PILL_W - 16,
    y: window.innerHeight - NAV_H - PILL_H - 16,
  };
}

function generatePassword() {
  return PasswordGenerator.generate({ length: 20, includeUppercase: true, includeLowercase: true, includeNumbers: true, includeSymbols: true, excludeSimilar: false });
}

export function QuickAddFab() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<QuickMode>(null);
  const { addPassword, addNote, addExpense, addReminder } = useVault();
  const { toast } = useToast();
  const { currency } = useCurrency();
  const [, setLocation] = useLocation();

  const [pos, setPos] = useState<FabPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startClientX: number; startClientY: number;
    startFabX: number; startFabY: number;
    moved: boolean;
  } | null>(null);

  // Load persisted position on mount; re-default on resize
  useEffect(() => {
    const init = () => {
      try {
        const s = localStorage.getItem(FAB_KEY);
        if (s) { setPos(JSON.parse(s)); return; }
      } catch {}
      setPos(defaultPos());
    };
    init();
    window.addEventListener('resize', init);
    return () => window.removeEventListener('resize', init);
  }, []);

  const onMoveRaw = useCallback((clientX: number, clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = clientX - d.startClientX;
    const dy = clientY - d.startClientY;
    if (!d.moved && (Math.abs(dx) > MIN_DRAG || Math.abs(dy) > MIN_DRAG)) {
      d.moved = true;
    }
    if (!d.moved) return;
    const newX = Math.max(8, Math.min(window.innerWidth - PILL_W - 8, d.startFabX + dx));
    const newY = Math.max(80, Math.min(window.innerHeight - NAV_H - PILL_H - 8, d.startFabY + dy));
    setPos({ x: newX, y: newY });
  }, []);

  const onEnd = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d) return;
    if (!d.moved) {
      setOpen(v => !v); // tap = toggle
      return;
    }
    // Snap pill to nearest left/right edge
    setPos(prev => {
      if (!prev) return prev;
      const snappedX = (prev.x + PILL_W / 2) > window.innerWidth / 2
        ? window.innerWidth - PILL_W - 16
        : 16;
      const clampedY = Math.max(80, Math.min(window.innerHeight - NAV_H - PILL_H - 8, prev.y));
      const np = { x: snappedX, y: clampedY };
      localStorage.setItem(FAB_KEY, JSON.stringify(np));
      return np;
    });
  }, []);

  // Register non-passive touchmove so e.preventDefault() blocks scroll during drag
  useEffect(() => {
    const el = fabRef.current;
    if (!el) return;
    const tm = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
      onMoveRaw(e.touches[0].clientX, e.touches[0].clientY);
    };
    el.addEventListener('touchmove', tm, { passive: false });
    return () => el.removeEventListener('touchmove', tm);
  }, [onMoveRaw]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (open || !pos) return; // don't drag when expanded
    dragRef.current = {
      startClientX: e.touches[0].clientX, startClientY: e.touches[0].clientY,
      startFabX: pos.x, startFabY: pos.y, moved: false,
    };
    setDragging(true);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (open || !pos) return; // don't drag when expanded
    dragRef.current = {
      startClientX: e.clientX, startClientY: e.clientY,
      startFabX: pos.x, startFabY: pos.y, moved: false,
    };
    setDragging(true);
    const move = (ev: MouseEvent) => onMoveRaw(ev.clientX, ev.clientY);
    const up = () => {
      onEnd();
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [open, pos, onMoveRaw, onEnd]);

  const openMode = (m: QuickMode) => { setOpen(false); setMode(m); };
  const closeMode = () => setMode(null);

  // True when pill is snapped to (or near) the right edge
  const isRight = !pos || (pos.x + PILL_W / 2) >= window.innerWidth / 2;

  const containerStyle: React.CSSProperties = pos ? {
    position: 'fixed',
    left: pos.x,
    top: pos.y,
    zIndex: 50,
    opacity: dragging ? 0.6 : 1,
    transition: dragging ? 'none' : 'opacity 0.15s ease, left 0.18s ease, top 0.18s ease',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  } : { display: 'none' };

  const navigate = (href: string) => { setOpen(false); setLocation(href); };

  return (
    <>
      {open && (
        <div className="lg:hidden fixed inset-0 z-[48] bg-black/30" onClick={() => setOpen(false)} />
      )}

      {/* Apple-style floating tray — appears above the pill when open */}
      {pos && open && (
        <div
          className="lg:hidden fixed z-[49]"
          style={{
            top: Math.max(80, pos.y - TRAY_H - 12),
            left: Math.max(8, Math.min(window.innerWidth - TRAY_W - 8, pos.x - (TRAY_W - PILL_W) / 2)),
            width: TRAY_W,
          }}
        >
          <div className="backdrop-blur-xl bg-slate-900/85 dark:bg-slate-800/95 rounded-3xl p-4 shadow-2xl">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 px-1">Vault Items</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <TrayButton icon={<Shield size={20} className="text-blue-400" />} label="Password" onClick={() => openMode('password')} />
              <TrayButton icon={<FileText size={20} className="text-amber-400" />} label="Note" onClick={() => openMode('note')} />
              <TrayButton icon={<CreditCard size={20} className="text-purple-400" />} label="Subscription" onClick={() => navigate('/subscriptions?action=add')} />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 px-1">Finance</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <TrayButton icon={<DollarSign size={20} className="text-emerald-400" />} label="Expense" onClick={() => openMode('expense')} />
              <TrayButton icon={<Bell size={20} className="text-orange-400" />} label="Reminder" onClick={() => openMode('reminder')} />
              <TrayButton icon={<BarChart3 size={20} className="text-sky-400" />} label="Investment" onClick={() => navigate('/investments?action=add')} />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 px-1">More</div>
            <div className="grid grid-cols-3 gap-2">
              <TrayButton icon={<Files size={20} className="text-rose-400" />} label="Document" onClick={() => navigate('/documents?action=add')} />
              <TrayButton icon={<Key size={20} className="text-teal-400" />} label="API Key" onClick={() => navigate('/api-keys?action=add')} />
              <TrayButton icon={<Target size={20} className="text-violet-400" />} label="Goal" onClick={() => navigate('/investments?action=goal')} />
            </div>
          </div>
        </div>
      )}

      {/* Draggable pill */}
      <div
        ref={fabRef}
        style={containerStyle}
        onTouchStart={handleTouchStart}
        onTouchEnd={onEnd}
        onTouchCancel={onEnd}
        onMouseDown={handleMouseDown}
        className="lg:hidden"
      >
        {open ? (
          <button
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-xl bg-slate-900/70 dark:bg-white/20 shadow-lg text-white dark:text-slate-100 active:scale-95 transition-transform whitespace-nowrap"
          >
            <X size={15} />
            <span className="text-sm font-medium">Close</span>
          </button>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-xl bg-slate-900/70 dark:bg-white/20 shadow-lg text-white dark:text-slate-100 active:scale-95 transition-transform whitespace-nowrap"
          >
            <Plus size={15} />
            <span className="text-sm font-medium">Quick Add</span>
          </button>
        )}
      </div>

      <QuickPasswordSheet open={mode === 'password'} onClose={closeMode} onSave={addPassword} toast={toast} />
      <QuickNoteSheet open={mode === 'note'} onClose={closeMode} onSave={addNote} toast={toast} />
      <QuickExpenseSheet open={mode === 'expense'} onClose={closeMode} onSave={addExpense} toast={toast} currency={currency} />
      <QuickReminderSheet open={mode === 'reminder'} onClose={closeMode} onSave={addReminder} toast={toast} />
    </>
  );
}

function TrayButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
    >
      {icon}
      <span className="text-[11px] text-white leading-none">{label}</span>
    </button>
  );
}

function QuickPasswordSheet({ open, onClose, onSave, toast }: any) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password] = useState(generatePassword);
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(''); setUsername(''); };

  const handleSave = async () => {
    if (!name || !username) return toast({ title: "Required", description: "Name and username are required", variant: "destructive" });
    setSaving(true);
    try {
      await onSave({ name, username, password, url: '', category: '', notes: '' });
      toast({ title: "Saved", description: `Password for ${name} saved` });
      reset(); onClose();
    } catch { toast({ title: "Error", description: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><Key className="w-4 h-4" /> Quick Add Password</SheetTitle></SheetHeader>
        <div className="space-y-3 mt-4">
          <div><Label>Service name *</Label><Input placeholder="Google, GitHub…" value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Username / Email *</Label><Input placeholder="you@example.com" value={username} onChange={e => setUsername(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Strong password auto-generated ✓</p>
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Password'}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QuickNoteSheet({ open, onClose, onSave, toast }: any) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setContent(''); };

  const handleSave = async () => {
    if (!title) return toast({ title: "Required", description: "Title is required", variant: "destructive" });
    setSaving(true);
    try {
      await onSave({ title, content, notebook: 'Default', tags: [], isPinned: false });
      toast({ title: "Saved", description: `"${title}" note saved` });
      reset(); onClose();
    } catch { toast({ title: "Error", description: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><StickyNote className="w-4 h-4" /> Quick Add Note</SheetTitle></SheetHeader>
        <div className="space-y-3 mt-4">
          <div><Label>Title *</Label><Input placeholder="Note title…" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><Label>Content</Label><textarea className="w-full border border-border rounded-md p-2 text-sm bg-background resize-none min-h-20" placeholder="Type your note…" value={content} onChange={e => setContent(e.target.value)} /></div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Note'}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QuickExpenseSheet({ open, onClose, onSave, toast, currency }: any) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setAmount(''); setCategory(''); };

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!title || !amt || !category) return toast({ title: "Required", description: "All fields required", variant: "destructive" });
    setSaving(true);
    try {
      await onSave({ title, amount: amt, currency, category, date: new Date(), notes: '', isRecurring: false, tags: [] });
      toast({ title: "Saved", description: `${title} expense saved` });
      reset(); onClose();
    } catch { toast({ title: "Error", description: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> Quick Add Expense</SheetTitle></SheetHeader>
        <div className="space-y-3 mt-4">
          <div>
            <Label>Amount *</Label>
            <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            <div className="flex gap-1.5 mt-1.5">
              {[10, 50, 100, 500, 1000].map(a => (
                <button key={a} type="button" onClick={() => setAmount(a.toString())}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${amount === a.toString() ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 bg-muted/40 hover:bg-muted'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div><Label>Title *</Label><Input placeholder="Coffee, Groceries…" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div>
            <Label>Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Expense'}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QuickReminderSheet({ open, onClose, onSave, toast }: any) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setDueDate(format(new Date(), 'yyyy-MM-dd')); };

  const handleSave = async () => {
    if (!title) return toast({ title: "Required", description: "Title is required", variant: "destructive" });
    setSaving(true);
    try {
      await onSave({ title, dueDate: new Date(dueDate + 'T09:00'), priority: 'medium', category: 'Personal', isCompleted: false, isRecurring: false, tags: [], color: '#6366f1', notificationEnabled: true, alarmEnabled: false, alertMinutesBefore: 15, preAlertEnabled: false });
      toast({ title: "Saved", description: `Reminder "${title}" created` });
      reset(); onClose();
    } catch { toast({ title: "Error", description: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><Bell className="w-4 h-4" /> Quick Add Reminder</SheetTitle></SheetHeader>
        <div className="space-y-3 mt-4">
          <div><Label>Title *</Label><Input placeholder="Remind me to…" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            <div className="flex gap-1.5 mt-1.5">
              {[
                { label: 'Today', date: new Date() },
                { label: 'Tomorrow', date: addDays(new Date(), 1) },
                { label: 'Next Week', date: addWeeks(new Date(), 1) },
              ].map(({ label, date }) => {
                const val = format(date, 'yyyy-MM-dd');
                return (
                  <button key={label} type="button" onClick={() => setDueDate(val)}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${dueDate === val ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 bg-muted/40 hover:bg-muted'}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Reminder'}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
