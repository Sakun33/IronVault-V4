import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, MoreVertical, RefreshCw, Mail, Calendar, Eye, ChevronLeft, ChevronRight, X, Download, UserPlus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';

interface Customer {
  id: string;
  email: string;
  name: string;
  region: string;
  status: string;
  plan_name?: string;
  plan?: string;
  created_at: string;
  last_active?: string;
  last_active_at?: string;
}

interface CustomersResponse {
  customers: Customer[];
  // Some backend versions return a flat `total` field, others wrap it in `pagination`
  total?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', email: '', phone: '', region: 'US', plan_name: 'Free', status: 'active',
  });
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (urlSearch) setSearch(urlSearch);
  }, [urlSearch]);

  const { data, isLoading, refetch } = useQuery<CustomersResponse>({
    queryKey: ['customers', page, limit, search, statusFilter, planFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }),
        ...(planFilter && planFilter !== 'all' && { plan: planFilter }),
      });

      const response = await fetch(`/api/customers?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    },
  });

  const customers = data?.customers || [];
  const totalCount = data?.pagination?.total ?? data?.total ?? customers.length;
  const pagination = data?.pagination || { page: 1, limit: 50, total: totalCount, pages: Math.ceil(totalCount / 50) };

  const createMutation = useMutation({
    mutationFn: async (form: typeof createForm) => {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create customer');
      }
      return res.json();
    },
    onSuccess: (newCustomer) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowCreateDialog(false);
      setCreateForm({ name: '', email: '', phone: '', region: 'US', plan_name: 'Free', status: 'active' });
      setCreateError('');
      navigate(`/customers/${newCustomer.id}`);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      active: { className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800', label: 'Active' },
      inactive: { className: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-800', label: 'Inactive' },
      suspended: { className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800', label: 'Suspended' },
    };
    const variant = variants[status] || variants.inactive;
    
    return (
      <Badge className={`${variant.className} font-semibold border px-2.5 py-1`}>
        {variant.label}
      </Badge>
    );
  };

  const getPlanBadge = (planName: string) => {
    const normalizedPlan = planName?.toLowerCase() || 'free';
    const colors: Record<string, string> = {
      'free': 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-800',
      'premium': 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
      'pro': 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
      'pro monthly': 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
      'pro yearly': 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
      'lifetime': 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
    };
    
    const displayName = normalizedPlan === 'premium' ? 'Pro' : planName?.charAt(0).toUpperCase() + planName?.slice(1) || 'Free';
    
    return (
      <Badge className={`${colors[normalizedPlan] || colors['free']} font-semibold border px-2.5 py-1`}>
        {displayName}
      </Badge>
    );
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPlanFilter('all');
    setPage(1);
  };

  const hasActiveFilters = search || statusFilter !== 'all' || planFilter !== 'all';

  if (isLoading && !customers.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-primary" />
          <p className="text-lg font-medium text-foreground">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Customers</h1>
          <p className="text-muted-foreground mt-1.5">Manage and view all {pagination.total} customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="default" className="shadow-sm hover:shadow-md transition-all"
            onClick={() => {
              const token = localStorage.getItem('admin_token');
              fetch('/api/customers/export/csv', { headers: { 'Authorization': `Bearer ${token}` } })
                .then(r => r.blob())
                .then(blob => {
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `customers-export-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                });
            }}>
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
          <Button onClick={() => refetch()} variant="outline" size="default" className="shadow-sm hover:shadow-md transition-all">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => { setCreateError(''); setShowCreateDialog(true); }} size="default" className="shadow-sm hover:shadow-md transition-all">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Create Customer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Name *</Label>
                <Input id="c-name" placeholder="Jane Doe" value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email *</Label>
                <Input id="c-email" type="email" placeholder="jane@example.com" value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">Phone</Label>
                <Input id="c-phone" placeholder="+1 555 0100" value={createForm.phone}
                  onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-region">Region</Label>
                <Input id="c-region" placeholder="US" value={createForm.region}
                  onChange={e => setCreateForm(f => ({ ...f, region: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Subscription Plan</Label>
                <Select value={createForm.plan_name} onValueChange={v => setCreateForm(f => ({ ...f, plan_name: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Free">Free</SelectItem>
                    <SelectItem value="Pro Monthly">Pro Monthly</SelectItem>
                    <SelectItem value="Pro Yearly">Pro Yearly</SelectItem>
                    <SelectItem value="Lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={createForm.status} onValueChange={v => setCreateForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              disabled={createMutation.isPending || !createForm.name || !createForm.email}
              onClick={() => createMutation.mutate(createForm)}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters Card */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Filters</CardTitle>
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1.5" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 font-medium"
              />
            </div>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="font-medium">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Plan Filter — values are entitlements canonical keys, not display labels */}
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="font-medium">
                <SelectValue placeholder="Filter by plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="premium">Pro</SelectItem>
                <SelectItem value="family">Pro Family</SelectItem>
                <SelectItem value="lifetime">Lifetime</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customer List Card */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-foreground">
            Customer List
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({pagination.total} total)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="font-semibold text-foreground">Customer</TableHead>
                  <TableHead className="font-semibold text-foreground">Plan</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground">Region</TableHead>
                  <TableHead className="font-semibold text-foreground">Created</TableHead>
                  <TableHead className="font-semibold text-foreground">Last Active</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow 
                    key={customer.id} 
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{customer.name}</span>
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(customer.plan_name || customer.plan || 'free')}</TableCell>
                    <TableCell>{getStatusBadge(customer.status)}</TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">{customer.region}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {customer.created_at ? format(new Date(customer.created_at), 'M/d/yyyy') : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {(customer.last_active || customer.last_active_at) ? format(new Date(customer.last_active || customer.last_active_at!), 'M/d/yyyy') : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/customers/${customer.id}`);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Email
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground font-medium">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} customers
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="font-medium"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      className="w-9 h-9 font-semibold"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="font-medium"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
