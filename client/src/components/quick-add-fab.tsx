import { useState, type ReactNode } from 'react';
import { Key, StickyNote, DollarSign, Bell, Shield, FileText, CreditCard, BarChart3, Files, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/currency-context';
import { PasswordGenerator } from '@/lib/password-generator';
import { EXPENSE_CATEGORIES } from '@shared/schema';
import { format, addDays, addWeeks } from 'date-fns';
import { useLocation } from 'wouter';

type QuickMode = 'password' | 'note' | 'expense' | 'reminder' | null;

function generatePassword() {
  return PasswordGenerator.generate({ length: 20, includeUppercase: true, includeLowercase: true, includeNumbers: true, includeSymbols: true, excludeSimilar: false });
}

interface QuickAddMenuProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAddMenu({ open, onClose }: QuickAddMenuProps) {
  const [mode, setMode] = useState<QuickMode>(null);
  const { addPassword, addNote, addExpense, addReminder } = useVault();
  const { toast } = useToast();
  const { currency } = useCurrency();
  const [, setLocation] = useLocation();

  const openMode = (m: QuickMode) => { onClose(); setMode(m); };
  const closeMode = () => setMode(null);
  const navigate = (href: string) => { onClose(); setLocation(href); };

  return (
    <>
      {/* Tray bottom sheet */}
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader>
            <SheetTitle className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Quick Add</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Vault Items</p>
              <div className="grid grid-cols-3 gap-2">
                <TrayButton icon={<Shield size={20} className="text-blue-500" />} label="Password" onClick={() => openMode('password')} />
                <TrayButton icon={<FileText size={20} className="text-amber-500" />} label="Note" onClick={() => openMode('note')} />
                <TrayButton icon={<CreditCard size={20} className="text-purple-500" />} label="Subscription" onClick={() => navigate('/subscriptions?action=add')} />
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Finance</p>
              <div className="grid grid-cols-3 gap-2">
                <TrayButton icon={<DollarSign size={20} className="text-emerald-500" />} label="Expense" onClick={() => openMode('expense')} />
                <TrayButton icon={<Bell size={20} className="text-orange-500" />} label="Reminder" onClick={() => openMode('reminder')} />
                <TrayButton icon={<BarChart3 size={20} className="text-sky-500" />} label="Investment" onClick={() => navigate('/investments?action=add')} />
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2 px-1">More</p>
              <div className="grid grid-cols-3 gap-2">
                <TrayButton icon={<Files size={20} className="text-rose-500" />} label="Document" onClick={() => navigate('/documents?action=add')} />
                <TrayButton icon={<Key size={20} className="text-teal-500" />} label="API Key" onClick={() => navigate('/api-keys?action=add')} />
                <TrayButton icon={<Target size={20} className="text-violet-500" />} label="Goal" onClick={() => navigate('/investments?action=goal')} />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
      className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-muted/60 hover:bg-muted active:scale-95 transition-all border border-border/40"
    >
      {icon}
      <span className="text-[11px] text-foreground leading-none">{label}</span>
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
