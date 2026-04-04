import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, MoreHorizontal, Mail, Calendar, CreditCard, Eye } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return colors[status] || colors.inactive;
  };

  const handleViewCustomer = (customerId: number) => {
    navigate(`/customers/${customerId}`);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      suspended: 'destructive',
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const getPlanBadge = (planName: string) => {
    const colors = {
      'Free': 'bg-gray-100 text-gray-800',
      'Pro Monthly': 'bg-blue-100 text-blue-800',
      'Pro Yearly': 'bg-green-100 text-green-800',
      'Lifetime': 'bg-purple-100 text-purple-800',
    };
    
    return (
      <Badge className={colors[planName as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {planName || 'No Plan'}
      </Badge>
    );
  };

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Customers</h1>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>

            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Plans</SelectItem>
                <SelectItem value="Free">Free</SelectItem>
                <SelectItem value="Pro Monthly">Pro Monthly</SelectItem>
                <SelectItem value="Pro Yearly">Pro Yearly</SelectItem>
                <SelectItem value="Lifetime">Lifetime</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setPlanFilter('');
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{customer.name || customer.email}</div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <Mail className="h-3 w-3 mr-1" />
                        {customer.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getPlanBadge(customer.plan_name)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(customer.status)}
                  </TableCell>
                  <TableCell>
                    {customer.region || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(customer.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-3 w-3 mr-1" />
                      {customer.last_active ? new Date(customer.last_active).toLocaleDateString() : 'Never'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewCustomer(customer.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleViewCustomer(customer.id)}>
                          Edit Customer
                        </DropdownMenuItem>
                        <DropdownMenuItem>View Subscriptions</DropdownMenuItem>
                        <DropdownMenuItem>Support Tickets</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">Suspend Account</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {customers?.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No customers found matching your criteria.
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Showing {customers?.length || 0} customers
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!customers || customers.length < limit}
                onClick={() => setPage(page + 1)}
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
