import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CreditCard, Plus, Edit, Trash2, Users, DollarSign } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Plan {
  plan_id: number;
  name: string;
  price: number;
  billing_cycle: string;
  features?: string;
  is_active: boolean;
  customer_count?: number;
}

export default function PlansPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    billing_cycle: 'monthly',
    features: ''
  });

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const response = await fetch('/api/plans', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch plans');
      return response.json();
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({
          ...data,
          price: parseFloat(data.price)
        }),
      });
      if (!response.ok) throw new Error('Failed to create plan');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setShowCreateModal(false);
      resetForm();
      toast({
        title: "Plan created",
        description: "The plan has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create plan. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Plan> }) => {
      const response = await fetch(`/api/plans/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update plan');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setEditingPlan(null);
      resetForm();
      toast({
        title: "Plan updated",
        description: "The plan has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update plan. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/plans/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete plan');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast({
        title: "Plan deleted",
        description: "The plan has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      billing_cycle: 'monthly',
      features: ''
    });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.price) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createPlanMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editingPlan) return;
    updatePlanMutation.mutate({
      id: editingPlan.plan_id,
      data: {
        ...formData,
        price: parseFloat(formData.price)
      }
    });
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price: plan.price.toString(),
      billing_cycle: plan.billing_cycle,
      features: plan.features || ''
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this plan?')) {
      deletePlanMutation.mutate(id);
    }
  };

  const getBillingCycleBadge = (cycle: string) => {
    const colors = {
      monthly: 'bg-blue-100 text-blue-800',
      yearly: 'bg-green-100 text-green-800',
      lifetime: 'bg-purple-100 text-purple-800',
    };
    return colors[cycle as keyof typeof colors] || 'bg-gray-100 text-gray-800';
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
        <div>
          <h1 className="text-3xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground">Manage your subscription plans and pricing</p>
        </div>
        <Dialog open={showCreateModal || !!editingPlan} onOpenChange={(open: boolean) => {
          if (!open) {
            setShowCreateModal(false);
            setEditingPlan(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Pro Monthly"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 9.99"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_cycle">Billing Cycle *</Label>
                <Select 
                  value={formData.billing_cycle} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, billing_cycle: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">Features</Label>
                <Input
                  id="features"
                  placeholder="Comma-separated features"
                  value={formData.features}
                  onChange={(e) => setFormData(prev => ({ ...prev, features: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingPlan(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={editingPlan ? handleUpdate : handleCreate}
                  disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                >
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plans?.reduce((sum, plan) => sum + (plan.customer_count || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${plans?.reduce((sum, plan) => sum + (parseFloat(String(plan.price)) * (plan.customer_count || 0)), 0).toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Billing Cycle</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans?.map((plan) => (
                <TableRow key={plan.plan_id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>${parseFloat(String(plan.price)).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={getBillingCycleBadge(plan.billing_cycle)}>
                      {plan.billing_cycle}
                    </Badge>
                  </TableCell>
                  <TableCell>{plan.customer_count || 0}</TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(plan)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(plan.plan_id)}
                        disabled={deletePlanMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {plans?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No plans found. Create your first plan to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

