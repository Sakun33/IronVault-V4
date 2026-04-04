import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tag, Plus, Trash2, Edit, Percent, DollarSign, Calendar, Gift } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const fetchWithAuth = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
      ...options?.headers,
    }
  });
  if (!response.ok) throw new Error('Request failed');
  return response.json();
};

export default function PromotionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    code: '', percent_off: '', amount_off: '', valid_from: '', valid_to: '',
    description: '', usage_limit: '',
  });

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: () => fetchWithAuth('/api/promotions'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth('/api/promotions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setShowModal(false);
      resetForm();
      toast({ title: 'Promotion Created' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create promotion', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth(`/api/promotions/${data.promo_id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setShowModal(false);
      setEditing(null);
      resetForm();
      toast({ title: 'Promotion Updated' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/promotions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast({ title: 'Promotion Deleted' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (promo: any) => fetchWithAuth(`/api/promotions/${promo.promo_id}`, {
      method: 'PUT', body: JSON.stringify({ is_active: !promo.is_active })
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  });

  const resetForm = () => setForm({ code: '', percent_off: '', amount_off: '', valid_from: '', valid_to: '', description: '', usage_limit: '' });

  const openEdit = (promo: any) => {
    setEditing(promo);
    setForm({
      code: promo.code,
      percent_off: promo.percent_off ? String(promo.percent_off) : '',
      amount_off: promo.amount_off ? String(promo.amount_off) : '',
      valid_from: promo.valid_from ? format(new Date(promo.valid_from), "yyyy-MM-dd'T'HH:mm") : '',
      valid_to: promo.valid_to ? format(new Date(promo.valid_to), "yyyy-MM-dd'T'HH:mm") : '',
      description: promo.description || '',
      usage_limit: promo.usage_limit ? String(promo.usage_limit) : '',
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    const data = {
      code: form.code,
      percent_off: form.percent_off ? parseFloat(form.percent_off) : null,
      amount_off: form.amount_off ? parseFloat(form.amount_off) : null,
      valid_from: form.valid_from || undefined,
      valid_to: form.valid_to || undefined,
      description: form.description,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
    };
    if (editing) {
      updateMutation.mutate({ ...data, promo_id: editing.promo_id });
    } else {
      createMutation.mutate(data);
    }
  };

  const isExpired = (promo: any) => promo.valid_to && new Date(promo.valid_to) < new Date();
  const isUpcoming = (promo: any) => promo.valid_from && new Date(promo.valid_from) > new Date();

  const activeCount = promotions.filter((p: any) => p.is_active && !isExpired(p)).length;
  const expiredCount = promotions.filter((p: any) => isExpired(p)).length;
  const totalUsage = promotions.reduce((sum: number, p: any) => sum + (p.usage_count || 0), 0);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Promotions</h1>
          <p className="text-muted-foreground mt-1">Manage promotional codes and discounts</p>
        </div>
        <Button onClick={() => { setEditing(null); resetForm(); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />Create Promotion
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Promos</p>
                <p className="text-2xl font-bold">{promotions.length}</p>
              </div>
              <Gift className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
              <Tag className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
              </div>
              <Calendar className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Uses</p>
                <p className="text-2xl font-bold">{totalUsage}</p>
              </div>
              <Percent className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.map((promo: any) => (
                <TableRow key={promo.promo_id}>
                  <TableCell>
                    <code className="px-2 py-1 bg-muted rounded text-sm font-mono font-bold">{promo.code}</code>
                  </TableCell>
                  <TableCell>
                    {promo.percent_off ? (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400">
                        <Percent className="w-3 h-3 mr-1" />{promo.percent_off}% off
                      </Badge>
                    ) : promo.amount_off ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                        <DollarSign className="w-3 h-3 mr-1" />${promo.amount_off} off
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{promo.description || '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{format(new Date(promo.valid_from), 'MMM d, yyyy')}</div>
                    <div>to {format(new Date(promo.valid_to), 'MMM d, yyyy')}</div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{promo.usage_count || 0}</span>
                    {promo.usage_limit && <span className="text-muted-foreground">/{promo.usage_limit}</span>}
                  </TableCell>
                  <TableCell>
                    {isExpired(promo) ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : isUpcoming(promo) ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">Upcoming</Badge>
                    ) : promo.is_active ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400">Live</Badge>
                    ) : (
                      <Badge variant="secondary">Paused</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch checked={promo.is_active} onCheckedChange={() => toggleMutation.mutate(promo)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(promo)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(promo.promo_id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {promotions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No promotions yet. Create your first promotion code.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Promotion' : 'Create Promotion'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Promo Code</Label>
              <Input value={form.code} onChange={(e) => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. LAUNCH50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Percent Off (%)</Label>
                <Input type="number" value={form.percent_off} onChange={(e) => setForm(p => ({ ...p, percent_off: e.target.value, amount_off: '' }))} placeholder="e.g. 20" />
              </div>
              <div className="space-y-2">
                <Label>Amount Off ($)</Label>
                <Input type="number" value={form.amount_off} onChange={(e) => setForm(p => ({ ...p, amount_off: e.target.value, percent_off: '' }))} placeholder="e.g. 5.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Promotional description..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input type="datetime-local" value={form.valid_from} onChange={(e) => setForm(p => ({ ...p, valid_from: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Valid To</Label>
                <Input type="datetime-local" value={form.valid_to} onChange={(e) => setForm(p => ({ ...p, valid_to: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Usage Limit (leave empty for unlimited)</Label>
              <Input type="number" value={form.usage_limit} onChange={(e) => setForm(p => ({ ...p, usage_limit: e.target.value }))} placeholder="e.g. 100" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!form.code || (!form.percent_off && !form.amount_off)}>
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
