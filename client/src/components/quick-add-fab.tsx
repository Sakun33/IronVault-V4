import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X, Key, StickyNote, DollarSign, Bell } from 'lucide-react';
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

type QuickMode = 'password' | 'note' | 'expense' | 'reminder' | null;

const FAB_KEY = 'iv_fab_pos';
const PILL_W = 132;  // approx collapsed pill width
const PILL_H = 40;   // approx pill height
const NAV_H = 88;    // bottom nav + safe area estimate
const MIN_DRAG = 6;  // px threshold to distinguish tap vs drag

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

  return (
    <>
      {open && (
        <div className="lg:hidden fixed inset-0 z-[48] bg-black/20" onClick={() => setOpen(false)} />
      )}

      {/* Draggable pill — collapses to "Quick Add", expands to action bar */}
      <div
        ref={fabRef}
        style={containerStyle}
        onTouchStart={handleTouchStart}
        onTouchEnd={onEnd}
        onTouchCancel={onEnd}
        onMouseDown={handleMouseDown}
        className="lg:hidden"
      >
        {/* Collapsed: pill with label */}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 dark:bg-white shadow-lg shadow-slate-900/25 dark:shadow-white/10 text-white dark:text-slate-900 active:scale-95 transition-transform whitespace-nowrap"
          >
            <Plus size={15} />
            <span className="text-sm font-medium">Quick Add</span>
          </button>
        )}

        {/* Expanded: horizontal action bar — shifts left when on right edge so it stays on-screen */}
        {open && (
          <div
            style={{ transform: isRight ? `translateX(calc(${PILL_W}px - 100%))` : undefined }}
            className="flex items-center gap-0.5 px-2 py-1.5 rounded-full bg-slate-900 dark:bg-white shadow-xl shadow-slate-900/30 dark:shadow-white/10 whitespace-nowrap"
          >
            <button
              onClick={() => openMode('password')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-white/10 dark:hover:bg-slate-100 transition-colors"
            >
              <Key size={13} className="text-blue-400 flex-shrink-0" />
              <span className="text-xs text-white dark:text-slate-900">Password</span>
            </button>
            <button
              onClick={() => openMode('note')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-white/10 dark:hover:bg-slate-100 transition-colors"
            >
              <StickyNote size={13} className="text-amber-400 flex-shrink-0" />
              <span className="text-xs text-white dark:text-slate-900">Note</span>
            </button>
            <button
              onClick={() => openMode('expense')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-white/10 dark:hover:bg-slate-100 transition-colors"
            >
              <DollarSign size={13} className="text-emerald-400 flex-shrink-0" />
              <span className="text-xs text-white dark:text-slate-900">Expense</span>
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/10 dark:hover:bg-slate-100 transition-colors flex-shrink-0 ml-0.5"
            >
              <X size={13} className="text-white/60 dark:text-slate-500" />
            </button>
          </div>
        )}
      </div>

      <QuickPasswordSheet open={mode === 'password'} onClose={closeMode} onSave={addPassword} toast={toast} />
      <QuickNoteSheet open={mode === 'note'} onClose={closeMode} onSave={addNote} toast={toast} />
      <QuickExpenseSheet open={mode === 'expense'} onClose={closeMode} onSave={addExpense} toast={toast} currency={currency} />
      <QuickReminderSheet open={mode === 'reminder'} onClose={closeMode} onSave={addReminder} toast={toast} />
    </>
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
