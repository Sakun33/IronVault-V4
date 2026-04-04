import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Plus, Send, FileText, Clock, Trash2, Edit, Users, Eye } from 'lucide-react';
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

export default function EmailCenterPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '', category: 'general' });
  const [sendForm, setSendForm] = useState({ to_email: '', subject: '', body: '', template_id: '' });
  const [bulkForm, setBulkForm] = useState({ template_id: '', subject: '', body: '', target: 'all' });

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => fetchWithAuth('/api/email-templates'),
  });

  const { data: historyData } = useQuery({
    queryKey: ['email-history'],
    queryFn: () => fetchWithAuth('/api/email/history'),
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth('/api/email-templates', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setShowTemplateModal(false);
      setTemplateForm({ name: '', subject: '', body: '', category: 'general' });
      toast({ title: 'Template Created' });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth(`/api/email-templates/${data.id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setEditingTemplate(null);
      setShowTemplateModal(false);
      toast({ title: 'Template Updated' });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/email-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: 'Template Deleted' });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth('/api/email/send', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-history'] });
      setShowSendModal(false);
      setSendForm({ to_email: '', subject: '', body: '', template_id: '' });
      toast({ title: 'Email Sent', description: 'Email has been queued for delivery.' });
    },
  });

  const sendBulkMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth('/api/email/send-bulk', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['email-history'] });
      setShowBulkModal(false);
      setBulkForm({ template_id: '', subject: '', body: '', target: 'all' });
      toast({ title: 'Bulk Email Sent', description: `${data.sentCount} emails queued.` });
    },
  });

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      onboarding: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400',
      lifecycle: 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400',
      billing: 'bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400',
      security: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
      marketing: 'bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400',
      general: 'bg-gray-100 text-gray-800 dark:bg-gray-950/30 dark:text-gray-400',
    };
    return colors[category] || colors.general;
  };

  const openEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setTemplateForm({ name: template.name, subject: template.subject, body: template.body, category: template.category });
    setShowTemplateModal(true);
  };

  const handleUseTemplate = (template: any) => {
    setSendForm({ ...sendForm, subject: template.subject, body: template.body, template_id: String(template.id) });
    setShowSendModal(true);
  };

  const handleUseBulkTemplate = (template: any) => {
    setBulkForm({ ...bulkForm, subject: template.subject, body: template.body, template_id: String(template.id) });
    setShowBulkModal(true);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Center</h1>
          <p className="text-muted-foreground mt-1">Manage email templates and send communications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSendModal(true)}>
            <Send className="w-4 h-4 mr-2" />Send Email
          </Button>
          <Button variant="outline" onClick={() => setShowBulkModal(true)}>
            <Users className="w-4 h-4 mr-2" />Bulk Send
          </Button>
          <Button onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', subject: '', body: '', category: 'general' }); setShowTemplateModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />New Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates" className="flex items-center gap-2"><FileText className="h-4 w-4" />Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2"><Clock className="h-4 w-4" />Send History ({historyData?.total || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template: any) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1 truncate">{template.subject}</p>
                    </div>
                    <Badge className={getCategoryColor(template.category)}>{template.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{template.body}</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPreviewTemplate(template)}>
                      <Eye className="w-3 h-3 mr-1" />Preview
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEditTemplate(template)}>
                      <Edit className="w-3 h-3 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleUseTemplate(template)}>
                      <Send className="w-3 h-3 mr-1" />Send
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleUseBulkTemplate(template)}>
                      <Users className="w-3 h-3 mr-1" />Bulk
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => deleteTemplateMutation.mutate(template.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>To</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData?.emails?.map((email: any) => (
                    <TableRow key={email.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{email.to_email}</p>
                          {email.customer_name && <p className="text-xs text-muted-foreground">{email.customer_name}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{email.subject}</TableCell>
                      <TableCell>{email.template_name || '-'}</TableCell>
                      <TableCell><Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400">{email.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{email.sent_at ? format(new Date(email.sent_at), 'MMM d, yyyy HH:mm') : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {(!historyData?.emails || historyData.emails.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No emails sent yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Template Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Email Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input value={templateForm.name} onChange={(e) => setTemplateForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Welcome Email" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={templateForm.category} onValueChange={(v) => setTemplateForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="lifecycle">Lifecycle</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input value={templateForm.subject} onChange={(e) => setTemplateForm(p => ({ ...p, subject: e.target.value }))} placeholder="Email subject" />
            </div>
            <div className="space-y-2">
              <Label>Body (supports {'{{name}}'}, {'{{amount}}'}, {'{{plan}}'} variables)</Label>
              <Textarea value={templateForm.body} onChange={(e) => setTemplateForm(p => ({ ...p, body: e.target.value }))} rows={10} placeholder="Email body..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
              <Button onClick={() => editingTemplate ? updateTemplateMutation.mutate({ ...templateForm, id: editingTemplate.id }) : createTemplateMutation.mutate(templateForm)}
                disabled={!templateForm.name || !templateForm.subject || !templateForm.body}>
                {editingTemplate ? 'Update' : 'Create'} Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Single Email Modal */}
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Email</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>To Email</Label>
              <Input value={sendForm.to_email} onChange={(e) => setSendForm(p => ({ ...p, to_email: e.target.value }))} placeholder="customer@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={sendForm.subject} onChange={(e) => setSendForm(p => ({ ...p, subject: e.target.value }))} placeholder="Email subject" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={sendForm.body} onChange={(e) => setSendForm(p => ({ ...p, body: e.target.value }))} rows={8} placeholder="Email body..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSendModal(false)}>Cancel</Button>
              <Button onClick={() => sendEmailMutation.mutate(sendForm)} disabled={!sendForm.to_email || !sendForm.subject || sendEmailMutation.isPending}>
                <Send className="w-4 h-4 mr-2" />Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Send Modal */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Email</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select value={bulkForm.target} onValueChange={(v) => setBulkForm(p => ({ ...p, target: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Active Customers</SelectItem>
                  <SelectItem value="free">Free Plan</SelectItem>
                  <SelectItem value="pro">Pro Plan</SelectItem>
                  <SelectItem value="lifetime">Lifetime Plan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={bulkForm.subject} onChange={(e) => setBulkForm(p => ({ ...p, subject: e.target.value }))} placeholder="Email subject" />
            </div>
            <div className="space-y-2">
              <Label>Body (use {'{{name}}'} for personalization)</Label>
              <Textarea value={bulkForm.body} onChange={(e) => setBulkForm(p => ({ ...p, body: e.target.value }))} rows={8} placeholder="Email body..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBulkModal(false)}>Cancel</Button>
              <Button onClick={() => sendBulkMutation.mutate(bulkForm)} disabled={!bulkForm.subject || !bulkForm.body || sendBulkMutation.isPending}>
                <Users className="w-4 h-4 mr-2" />Send to All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Template Preview: {previewTemplate?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Subject:</p>
              <p className="font-medium">{previewTemplate?.subject}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Body:</p>
              <pre className="whitespace-pre-wrap text-sm font-sans">{previewTemplate?.body}</pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
