import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, User, Mail, MapPin, Calendar, CreditCard, 
  MessageSquare, FileText, Activity, Bell, Edit, Save, X, Tag, Plus 
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

interface Customer {
  id: string;
  email: string;
  name: string;
  region: string;
  plan_name?: string;
  plan?: string;
  status: string;
  created_at: string;
  last_active?: string;
  last_active_at?: string;
  phone?: string;
  app_version?: string;
  platform?: string;
  trial_active?: boolean;
  trial_ends_at?: string;
  current_period_ends_at?: string;
  will_renew?: boolean;
}

interface JourneyEvent {
  event: string;
  timestamp: string;
  details: string;
  status: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface Note {
  id: string | number;
  content: string;
  author: string;
  created_at: string;
}

interface Communication {
  id: string | number;
  type: string;
  subject: string;
  status: string;
  timestamp: string;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<Partial<Customer>>({});
  const [newNote, setNewNote] = useState('');
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch customer');
      return response.json();
    },
  });

  const { data: journey } = useQuery<JourneyEvent[]>({
    queryKey: ['customer-journey', id],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${id}/journey`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch journey');
      return response.json();
    },
  });

  const { data: tickets } = useQuery<Ticket[]>({
    queryKey: ['customer-tickets', id],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${id}/tickets`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return response.json();
    },
  });

  const { data: notes } = useQuery<Note[]>({
    queryKey: ['customer-notes', id],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${id}/notes`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch notes');
      return response.json();
    },
  });

  const { data: communications } = useQuery<Communication[]>({
    queryKey: ['customer-communications', id],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${id}/communications`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch communications');
      return response.json();
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (data: Partial<Customer>) => {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update customer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      setIsEditing(false);
      setEditedCustomer({});
    },
  });

  const { data: customerTags = [] } = useQuery({
    queryKey: ['customer-tags', id],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${id}/tags`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['all-tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const response = await fetch(`/api/customers/${id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
        body: JSON.stringify({ tag_id: tagId }),
      });
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-tags', id] }),
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const response = await fetch(`/api/customers/${id}/tags/${tagId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
      });
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-tags', id] }),
  });

  const availableTags = allTags.filter((t: any) => !customerTags.find((ct: any) => ct.id === t.id));

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const response = await fetch('/api/plans', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const changeSubscriptionMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch(`/api/customers/${id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
        body: JSON.stringify({ plan_id: planId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to change subscription');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/customers/${id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ content, author: 'Admin' }),
      });
      if (!response.ok) throw new Error('Failed to add note');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notes', id] });
      setNewNote('');
    },
  });

  const handleSave = () => {
    updateCustomerMutation.mutate(editedCustomer);
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      addNoteMutation.mutate(newNote);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return colors[status] || colors.inactive;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return colors[priority] || colors.low;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Customer not found</h2>
        <Button onClick={() => navigate('/customers')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Customers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/customers')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{customer.name}</h1>
            <p className="text-muted-foreground">{customer.email}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <Button onClick={handleSave} disabled={updateCustomerMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={() => {
                setIsEditing(false);
                setEditedCustomer({});
              }}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Customer Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className={getStatusColor(customer.status)}>
                  {customer.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="font-semibold capitalize">{customer.plan || customer.plan_name || 'Free'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Region</p>
                <p className="font-semibold">{customer.region}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Customer Since</p>
                <p className="font-semibold">
                  {format(new Date(customer.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="journey">Journey</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Subscription Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />Change Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground mr-2">Current: <strong className="text-foreground capitalize">{customer.plan || customer.plan_name || 'Free'}</strong></p>
                <Select onValueChange={(v) => changeSubscriptionMutation.mutate(v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Change plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan: any) => (
                      <SelectItem key={plan.plan_id} value={String(plan.plan_id)}>
                        {plan.name} — ${parseFloat(String(plan.price)).toFixed(2)}/{plan.billing_cycle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {changeSubscriptionMutation.isSuccess && (
                  <Badge className="bg-green-100 text-green-800">Updated!</Badge>
                )}
                {changeSubscriptionMutation.isError && (
                  <Badge className="bg-red-100 text-red-800">
                    {(changeSubscriptionMutation.error as Error)?.message || 'Failed'}
                  </Badge>
                )}
                {changeSubscriptionMutation.isPending && (
                  <span className="text-sm text-muted-foreground">Saving...</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Changing the subscription here grants the user all privileges of the selected plan immediately.</p>
            </CardContent>
          </Card>

          {/* Customer Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Tag className="w-5 h-5 mr-2" />Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                {customerTags.map((tag: any) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="pl-2.5 pr-1.5 py-1 text-sm cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ borderColor: tag.color, color: tag.color }}
                    onClick={() => removeTagMutation.mutate(tag.id)}
                  >
                    {tag.name}
                    <X className="w-3 h-3 ml-1.5 opacity-60" />
                  </Badge>
                ))}
                {availableTags.length > 0 && (
                  <Select onValueChange={(v) => addTagMutation.mutate(parseInt(v))}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <Plus className="w-3 h-3 mr-1" />
                      <SelectValue placeholder="Add tag" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTags.map((tag: any) => (
                        <SelectItem key={tag.id} value={String(tag.id)}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {customerTags.length === 0 && availableTags.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tags available</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={editedCustomer.name ?? customer.name}
                      onChange={(e) => setEditedCustomer({ ...editedCustomer, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      value={editedCustomer.email ?? customer.email}
                      onChange={(e) => setEditedCustomer({ ...editedCustomer, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Region</label>
                    <Input
                      value={editedCustomer.region ?? customer.region}
                      onChange={(e) => setEditedCustomer({ ...editedCustomer, region: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{customer.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Region</p>
                    <p className="font-medium">{customer.region}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created At</p>
                    <p className="font-medium">{format(new Date(customer.created_at), 'PPP')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Active</p>
                    <p className="font-medium">{(customer.last_active || customer.last_active_at) ? format(new Date(customer.last_active || customer.last_active_at!), 'PPP') : 'N/A'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journey" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Customer Journey
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {journey?.map((event, index) => (
                  <div key={index} className="flex items-start space-x-4 pb-4 border-b last:border-0">
                    <div className={`w-3 h-3 rounded-full mt-1 ${
                      event.status === 'completed' ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <div className="flex-1">
                      <p className="font-semibold">{event.event}</p>
                      <p className="text-sm text-muted-foreground">{event.details}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(event.timestamp), 'PPP p')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Support Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tickets?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No tickets found</p>
                ) : (
                  tickets?.map((ticket) => (
                    <div key={ticket.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{ticket.subject}</h4>
                        <div className="flex items-center space-x-2">
                          <Badge className={getPriorityColor(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                          <Badge variant="outline">{ticket.status}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Created: {format(new Date(ticket.created_at), 'PPP')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Customer Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={handleAddNote} disabled={!newNote.trim() || addNoteMutation.isPending}>
                    Add
                  </Button>
                </div>
                <div className="space-y-3">
                  {notes?.map((note) => (
                    <div key={note.id} className="p-4 bg-muted rounded-lg">
                      <p className="text-sm">{note.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">{note.author}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(note.created_at), 'PPP')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Communication History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {communications?.map((comm) => (
                  <div key={comm.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Mail className="w-5 h-5 text-blue-600 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{comm.subject}</p>
                        <Badge variant="outline">{comm.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {comm.type} • {format(new Date(comm.timestamp), 'PPP')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

