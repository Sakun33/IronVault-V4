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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, Shield, Clock, Plus, Key } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '../contexts/AuthContext';

interface Admin {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

interface AdminLog {
  log_id: number;
  admin_id: number;
  username: string;
  action: string;
  resource?: string;
  resource_id?: number;
  details?: any;
  ip_address?: string;
  created_at: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [adminFormData, setAdminFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'admin'
  });

  const isSuperAdmin = user?.role === 'super_admin';

  const { data: admins, isLoading: adminsLoading } = useQuery<Admin[]>({
    queryKey: ['admins'],
    queryFn: async () => {
      const response = await fetch('/api/admins', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch admins');
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: async () => {
      const response = await fetch('/api/admin-logs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.json();
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: async (data: typeof adminFormData) => {
      const response = await fetch('/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create admin');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setShowCreateAdminModal(false);
      resetAdminForm();
      toast({
        title: "Admin created",
        description: "The admin user has been created successfully.",
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

  const resetAdminForm = () => {
    setAdminFormData({
      username: '',
      email: '',
      password: '',
      role: 'admin'
    });
  };

  const handleCreateAdmin = () => {
    if (!adminFormData.username || !adminFormData.email || !adminFormData.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    if (adminFormData.password.length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }
    createAdminMutation.mutate(adminFormData);
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      super_admin: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      support: 'bg-green-100 text-green-800',
      analyst: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[role as keyof typeof colors] || colors.admin}>
        {role}
      </Badge>
    );
  };

  const logs = logsData?.logs || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage system settings and administration</p>
        </div>
      </div>

      <Tabs defaultValue="admins" className="space-y-6">
        <TabsList>
          <TabsTrigger value="admins">
            <Users className="h-4 w-4 mr-2" />
            Admin Users
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Clock className="h-4 w-4 mr-2" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="system">
            <Settings className="h-4 w-4 mr-2" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Admin Users Tab */}
        <TabsContent value="admins" className="space-y-6">
          {!isSuperAdmin ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Only super admins can manage admin users.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-end">
                <Dialog open={showCreateAdminModal} onOpenChange={setShowCreateAdminModal}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Admin
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Admin User</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username *</Label>
                        <Input
                          id="username"
                          placeholder="e.g., john.doe"
                          value={adminFormData.username}
                          onChange={(e) => setAdminFormData(prev => ({ ...prev, username: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="e.g., john@example.com"
                          value={adminFormData.email}
                          onChange={(e) => setAdminFormData(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Min. 8 characters"
                          value={adminFormData.password}
                          onChange={(e) => setAdminFormData(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="role">Role *</Label>
                        <Select 
                          value={adminFormData.role} 
                          onValueChange={(value) => setAdminFormData(prev => ({ ...prev, role: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="support">Support</SelectItem>
                            <SelectItem value="analyst">Analyst</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setShowCreateAdminModal(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleCreateAdmin}
                          disabled={createAdminMutation.isPending}
                        >
                          Create Admin
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Admin Users</CardTitle>
                </CardHeader>
                <CardContent>
                  {adminsLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Login</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {admins?.map((admin) => (
                          <TableRow key={admin.id}>
                            <TableCell className="font-medium">{admin.username}</TableCell>
                            <TableCell>{admin.email}</TableCell>
                            <TableCell>{getRoleBadge(admin.role)}</TableCell>
                            <TableCell>
                              <Badge variant={admin.is_active ? "default" : "secondary"}>
                                {admin.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {admin.last_login 
                                ? new Date(admin.last_login).toLocaleString()
                                : 'Never'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log: AdminLog) => (
                    <div key={log.log_id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50">
                      <div className="flex-shrink-0">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.username}</span>
                          <span className="text-sm text-muted-foreground">{log.action}</span>
                          {log.resource && (
                            <>
                              <span className="text-sm text-muted-foreground">on</span>
                              <Badge variant="outline">{log.resource}</Badge>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                          {log.ip_address && ` • IP: ${log.ip_address}`}
                        </div>
                      </div>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No activity logs found.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>JWT Secret</Label>
                <div className="flex gap-2">
                  <Input type="password" value="••••••••••••••••" readOnly />
                  <Button variant="outline">
                    <Key className="h-4 w-4 mr-2" />
                    Rotate
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  JWT secret is configured via environment variables. Rotating will invalidate all existing sessions.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Rate Limiting</Label>
                <div className="flex gap-2">
                  <Input type="number" defaultValue="100" className="w-32" />
                  <span className="text-sm text-muted-foreground self-center">requests per 15 minutes</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Session Timeout</Label>
                <div className="flex gap-2">
                  <Input type="number" defaultValue="24" className="w-32" />
                  <span className="text-sm text-muted-foreground self-center">hours</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Version</Label>
                  <div className="font-medium">v4.0.0-beta.1</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Environment</Label>
                  <div className="font-medium">{process.env.NODE_ENV || 'development'}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Database</Label>
                  <div className="font-medium">PostgreSQL</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">API Status</Label>
                  <Badge variant="default">Online</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input defaultValue="smtp.gmail.com" />
              </div>
              <div className="space-y-2">
                <Label>From Address</Label>
                <Input defaultValue="subsafeironvault@gmail.com" />
              </div>
              <Button variant="outline">Test Connection</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

