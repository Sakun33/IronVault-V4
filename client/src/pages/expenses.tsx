import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeGate } from '@/components/upgrade-gate';
import { useCurrency } from '@/contexts/currency-context';
import { useSharedExpenses } from '@/hooks/use-shared-expenses';
import {
  SharedExpense, ExpenseGroup, ExpenseContact, Settlement,
  SharedExpenseSplit, SPLITWISE_CATEGORIES, SETTLEMENT_METHODS,
} from '@shared/schema';
import {
  calculateBalances, calculateGroupBalances, simplifyDebts,
  calculateCategoryTotals, calculateMonthlyTotals,
  contactName as contactNameOf, initials, avatarColor,
  buildActivityFeed, formatAmount, summarizeBalances, evenShares,
} from '@/lib/expense-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Users, User, Activity, BarChart3, ArrowLeft, ChevronRight,
  Trash2, Edit, Receipt, Wallet, TrendingUp, Calendar, Camera,
  Banknote, X, Check,
} from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek, startOfDay } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#0ea5e9', '#14b8a6', '#22c55e', '#a855f7', '#06b6d4'];
const TabKeys = ['all', 'groups', 'people', 'activity', 'reports'] as const;
type TabKey = typeof TabKeys[number];

export default function ExpensesPage() {
  const { isFeatureAvailable, isLoading: licenseLoading } = useSubscription();
  const { currency } = useCurrency();
  const { toast } = useToast();
  const sx = useSharedExpenses();

  const [tab, setTab] = useState<TabKey>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<SharedExpense | null>(null);
  const [showSettle, setShowSettle] = useState(false);
  const [settlePrefill, setSettlePrefill] = useState<{ from?: string; to?: string; amount?: number; groupId?: string } | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [showGroupsMgr, setShowGroupsMgr] = useState(false);
  const [showContactsMgr, setShowContactsMgr] = useState(false);
  const [deleteExpense, setDeleteExpense] = useState<SharedExpense | null>(null);

  const balances = useMemo(
    () => calculateBalances(sx.expenses, sx.settlements),
    [sx.expenses, sx.settlements],
  );
  const summary = useMemo(() => summarizeBalances(balances), [balances]);

  // Allow listings to be auto-scoped to a group via the openGroupId state.
  const visibleExpenses = sx.expenses;

  // Currency for the headline (use the currency the user has on most expenses,
  // falling back to the global preference).
  const displayCurrency = useMemo(() => {
    const counts = new Map<string, number>();
    sx.expenses.forEach(e => counts.set(e.currency, (counts.get(e.currency) || 0) + 1));
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return top?.[0] || currency || 'USD';
  }, [sx.expenses, currency]);

  const openGroup = useMemo(
    () => openGroupId ? sx.groups.find(g => g.id === openGroupId) || null : null,
    [openGroupId, sx.groups],
  );

  if (!licenseLoading && !isFeatureAvailable('expenses')) {
    return <UpgradeGate feature="Expense Tracking" />;
  }

  // ── Group detail screen ──────────────────────────────────────────────────
  if (openGroup) {
    return (
      <GroupDetailScreen
        group={openGroup}
        sx={sx}
        displayCurrency={displayCurrency}
        onBack={() => setOpenGroupId(null)}
        onAddExpense={() => setShowAdd(true)}
        onSettle={(prefill) => { setSettlePrefill(prefill); setShowSettle(true); }}
        onEditExpense={(e) => setEditing(e)}
        onDeleteExpense={(e) => setDeleteExpense(e)}
      />
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Split, track, and settle.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettle(true)}
            data-testid="button-settle-up"
            className="rounded-xl"
          >
            <Banknote className="w-4 h-4 mr-1" />
            Settle
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryCard
          label="You owe"
          amount={summary.youOwe}
          tone="negative"
          currency={displayCurrency}
        />
        <SummaryCard
          label="You're owed"
          amount={summary.youAreOwed}
          tone="positive"
          currency={displayCurrency}
        />
        <SummaryCard
          label="Net"
          amount={summary.net}
          tone={summary.net >= 0 ? 'positive' : 'negative'}
          currency={displayCurrency}
          showSign
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/40 border border-border/50 overflow-x-auto">
        {TabKeys.map(k => (
          <TabButton key={k} active={tab === k} onClick={() => setTab(k)} value={k}>
            {tabLabel(k)}
          </TabButton>
        ))}
      </div>

      {/* Loading skeleton */}
      {sx.loading && sx.expenses.length === 0 && (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      )}

      {!sx.loading && (
        <>
          {tab === 'all' && (
            <AllTab
              expenses={visibleExpenses}
              contacts={sx.contacts}
              groups={sx.groups}
              onAddExpense={() => setShowAdd(true)}
              onEditExpense={(e) => setEditing(e)}
              onDeleteExpense={(e) => setDeleteExpense(e)}
            />
          )}
          {tab === 'groups' && (
            <GroupsTab
              groups={sx.groups}
              expenses={sx.expenses}
              settlements={sx.settlements}
              contacts={sx.contacts}
              onOpenGroup={(id) => setOpenGroupId(id)}
              onManageGroups={() => setShowGroupsMgr(true)}
            />
          )}
          {tab === 'people' && (
            <PeopleTab
              contacts={sx.contacts}
              balances={balances}
              displayCurrency={displayCurrency}
              onManageContacts={() => setShowContactsMgr(true)}
              onSettle={(contactId) => {
                const bal = balances.get(contactId) || 0;
                if (bal > 0) {
                  setSettlePrefill({ from: contactId, to: 'self', amount: bal });
                } else if (bal < 0) {
                  setSettlePrefill({ from: 'self', to: contactId, amount: -bal });
                } else {
                  setSettlePrefill({ from: 'self', to: contactId });
                }
                setShowSettle(true);
              }}
            />
          )}
          {tab === 'activity' && (
            <ActivityTab
              activity={sx.activity}
              expenses={sx.expenses}
              settlements={sx.settlements}
              contacts={sx.contacts}
              groups={sx.groups}
            />
          )}
          {tab === 'reports' && (
            <ReportsTab expenses={sx.expenses} displayCurrency={displayCurrency} />
          )}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        data-testid="button-add-expense-fab"
        aria-label="Add expense"
        className="fixed bottom-24 sm:bottom-8 right-4 sm:right-6 z-30 h-14 w-14 rounded-full shadow-lg flex items-center justify-center text-white bg-gradient-to-br from-emerald-500 to-emerald-600 hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add / Edit modal */}
      <AddExpenseModal
        open={showAdd || !!editing}
        existing={editing}
        groups={sx.groups}
        contacts={sx.contacts}
        defaultCurrency={currency}
        defaultGroupId={openGroupId || undefined}
        onClose={() => { setShowAdd(false); setEditing(null); }}
        onSave={async (data) => {
          if (editing) {
            await sx.updateSharedExpense(editing.id, data);
            toast({ title: 'Expense updated' });
          } else {
            await sx.addSharedExpense(data);
            toast({ title: 'Expense added' });
          }
          setShowAdd(false);
          setEditing(null);
        }}
      />

      {/* Settle Up modal */}
      <SettleUpModal
        open={showSettle}
        prefill={settlePrefill}
        contacts={sx.contacts}
        groups={sx.groups}
        defaultCurrency={currency}
        onClose={() => { setShowSettle(false); setSettlePrefill(null); }}
        onSave={async (data) => {
          await sx.addSettlement(data);
          toast({ title: 'Settlement recorded' });
          setShowSettle(false);
          setSettlePrefill(null);
        }}
      />

      {/* Groups manager */}
      <GroupsManagerModal
        open={showGroupsMgr}
        groups={sx.groups}
        contacts={sx.contacts}
        onClose={() => setShowGroupsMgr(false)}
        onCreate={(g) => sx.addGroup(g)}
        onUpdate={sx.updateGroup}
        onDelete={async (id) => { await sx.deleteGroup(id); toast({ title: 'Group deleted' }); }}
      />

      {/* Contacts manager */}
      <ContactsManagerModal
        open={showContactsMgr}
        contacts={sx.contacts}
        onClose={() => setShowContactsMgr(false)}
        onCreate={(c) => sx.addContact(c)}
        onUpdate={sx.updateContact}
        onDelete={async (id) => { await sx.deleteContact(id); toast({ title: 'Contact deleted' }); }}
      />

      {/* Delete expense alert */}
      <AlertDialog open={!!deleteExpense} onOpenChange={(o) => !o && setDeleteExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Delete "${deleteExpense?.title}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteExpense) {
                  await sx.deleteSharedExpense(deleteExpense.id);
                  toast({ title: 'Expense deleted' });
                  setDeleteExpense(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers + small components
// ─────────────────────────────────────────────────────────────────────────────

function tabLabel(k: TabKey) {
  return ({ all: 'All', groups: 'Groups', people: 'People', activity: 'Activity', reports: 'Reports' } as const)[k];
}

function TabButton({ active, value, onClick, children }: { active: boolean; value: TabKey; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      data-testid={`tab-${value}`}
      onClick={onClick}
      className={`relative flex-1 min-w-[72px] px-3 py-1.5 text-sm font-medium rounded-xl transition-colors ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {active && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute inset-0 rounded-xl bg-card shadow-sm border border-border/50"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}

function SummaryCard({ label, amount, tone, currency, showSign }: { label: string; amount: number; tone: 'positive' | 'negative' | 'neutral'; currency: string; showSign?: boolean }) {
  const toneClass = tone === 'positive'
    ? 'text-emerald-500'
    : tone === 'negative'
      ? 'text-rose-500'
      : 'text-foreground';
  const sign = showSign && amount > 0 ? '+' : '';
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-3 sm:p-4">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className={`text-lg sm:text-xl font-bold mt-1 ${toneClass}`} data-testid={`summary-${label.toLowerCase().replace(/[^a-z]/g, '-')}`}>
        {sign}{formatAmount(Math.abs(amount), currency)}
      </p>
    </div>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  const fontSize = Math.max(10, Math.floor(size / 2.6));
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: bg, fontSize }}
    >
      {initials(name)}
    </div>
  );
}

function BalanceBadge({ amount, currency }: { amount: number; currency: string }) {
  if (Math.abs(amount) < 0.005) {
    return <span className="text-xs text-muted-foreground">Settled up</span>;
  }
  if (amount > 0) {
    return (
      <span className="text-xs">
        <span className="text-muted-foreground">owes you </span>
        <span className="font-semibold text-emerald-500">{formatAmount(amount, currency)}</span>
      </span>
    );
  }
  return (
    <span className="text-xs">
      <span className="text-muted-foreground">you owe </span>
      <span className="font-semibold text-rose-500">{formatAmount(-amount, currency)}</span>
    </span>
  );
}

function CategoryDot({ category, size = 36 }: { category: string; size?: number }) {
  const idx = SPLITWISE_CATEGORIES.indexOf(category as any);
  const color = COLORS[(idx >= 0 ? idx : SPLITWISE_CATEGORIES.length) % COLORS.length];
  return (
    <div
      className="rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {category.charAt(0)}
    </div>
  );
}

function relativeDateLabel(d: Date): string {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  if (isThisWeek(d)) return format(d, 'EEEE');
  return format(d, 'MMM d, yyyy');
}

// ─────────────────────────────────────────────────────────────────────────────
// "All" tab — date-grouped expense list
// ─────────────────────────────────────────────────────────────────────────────
function AllTab({
  expenses, contacts, groups, onAddExpense, onEditExpense, onDeleteExpense,
}: {
  expenses: SharedExpense[];
  contacts: ExpenseContact[];
  groups: ExpenseGroup[];
  onAddExpense: () => void;
  onEditExpense: (e: SharedExpense) => void;
  onDeleteExpense: (e: SharedExpense) => void;
}) {
  const sorted = useMemo(
    () => [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [expenses],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, SharedExpense[]>();
    for (const e of sorted) {
      const key = startOfDay(new Date(e.date)).toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [sorted]);

  if (expenses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 text-center">
        <Receipt className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <h3 className="font-medium mb-1">No expenses yet</h3>
        <p className="text-sm text-muted-foreground mb-4">Track shared spending and settle up when you're ready.</p>
        <Button onClick={onAddExpense} data-testid="button-add-first-expense">
          <Plus className="w-4 h-4 mr-1" /> Add your first expense
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map(([dayKey, items]) => {
        const day = new Date(dayKey);
        const dayTotal = items.reduce((s, x) => s + x.amount, 0);
        const dayCurrency = items[0]?.currency || 'USD';
        return (
          <div key={dayKey}>
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-sm font-semibold">{relativeDateLabel(day)}</p>
              <p className="text-xs text-muted-foreground">{formatAmount(dayTotal, dayCurrency)}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
              {items.map((e, i) => (
                <ExpenseRow
                  key={e.id}
                  expense={e}
                  contacts={contacts}
                  groups={groups}
                  divider={i < items.length - 1}
                  onEdit={() => onEditExpense(e)}
                  onDelete={() => onDeleteExpense(e)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExpenseRow({
  expense, contacts, groups, divider, onEdit, onDelete,
}: {
  expense: SharedExpense;
  contacts: ExpenseContact[];
  groups: ExpenseGroup[];
  divider: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const group = expense.groupId ? groups.find(g => g.id === expense.groupId) : null;
  const youPaid = expense.paidBy === 'self';
  const yourShare = expense.splits.find(s => s.contactId === 'self')?.amount || 0;
  const youOweOnThis = !youPaid ? yourShare : 0;
  const youAreOwedOnThis = youPaid ? expense.amount - yourShare : 0;
  const lentLabel = youAreOwedOnThis > 0
    ? <><span className="text-muted-foreground">you lent </span><span className="text-emerald-500 font-semibold">{formatAmount(youAreOwedOnThis, expense.currency)}</span></>
    : youOweOnThis > 0
      ? <><span className="text-muted-foreground">you owe </span><span className="text-rose-500 font-semibold">{formatAmount(youOweOnThis, expense.currency)}</span></>
      : <span className="text-muted-foreground">no balance</span>;
  return (
    <div
      data-testid={`expense-row-${expense.id}`}
      className={`group flex items-center gap-3 px-3 py-3 hover:bg-accent/40 transition-colors ${divider ? 'border-b border-border/40' : ''}`}
    >
      <CategoryDot category={expense.category} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{expense.title}</p>
          {group && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">{group.emoji} {group.name}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {youPaid ? 'You paid' : `${contactNameOf(expense.paidBy, contacts)} paid`} {formatAmount(expense.amount, expense.currency)} · {lentLabel}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="sm" className="p-1 h-auto opacity-0 group-hover:opacity-100" onClick={onEdit} aria-label="Edit" data-testid={`button-edit-expense-${expense.id}`}>
          <Edit className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="sm" className="p-1 h-auto opacity-0 group-hover:opacity-100" onClick={onDelete} aria-label="Delete" data-testid={`button-delete-expense-${expense.id}`}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// "Groups" tab
// ─────────────────────────────────────────────────────────────────────────────
function GroupsTab({
  groups, expenses, settlements, contacts, onOpenGroup, onManageGroups,
}: {
  groups: ExpenseGroup[];
  expenses: SharedExpense[];
  settlements: Settlement[];
  contacts: ExpenseContact[];
  onOpenGroup: (id: string) => void;
  onManageGroups: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={onManageGroups} data-testid="button-manage-groups" className="rounded-xl">
          <Plus className="w-4 h-4 mr-1" /> Manage groups
        </Button>
      </div>
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-medium mb-1">No groups yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Group expenses by trip, project, or household.</p>
          <Button onClick={onManageGroups} data-testid="button-create-first-group">Create a group</Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          {groups.map((g, i) => {
            const gb = calculateGroupBalances(g.id, expenses, settlements);
            const sum = summarizeBalances(gb);
            const groupExpenses = expenses.filter(e => e.groupId === g.id);
            const total = groupExpenses.reduce((s, e) => s + e.amount, 0);
            const net = sum.net;
            const cur = groupExpenses[0]?.currency || 'USD';
            return (
              <button
                key={g.id}
                onClick={() => onOpenGroup(g.id)}
                data-testid={`group-row-${g.id}`}
                className={`w-full text-left flex items-center gap-3 px-3 py-3 hover:bg-accent/40 ${i < groups.length - 1 ? 'border-b border-border/40' : ''}`}
              >
                <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-xl">{g.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {groupExpenses.length} expense{groupExpenses.length !== 1 ? 's' : ''} · {formatAmount(total, cur)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {Math.abs(net) < 0.005 ? (
                    <span className="text-xs text-muted-foreground">Settled</span>
                  ) : net > 0 ? (
                    <span className="text-xs"><span className="text-muted-foreground">net </span><span className="text-emerald-500 font-semibold">+{formatAmount(net, cur)}</span></span>
                  ) : (
                    <span className="text-xs"><span className="text-muted-foreground">net </span><span className="text-rose-500 font-semibold">−{formatAmount(-net, cur)}</span></span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// "People" tab
// ─────────────────────────────────────────────────────────────────────────────
function PeopleTab({
  contacts, balances, displayCurrency, onManageContacts, onSettle,
}: {
  contacts: ExpenseContact[];
  balances: Map<string, number>;
  displayCurrency: string;
  onManageContacts: () => void;
  onSettle: (contactId: string) => void;
}) {
  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => {
      const ba = Math.abs(balances.get(a.id) || 0);
      const bb = Math.abs(balances.get(b.id) || 0);
      return bb - ba;
    });
  }, [contacts, balances]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={onManageContacts} data-testid="button-manage-contacts" className="rounded-xl">
          <Plus className="w-4 h-4 mr-1" /> Manage people
        </Button>
      </div>
      {sortedContacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-medium mb-1">No people yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add the people you split expenses with.</p>
          <Button onClick={onManageContacts} data-testid="button-add-first-person">Add a person</Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          {sortedContacts.map((c, i) => {
            const bal = balances.get(c.id) || 0;
            return (
              <div
                key={c.id}
                data-testid={`person-row-${c.id}`}
                className={`flex items-center gap-3 px-3 py-3 ${i < sortedContacts.length - 1 ? 'border-b border-border/40' : ''}`}
              >
                <Avatar name={c.name} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <BalanceBadge amount={bal} currency={displayCurrency} />
                </div>
                {Math.abs(bal) > 0.005 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl flex-shrink-0"
                    onClick={() => onSettle(c.id)}
                    data-testid={`button-settle-${c.id}`}
                  >
                    Settle
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// "Activity" tab
// ─────────────────────────────────────────────────────────────────────────────
function ActivityTab({
  activity, expenses, settlements, contacts, groups,
}: {
  activity: any[];
  expenses: SharedExpense[];
  settlements: Settlement[];
  contacts: ExpenseContact[];
  groups: ExpenseGroup[];
}) {
  const feed = useMemo(
    () => buildActivityFeed(expenses, settlements, activity),
    [expenses, settlements, activity],
  );
  if (feed.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 text-center">
        <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <h3 className="font-medium mb-1">No activity yet</h3>
        <p className="text-sm text-muted-foreground">Your expense history will appear here.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      {feed.map((a, i) => {
        const group = a.groupId ? groups.find(g => g.id === a.groupId) : null;
        const isPositive = a.kind === 'expense_added' || a.kind === 'group_added' || a.kind === 'contact_added';
        const isNeg = a.kind === 'expense_deleted';
        const dot = isNeg ? 'bg-rose-500/20 text-rose-500' : isPositive ? 'bg-emerald-500/20 text-emerald-500' : 'bg-indigo-500/20 text-indigo-500';
        return (
          <div key={a.id} className={`flex items-center gap-3 px-3 py-3 ${i < feed.length - 1 ? 'border-b border-border/40' : ''}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${dot}`}>
              {a.kind.startsWith('settlement') ? <Banknote className="w-4 h-4" /> :
                a.kind.startsWith('group') ? <Users className="w-4 h-4" /> :
                  a.kind.startsWith('contact') ? <User className="w-4 h-4" /> :
                    <Receipt className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(a.at), 'MMM d, p')}
                {group ? ` · ${group.name}` : ''}
              </p>
            </div>
            {a.amount != null && (
              <p className="text-sm font-semibold flex-shrink-0">{formatAmount(a.amount, a.currency || 'USD')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// "Reports" tab
// ─────────────────────────────────────────────────────────────────────────────
function ReportsTab({ expenses, displayCurrency }: { expenses: SharedExpense[]; displayCurrency: string }) {
  const monthly = useMemo(() => calculateMonthlyTotals(expenses, 6), [expenses]);
  const cats = useMemo(() => Array.from(calculateCategoryTotals(expenses).entries()).map(([name, value]) => ({ name, value })), [expenses]);
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0);
  const avg = expenses.length > 0 ? totalAll / expenses.length : 0;

  if (expenses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 text-center">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <h3 className="font-medium mb-1">No data yet</h3>
        <p className="text-sm text-muted-foreground">Add expenses to see reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryCard label="Total" amount={totalAll} tone="neutral" currency={displayCurrency} />
        <SummaryCard label="Average" amount={avg} tone="neutral" currency={displayCurrency} />
        <SummaryCard label="Count" amount={expenses.length} tone="neutral" currency="USD" />
      </div>

      {/* Monthly bar chart */}
      <div className="rounded-2xl border border-border/50 bg-card p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Monthly spend (last 6 months)</h3>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" stroke="rgb(150,150,170)" fontSize={11} />
              <YAxis stroke="rgb(150,150,170)" fontSize={11} tickFormatter={(v) => formatAmount(v, displayCurrency).replace(/[A-Z]{3}\s?/, '')} />
              <Tooltip content={<ChartTip currency={displayCurrency} />} />
              <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category pie */}
      <div className="rounded-2xl border border-border/50 bg-card p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">By category</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={cats} dataKey="value" nameKey="name" outerRadius={80} label={(p) => `${p.name}`}>
                {cats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTip currency={displayCurrency} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ChartTip({ active, payload, currency }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{p.payload.label || p.payload.name || p.name}</p>
      <p className="text-muted-foreground">{formatAmount(p.value || 0, currency)}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / Edit expense modal
// ─────────────────────────────────────────────────────────────────────────────
function AddExpenseModal({
  open, existing, groups, contacts, defaultCurrency, defaultGroupId, onClose, onSave,
}: {
  open: boolean;
  existing: SharedExpense | null;
  groups: ExpenseGroup[];
  contacts: ExpenseContact[];
  defaultCurrency: string;
  defaultGroupId?: string;
  onClose: () => void;
  onSave: (data: Omit<SharedExpense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [cur, setCur] = useState(defaultCurrency);
  const [paidBy, setPaidBy] = useState<string>('self');
  const [groupId, setGroupId] = useState<string | undefined>(defaultGroupId);
  const [category, setCategory] = useState<string>('Other');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percent' | 'shares'>('equal');
  const [participants, setParticipants] = useState<Set<string>>(new Set(['self']));
  const [exactSplits, setExactSplits] = useState<Record<string, number>>({});
  const [percentSplits, setPercentSplits] = useState<Record<string, number>>({});
  const [shareSplits, setShareSplits] = useState<Record<string, number>>({});
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>(undefined);
  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'monthly' | 'yearly'>('none');
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset form on open
  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitle(existing.title);
      setAmount(String(existing.amount));
      setCur(existing.currency);
      setPaidBy(existing.paidBy);
      setGroupId(existing.groupId);
      setCategory(existing.category);
      setDate(format(new Date(existing.date), 'yyyy-MM-dd'));
      setNotes(existing.notes || '');
      setSplitType(existing.splitType);
      setParticipants(new Set(existing.splits.map(s => s.contactId)));
      setReceiptDataUrl(existing.receiptDataUrl);
      setRecurrence(existing.recurrence || 'none');
      const exact: Record<string, number> = {};
      existing.splits.forEach(s => exact[s.contactId] = s.amount);
      setExactSplits(exact);
      setPercentSplits({});
      setShareSplits({});
    } else {
      setTitle('');
      setAmount('');
      setCur(defaultCurrency);
      setPaidBy('self');
      setGroupId(defaultGroupId);
      setCategory('Other');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setSplitType('equal');
      setParticipants(new Set(['self']));
      setExactSplits({});
      setPercentSplits({});
      setShareSplits({});
      setReceiptDataUrl(undefined);
      setRecurrence('none');
    }
  }, [open, existing, defaultCurrency, defaultGroupId]);

  // When a group is picked, auto-add its members to participants
  useEffect(() => {
    if (!groupId) return;
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    setParticipants(prev => {
      const next = new Set(prev);
      next.add('self');
      g.memberIds.forEach(id => next.add(id));
      return next;
    });
  }, [groupId, groups]);

  // Compute resolved splits to show running totals
  const amountNum = parseFloat(amount) || 0;
  const partList = Array.from(participants);

  const resolvedSplits: SharedExpenseSplit[] = useMemo(() => {
    if (partList.length === 0) return [];
    if (splitType === 'equal') {
      const shares = evenShares(amountNum, partList.length);
      return partList.map((id, i) => ({ contactId: id, amount: shares[i] || 0 }));
    }
    if (splitType === 'exact') {
      return partList.map(id => ({ contactId: id, amount: round2(exactSplits[id] || 0) }));
    }
    if (splitType === 'percent') {
      return partList.map(id => ({
        contactId: id,
        amount: round2(((percentSplits[id] || 0) / 100) * amountNum),
      }));
    }
    // shares
    const totalShares = partList.reduce((s, id) => s + (shareSplits[id] || 0), 0);
    if (totalShares <= 0) return partList.map(id => ({ contactId: id, amount: 0 }));
    return partList.map(id => ({
      contactId: id,
      amount: round2(((shareSplits[id] || 0) / totalShares) * amountNum),
    }));
  }, [splitType, partList, amountNum, exactSplits, percentSplits, shareSplits]);

  const splitsTotal = resolvedSplits.reduce((s, x) => s + x.amount, 0);
  const reconciledOk = Math.abs(splitsTotal - amountNum) < 0.02;

  const togglePart = (id: string) => {
    setParticipants(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) next.add('self');
      return next;
    });
  };

  const handleReceiptPick = (file: File) => {
    if (file.size > 700 * 1024) {
      toast({ title: 'Image too large', description: 'Please pick an image under 700KB.', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReceiptDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    if (amountNum <= 0) {
      toast({ title: 'Amount must be positive', variant: 'destructive' });
      return;
    }
    if (partList.length === 0) {
      toast({ title: 'Pick at least one participant', variant: 'destructive' });
      return;
    }
    if (!reconciledOk) {
      toast({ title: 'Splits don\'t match the total', description: 'Adjust the split values to equal the amount.', variant: 'destructive' });
      return;
    }
    await onSave({
      title: title.trim(),
      amount: amountNum,
      currency: cur,
      paidBy,
      splitType,
      splits: resolvedSplits,
      groupId,
      category,
      date: new Date(date),
      notes: notes || undefined,
      receiptDataUrl,
      recurrence,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            {existing ? 'Edit expense' : 'Add expense'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Dinner, Groceries…" data-testid="input-expense-title" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" data-testid="input-expense-amount" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={cur} onChange={e => setCur(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-expense-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPLITWISE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Paid by</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger data-testid="select-paid-by"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">You</SelectItem>
                  {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Group (optional)</Label>
              <Select value={groupId || 'none'} onValueChange={(v) => setGroupId(v === 'none' ? undefined : v)}>
                <SelectTrigger data-testid="select-group"><SelectValue placeholder="No group" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <Label>Split between</Label>
            <div className="flex flex-wrap gap-1.5">
              <ParticipantPill
                label="You"
                active={participants.has('self')}
                onClick={() => togglePart('self')}
              />
              {contacts.map(c => (
                <ParticipantPill
                  key={c.id}
                  label={c.name}
                  active={participants.has(c.id)}
                  onClick={() => togglePart(c.id)}
                />
              ))}
            </div>
          </div>

          {/* Split type */}
          <div className="space-y-2">
            <Label>Split type</Label>
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted/40 border border-border/50">
              {(['equal', 'exact', 'percent', 'shares'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSplitType(t)}
                  className={`text-xs sm:text-sm py-1.5 rounded-lg transition-colors ${splitType === t ? 'bg-card border border-border/50 shadow-sm font-medium' : 'text-muted-foreground'}`}
                  data-testid={`split-type-${t}`}
                >
                  {t === 'equal' ? 'Equal' : t === 'exact' ? 'Exact' : t === 'percent' ? '%' : 'Shares'}
                </button>
              ))}
            </div>
          </div>

          {/* Per-participant split editor */}
          {splitType !== 'equal' && partList.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-2 space-y-1.5">
              {partList.map(id => {
                const label = id === 'self' ? 'You' : (contacts.find(c => c.id === id)?.name || id);
                if (splitType === 'exact') {
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{label}</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={exactSplits[id] ?? ''}
                        onChange={(e) => setExactSplits(prev => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00"
                        className="w-24 h-8"
                      />
                    </div>
                  );
                }
                if (splitType === 'percent') {
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{label}</span>
                      <Input
                        type="number"
                        step="1"
                        value={percentSplits[id] ?? ''}
                        onChange={(e) => setPercentSplits(prev => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))}
                        placeholder="0"
                        className="w-20 h-8"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  );
                }
                return (
                  <div key={id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm truncate">{label}</span>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={shareSplits[id] ?? ''}
                      onChange={(e) => setShareSplits(prev => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))}
                      placeholder="1"
                      className="w-20 h-8"
                    />
                    <span className="text-xs text-muted-foreground">shares</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reconciliation banner */}
          {amountNum > 0 && partList.length > 0 && (
            <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl border ${reconciledOk ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500' : 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400'}`}>
              <span>Splits total: {formatAmount(splitsTotal, cur)}</span>
              <span>{reconciledOk ? '✓ matches' : `off by ${formatAmount(amountNum - splitsTotal, cur)}`}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Recurrence</Label>
              <Select value={recurrence} onValueChange={(v: any) => setRecurrence(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Receipt</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptPick(f); }}
                />
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => fileRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-1" /> {receiptDataUrl ? 'Change' : 'Add'}
                </Button>
                {receiptDataUrl && (
                  <>
                    <img src={receiptDataUrl} alt="Receipt preview" className="h-9 w-9 rounded-md object-cover" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setReceiptDataUrl(undefined)} aria-label="Remove receipt">
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any details…" className="min-h-[60px]" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} data-testid="button-save-expense">
            <Check className="w-4 h-4 mr-1" /> {existing ? 'Save' : 'Add expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParticipantPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm transition-colors ${active ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500' : 'border-border/60 text-muted-foreground hover:bg-muted/40'}`}
      data-testid={`participant-${label.toLowerCase().replace(/\s/g, '-')}`}
    >
      <Avatar name={label} size={20} />
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settle Up modal
// ─────────────────────────────────────────────────────────────────────────────
function SettleUpModal({
  open, prefill, contacts, groups, defaultCurrency, onClose, onSave,
}: {
  open: boolean;
  prefill: { from?: string; to?: string; amount?: number; groupId?: string } | null;
  contacts: ExpenseContact[];
  groups: ExpenseGroup[];
  defaultCurrency: string;
  onClose: () => void;
  onSave: (s: Omit<Settlement, 'id' | 'createdAt'>) => Promise<void>;
}) {
  const { toast } = useToast();
  const [from, setFrom] = useState('self');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [cur, setCur] = useState(defaultCurrency);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<'cash' | 'upi' | 'bank' | 'card' | 'other'>('cash');
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setFrom(prefill?.from || 'self');
    setTo(prefill?.to || '');
    setAmount(prefill?.amount ? String(prefill.amount) : '');
    setGroupId(prefill?.groupId);
    setCur(defaultCurrency);
    setDate(new Date().toISOString().split('T')[0]);
    setMethod('cash');
    setNotes('');
  }, [open, prefill, defaultCurrency]);

  const handleSave = async () => {
    if (!from || !to) {
      toast({ title: 'Pick both parties', variant: 'destructive' });
      return;
    }
    if (from === to) {
      toast({ title: 'Pick different parties', variant: 'destructive' });
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: 'Amount must be positive', variant: 'destructive' });
      return;
    }
    await onSave({
      fromContact: from,
      toContact: to,
      amount: amt,
      currency: cur,
      date: new Date(date),
      method,
      groupId,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5" /> Settle up
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger data-testid="settle-from"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">You</SelectItem>
                  {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger data-testid="settle-to"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">You</SelectItem>
                  {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} data-testid="settle-amount" />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={cur} onChange={e => setCur(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SETTLEMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {groups.length > 0 && (
            <div className="space-y-1.5">
              <Label>Group (optional)</Label>
              <Select value={groupId || 'none'} onValueChange={(v) => setGroupId(v === 'none' ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="No group" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[44px]" placeholder="Optional" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} data-testid="button-save-settlement"><Check className="w-4 h-4 mr-1" /> Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Group detail screen
// ─────────────────────────────────────────────────────────────────────────────
function GroupDetailScreen({
  group, sx, displayCurrency, onBack, onAddExpense, onSettle, onEditExpense, onDeleteExpense,
}: {
  group: ExpenseGroup;
  sx: ReturnType<typeof useSharedExpenses>;
  displayCurrency: string;
  onBack: () => void;
  onAddExpense: () => void;
  onSettle: (prefill?: { from?: string; to?: string; amount?: number; groupId?: string }) => void;
  onEditExpense: (e: SharedExpense) => void;
  onDeleteExpense: (e: SharedExpense) => void;
}) {
  const [sub, setSub] = useState<'expenses' | 'balances' | 'totals'>('expenses');
  const groupExpenses = sx.expenses.filter(e => e.groupId === group.id);
  const groupSettlements = sx.settlements.filter(s => s.groupId === group.id);
  const groupBalances = useMemo(
    () => calculateGroupBalances(group.id, sx.expenses, sx.settlements),
    [group.id, sx.expenses, sx.settlements],
  );
  const simpl = useMemo(() => simplifyDebts(groupBalances), [groupBalances]);
  const sum = summarizeBalances(groupBalances);
  const total = groupExpenses.reduce((s, e) => s + e.amount, 0);
  const cur = groupExpenses[0]?.currency || displayCurrency;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back" data-testid="button-back-group">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-2xl">{group.emoji}</span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight truncate">{group.name}</h1>
            <p className="text-xs text-muted-foreground">{groupExpenses.length} expense{groupExpenses.length !== 1 ? 's' : ''} · {formatAmount(total, cur)}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onSettle({ groupId: group.id })} data-testid="button-group-settle" className="rounded-xl">
          <Banknote className="w-4 h-4 mr-1" /> Settle
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryCard label="You owe" amount={sum.youOwe} tone="negative" currency={cur} />
        <SummaryCard label="You're owed" amount={sum.youAreOwed} tone="positive" currency={cur} />
        <SummaryCard label="Net" amount={sum.net} tone={sum.net >= 0 ? 'positive' : 'negative'} currency={cur} showSign />
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/40 border border-border/50">
        {(['expenses', 'balances', 'totals'] as const).map(k => (
          <button
            key={k}
            onClick={() => setSub(k)}
            className={`relative flex-1 px-3 py-1.5 text-sm font-medium rounded-xl ${sub === k ? 'text-foreground' : 'text-muted-foreground'}`}
            data-testid={`group-tab-${k}`}
          >
            {sub === k && <motion.div layoutId="group-sub-indicator" className="absolute inset-0 rounded-xl bg-card shadow-sm border border-border/50" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
            <span className="relative">{k.charAt(0).toUpperCase() + k.slice(1)}</span>
          </button>
        ))}
      </div>

      {sub === 'expenses' && (
        groupExpenses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 text-center">
            <Receipt className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-1">No expenses in this group</h3>
            <Button onClick={onAddExpense} className="mt-2"><Plus className="w-4 h-4 mr-1" /> Add</Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            {groupExpenses
              .slice()
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((e, i, arr) => (
                <ExpenseRow
                  key={e.id}
                  expense={e}
                  contacts={sx.contacts}
                  groups={sx.groups}
                  divider={i < arr.length - 1}
                  onEdit={() => onEditExpense(e)}
                  onDelete={() => onDeleteExpense(e)}
                />
              ))}
          </div>
        )
      )}

      {sub === 'balances' && (
        <div className="space-y-3">
          {Array.from(groupBalances.entries()).length === 0 ? (
            <div className="rounded-2xl border border-border/50 bg-card p-6 text-center text-sm text-muted-foreground">
              All settled up in this group.
            </div>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
              {Array.from(groupBalances.entries()).map(([id, bal], i, arr) => {
                const name = contactNameOf(id, sx.contacts);
                return (
                  <div key={id} className={`flex items-center gap-3 px-3 py-3 ${i < arr.length - 1 ? 'border-b border-border/40' : ''}`}>
                    <Avatar name={name} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{name}</p>
                      <BalanceBadge amount={bal} currency={cur} />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => {
                        if (bal > 0) onSettle({ from: id, to: 'self', amount: bal, groupId: group.id });
                        else onSettle({ from: 'self', to: id, amount: -bal, groupId: group.id });
                      }}
                      data-testid={`button-group-settle-${id}`}
                    >
                      Settle
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Suggested payments */}
          {simpl.length > 0 && (
            <div className="rounded-2xl border border-border/50 bg-card p-3">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Suggested settlements</p>
              <div className="space-y-1.5">
                {simpl.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{contactNameOf(p.from, sx.contacts)}</span>
                    <span className="text-muted-foreground">pays</span>
                    <span className="font-medium">{contactNameOf(p.to, sx.contacts)}</span>
                    <span className="ml-auto text-emerald-500 font-semibold">{formatAmount(p.amount, cur)}</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onSettle({ from: p.from, to: p.to, amount: p.amount, groupId: group.id })}>
                      Record
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settlement log */}
          {groupSettlements.length > 0 && (
            <div className="rounded-2xl border border-border/50 bg-card p-3">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Settlement history</p>
              <div className="space-y-1.5">
                {groupSettlements
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-sm">
                      <Banknote className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        {contactNameOf(s.fromContact, sx.contacts)} paid {contactNameOf(s.toContact, sx.contacts)}
                      </span>
                      <span className="ml-auto font-semibold">{formatAmount(s.amount, s.currency)}</span>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => sx.deleteSettlement(s.id)} aria-label="Delete settlement">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {sub === 'totals' && (
        <div className="space-y-3">
          <CategoryBreakdownList expenses={groupExpenses} cur={cur} />
        </div>
      )}
    </div>
  );
}

function CategoryBreakdownList({ expenses, cur }: { expenses: SharedExpense[]; cur: string }) {
  const cats = Array.from(calculateCategoryTotals(expenses).entries());
  const total = cats.reduce((s, [, v]) => s + v, 0);
  if (cats.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
        No data.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-3 space-y-2">
      {cats.map(([name, value], i) => {
        const pct = total > 0 ? (value / total) * 100 : 0;
        const idx = SPLITWISE_CATEGORIES.indexOf(name as any);
        const color = COLORS[(idx >= 0 ? idx : SPLITWISE_CATEGORIES.length) % COLORS.length];
        return (
          <div key={name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="truncate">{name}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                <span className="font-semibold w-24 text-right">{formatAmount(value, cur)}</span>
              </div>
            </div>
            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Groups manager
// ─────────────────────────────────────────────────────────────────────────────
function GroupsManagerModal({
  open, groups, contacts, onClose, onCreate, onUpdate, onDelete,
}: {
  open: boolean;
  groups: ExpenseGroup[];
  contacts: ExpenseContact[];
  onClose: () => void;
  onCreate: (g: Omit<ExpenseGroup, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ExpenseGroup>;
  onUpdate: (id: string, patch: Partial<ExpenseGroup>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👥');
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { if (!open) { setName(''); setEmoji('👥'); setMemberIds(new Set()); setEditingId(null); } }, [open]);

  const startEdit = (g: ExpenseGroup) => {
    setEditingId(g.id);
    setName(g.name);
    setEmoji(g.emoji);
    setMemberIds(new Set(g.memberIds));
  };
  const cancelEdit = () => { setEditingId(null); setName(''); setEmoji('👥'); setMemberIds(new Set()); };

  const submit = async () => {
    if (!name.trim()) return;
    if (editingId) {
      await onUpdate(editingId, { name: name.trim(), emoji, memberIds: Array.from(memberIds) });
    } else {
      await onCreate({ name: name.trim(), emoji, memberIds: Array.from(memberIds), description: '', archived: false });
    }
    cancelEdit();
  };

  const EMOJI_OPTIONS = ['👥', '🏠', '✈️', '🍕', '🎉', '🛒', '🚗', '💼', '🎮', '🏖️', '⚽', '📚'];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Manage groups</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <div className="flex flex-wrap gap-1 max-w-[140px]">
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-sm ${emoji === e ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40' : 'hover:bg-muted/40'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Group name (e.g. Trip to Goa)" data-testid="input-group-name" />
            </div>
            {contacts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Members (you're always included)</p>
                <div className="flex flex-wrap gap-1.5">
                  {contacts.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setMemberIds(prev => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                        return next;
                      })}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs ${memberIds.has(c.id) ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500' : 'border-border/60 text-muted-foreground hover:bg-muted/40'}`}
                      data-testid={`group-member-${c.id}`}
                    >
                      <Avatar name={c.name} size={16} /> {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              {editingId && <Button variant="outline" size="sm" onClick={cancelEdit}>Cancel</Button>}
              <Button size="sm" onClick={submit} disabled={!name.trim()} data-testid="button-save-group">
                {editingId ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>

          {groups.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              {groups.map((g, i) => (
                <div key={g.id} className={`flex items-center gap-2 px-3 py-2 ${i < groups.length - 1 ? 'border-b border-border/40' : ''}`}>
                  <span className="text-lg">{g.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.memberIds.length + 1} member{g.memberIds.length !== 0 ? 's' : ''}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => startEdit(g)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onDelete(g.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contacts manager
// ─────────────────────────────────────────────────────────────────────────────
function ContactsManagerModal({
  open, contacts, onClose, onCreate, onUpdate, onDelete,
}: {
  open: boolean;
  contacts: ExpenseContact[];
  onClose: () => void;
  onCreate: (c: Omit<ExpenseContact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ExpenseContact>;
  onUpdate: (id: string, patch: Partial<ExpenseContact>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { if (!open) { setName(''); setEmail(''); setPhone(''); setEditingId(null); } }, [open]);

  const startEdit = (c: ExpenseContact) => {
    setEditingId(c.id);
    setName(c.name);
    setEmail(c.email || '');
    setPhone(c.phone || '');
  };
  const cancelEdit = () => { setEditingId(null); setName(''); setEmail(''); setPhone(''); };

  const submit = async () => {
    if (!name.trim()) return;
    if (editingId) {
      await onUpdate(editingId, { name: name.trim(), email, phone });
    } else {
      await onCreate({ name: name.trim(), email, phone, notes: '' });
    }
    cancelEdit();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Manage people</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name" data-testid="input-contact-name" />
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" type="email" />
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" />
            <div className="flex justify-end gap-2">
              {editingId && <Button variant="outline" size="sm" onClick={cancelEdit}>Cancel</Button>}
              <Button size="sm" onClick={submit} disabled={!name.trim()} data-testid="button-save-contact">
                {editingId ? 'Save' : 'Add'}
              </Button>
            </div>
          </div>

          {contacts.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              {contacts.map((c, i) => (
                <div key={c.id} className={`flex items-center gap-2 px-3 py-2 ${i < contacts.length - 1 ? 'border-b border-border/40' : ''}`}>
                  <Avatar name={c.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => startEdit(c)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onDelete(c.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function round2(v: number): number { return Math.round(v * 100) / 100; }
