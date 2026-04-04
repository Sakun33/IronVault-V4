import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, MoreHorizontal, RefreshCw, Mail, Calendar, Eye } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

interface Customer {
  id: number;
  email: string;
  name: string;
  region: string;
  status: string;
  plan_name: string;
  created_at: string;
  last_active: string;
}

interface CustomersResponse {
  customers: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const { data, isLoading, refetch } = useQuery<CustomersResponse>({
    queryKey: ['customers', page, limit, search, statusFilter, planFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(planFilter && { plan: planFilter }),
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
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, pages: 0 };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      active: { className: 'bg-green-100 text-green-800 border-green-200', label: 'Active' },
      inactive: { className: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Inactive' },
      suspended: { className: 'bg-red-100 text-red-800 border-red-200', label: 'Suspended' },
    };
    const variant = variants[status] || variants.inactive;
    
    return (
      <Badge className={`${variant.className} font-medium`}>
        {variant.label}
      </Badge>
    );
  };

  const getPlanBadge = (planName: string) => {
    const colors: Record<string, string> = {
      'Free': 'bg-gray-100 text-gray-800 border-gray-200',
      'Pro Monthly': 'bg-blue-100 text-blue-800 border-blue-200',
      'Pro Yearly': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'Lifetime': 'bg-purple-100 text-purple-800 border-purple-200',
    };
    
    return (
      <Badge className={`${colors[planName] || colors['Free']} font-medium`}>
        {planName || 'No Plan'}
      </Badge>
    );
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPlanFilter('');
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-1">Manage and view all your customers</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="hover:bg-blue-50">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters Card */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 focus:bg-white"
              />
            </div>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-gray-50 border-gray-200 focus:bg-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>

            {/* Plan Filter */}
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="bg-gray-50 border-gray-200 focus:bg-white">
                <SelectValue placeholder="Filter by plan" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="Free">Free</SelectItem>
                <SelectItem value="Pro Monthly">Pro Monthly</SelectItem>
                <SelectItem value="Pro Yearly">Pro Yearly</SelectItem>
                <SelectItem value="Lifetime">Lifetime</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Button */}
            <Button 
              variant="outline" 
              onClick={handleClearFilters}
              className="hover:bg-gray-50"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600">Total Customers</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{pagination.total}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600">Current Page</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{pagination.page} of {pagination.pages}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600">Showing</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{customers.length} customers</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600">Per Page</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{limit}</div>
          </CardContent>
        </Card>
      </div>

      {/* Customers Table */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-900">Customer</TableHead>
                  <TableHead className="font-semibold text-gray-900">Plan</TableHead>
                  <TableHead className="font-semibold text-gray-900">Status</TableHead>
                  <TableHead className="font-semibold text-gray-900">Region</TableHead>
                  <TableHead className="font-semibold text-gray-900">Created</TableHead>
                  <TableHead className="font-semibold text-gray-900">Last Active</TableHead>
                  <TableHead className="font-semibold text-gray-900">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{customer.name}</span>
                        <span className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(customer.plan_name)}</TableCell>
                    <TableCell>{getStatusBadge(customer.status)}</TableCell>
                    <TableCell>
                      <span className="text-gray-900 font-medium">{customer.region}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(customer.created_at), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {format(new Date(customer.last_active), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-white">
                          <DropdownMenuItem 
                            onClick={() => navigate(`/customers/${customer.id}`)}
                            className="cursor-pointer hover:bg-gray-100"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer hover:bg-gray-100">
                            <Mail className="h-4 w-4 mr-2" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer text-red-600 hover:bg-red-50">
                            Suspend Account
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
          <div className="flex items-center justify-between pt-6 border-t mt-6">
            <p className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} customers
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                disabled={page === pagination.pages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
