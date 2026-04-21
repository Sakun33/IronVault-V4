import { useState, useMemo, useEffect } from 'react';
import { useVault } from '@/contexts/vault-context';
import { scheduleReminderNotification, requestNotificationPermission, checkNotificationPermission } from '@/native/notifications';
import { ReminderEntry, REMINDER_CATEGORIES, REMINDER_COLORS } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandCard } from '@/components/brand-card';
import { Favicon } from '@/components/favicon';

const priorityBrandColor = (priority: string) => {
  if (priority === 'urgent') return '#ef4444';
  if (priority === 'high') return '#f97316';
  if (priority === 'medium') return '#eab308';
  return '#22c55e';
};
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Calendar, 
  Clock, 
  Bell, 
  Tag,
  Filter,
  CheckCircle2,
  Circle,
  AlertCircle,
  CalendarDays,
  Grid,
  List,
  Palette,
  BellRing,
  Repeat,
  ChevronRight
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, isThisWeek, startOfDay, addDays, addWeeks, addMonths } from 'date-fns';

export default function Reminders() {
  const { reminders, addReminder, updateReminder, deleteReminder, subscriptions } = useVault();
  const subscriptionUrlMap = useMemo(() =>
    Object.fromEntries((subscriptions || []).map(s => [s.id, s.platformLink || undefined])),
    [subscriptions]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderEntry | null>(null);
  const [deleteReminderTarget, setDeleteReminderTarget] = useState<ReminderEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Form state for add/edit modal
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    dueTime: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category: 'Personal',
    isCompleted: false,
    isRecurring: false,
    recurringFrequency: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    tags: [] as string[],
    color: '#6366f1',
    notificationEnabled: true,
    alarmEnabled: false,
    alarmTime: '',
    alertMinutesBefore: 15,
    preAlertEnabled: false,
    subscriptionId: '',
  });
  
  const [newTag, setNewTag] = useState('');

  // Get all unique tags from reminders
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    reminders.forEach(reminder => {
      reminder.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [reminders]);

  // Filter reminders based on various criteria
  const filteredReminders = useMemo(() => {
    return reminders.filter(reminder => {
      // Search filter
      const matchesSearch = !searchQuery || 
        reminder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reminder.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reminder.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reminder.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category filter
      const matchesCategory = selectedCategory === 'all' || reminder.category === selectedCategory;
      
      // Priority filter
      const matchesPriority = selectedPriority === 'all' || reminder.priority === selectedPriority;
      
      // Tag filter
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => reminder.tags.includes(tag));

      // Completed filter
      const matchesCompleted = !showCompletedOnly || reminder.isCompleted;

      // Overdue filter
      const matchesOverdue = !showOverdueOnly || (isPast(new Date(reminder.dueDate)) && !reminder.isCompleted);

      // Date filter
      let matchesDate = true;
      const reminderDate = new Date(reminder.dueDate);
      const now = new Date();

      switch (dateFilter) {
        case 'today':
          matchesDate = isToday(reminderDate);
          break;
        case 'week':
          matchesDate = isThisWeek(reminderDate);
          break;
        case 'month':
          matchesDate = reminderDate.getMonth() === now.getMonth() && 
                       reminderDate.getFullYear() === now.getFullYear();
          break;
        case 'all':
        default:
          matchesDate = true;
          break;
      }

      return matchesSearch && matchesCategory && matchesPriority && matchesTags && matchesCompleted && matchesOverdue && matchesDate;
    });
  }, [reminders, searchQuery, selectedCategory, selectedPriority, selectedTags, showCompletedOnly, showOverdueOnly, dateFilter]);

  // Sort reminders by due date and priority
  const sortedReminders = useMemo(() => {
    return [...filteredReminders].sort((a, b) => {
      // First, sort by completion status (incomplete first)
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      
      // Then by due date
      const dateComparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (dateComparison !== 0) {
        return dateComparison;
      }
      
      // Finally by priority
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [filteredReminders]);

  // Group reminders by date for calendar view
  const groupedReminders = useMemo(() => {
    const groups: { [key: string]: ReminderEntry[] } = {};
    
    sortedReminders.forEach(reminder => {
      const dateKey = format(new Date(reminder.dueDate), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(reminder);
    });
    
    return groups;
  }, [sortedReminders]);

  // Get stats for the current view
  const viewStats = useMemo(() => {
    const today = startOfDay(new Date());
    
    return {
      total: filteredReminders.length,
      completed: filteredReminders.filter(r => r.isCompleted).length,
      overdue: filteredReminders.filter(r => isPast(new Date(r.dueDate)) && !r.isCompleted).length,
      dueToday: filteredReminders.filter(r => isToday(new Date(r.dueDate)) && !r.isCompleted).length,
      dueTomorrow: filteredReminders.filter(r => isTomorrow(new Date(r.dueDate)) && !r.isCompleted).length,
      thisWeek: filteredReminders.filter(r => isThisWeek(new Date(r.dueDate)) && !r.isCompleted).length,
    };
  }, [filteredReminders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const reminderData = {
        title: formData.title,
        description: formData.description || undefined,
        dueDate: new Date(formData.dueDate + (formData.dueTime ? `T${formData.dueTime}` : 'T09:00')),
        dueTime: formData.dueTime || undefined,
        priority: formData.priority,
        category: formData.category,
        isCompleted: formData.isCompleted,
        isRecurring: formData.isRecurring,
        recurringFrequency: formData.isRecurring ? formData.recurringFrequency : undefined,
        nextReminderDate: formData.isRecurring ? calculateNextReminderDate(new Date(formData.dueDate), formData.recurringFrequency) : undefined,
        tags: formData.tags,
        color: formData.color,
        notificationEnabled: formData.notificationEnabled,
        alarmEnabled: formData.alarmEnabled,
        alarmTime: formData.alarmEnabled ? formData.alarmTime : undefined,
        alertMinutesBefore: formData.alertMinutesBefore,
        preAlertEnabled: formData.preAlertEnabled,
        subscriptionId: formData.subscriptionId || undefined,
      };

      if (editingReminder) {
        await updateReminder(editingReminder.id, reminderData);
        
        // Schedule native notification if enabled
        if (reminderData.notificationEnabled) {
          const notificationId = parseInt(editingReminder.id.replace(/\D/g, '').slice(0, 8)) || Math.floor(Math.random() * 1000000);
          await scheduleReminderNotification(
            notificationId,
            reminderData.title,
            reminderData.description || `Reminder due: ${format(reminderData.dueDate, 'MMM dd, HH:mm')}`,
            reminderData.dueDate
          );
        }
        
        toast({
          title: "Reminder updated",
          description: "Your reminder has been updated successfully.",
        });
      } else {
        const newReminder = await addReminder(reminderData);
        
        // Schedule native notification if enabled
        if (reminderData.notificationEnabled && newReminder) {
          const notificationId = parseInt((newReminder as any).id?.replace(/\D/g, '').slice(0, 8)) || Math.floor(Math.random() * 1000000);
          await scheduleReminderNotification(
            notificationId,
            reminderData.title,
            reminderData.description || `Reminder due: ${format(reminderData.dueDate, 'MMM dd, HH:mm')}`,
            reminderData.dueDate
          );
        }
        
        toast({
          title: "Reminder created",
          description: "Your reminder has been created with a phone notification.",
        });
      }

      resetForm();
      setShowAddModal(false);
      setEditingReminder(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save reminder. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      dueTime: '',
      priority: 'medium',
      category: 'Personal',
      isCompleted: false,
      isRecurring: false,
      recurringFrequency: 'weekly',
      tags: [],
      color: '#6366f1',
      notificationEnabled: true,
      alarmEnabled: false,
      alarmTime: '',
      alertMinutesBefore: 15,
      preAlertEnabled: false,
      subscriptionId: '',
    });
    setNewTag('');
  };

  const calculateNextReminderDate = (currentDate: Date, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'): Date => {
    const nextDate = new Date(currentDate);
    switch (frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    return nextDate;
  };

  const handleEdit = (reminder: ReminderEntry) => {
    setEditingReminder(reminder);
    setFormData({
      title: reminder.title,
      description: reminder.description || '',
      dueDate: format(new Date(reminder.dueDate), 'yyyy-MM-dd'),
      dueTime: reminder.dueTime || '',
      priority: reminder.priority,
      category: reminder.category,
      isCompleted: reminder.isCompleted,
      isRecurring: reminder.isRecurring,
      recurringFrequency: reminder.recurringFrequency || 'weekly',
      tags: [...reminder.tags],
      color: reminder.color,
      notificationEnabled: reminder.notificationEnabled,
      alarmEnabled: (reminder as any).alarmEnabled || false,
      alarmTime: (reminder as any).alarmTime || '',
      alertMinutesBefore: (reminder as any).alertMinutesBefore || 15,
      preAlertEnabled: (reminder as any).preAlertEnabled || false,
      subscriptionId: reminder.subscriptionId || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = (reminder: ReminderEntry) => {
    setDeleteReminderTarget(reminder);
  };

  const handleDeleteReminderConfirmed = async () => {
    if (!deleteReminderTarget) return;
    const target = deleteReminderTarget;
    setDeleteReminderTarget(null);
    try {
      await deleteReminder(target.id);
      toast({
        title: "Reminder deleted",
        description: "Your reminder has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete reminder. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleComplete = async (reminder: ReminderEntry) => {
    try {
      await updateReminder(reminder.id, { 
        isCompleted: !reminder.isCompleted,
        completedAt: !reminder.isCompleted ? new Date() : undefined,
      });
      
      if (!reminder.isCompleted) {
        toast({
          title: "Reminder completed",
          description: `"${reminder.title}" has been marked as completed.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update reminder. Please try again.",
        variant: "destructive",
      });
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return 'Overdue';
    return format(date, 'MMM dd, yyyy');
  };

  const renderReminderCard = (reminder: ReminderEntry) => (
    <BrandCard key={reminder.id} name={reminder.category || reminder.title} brandColor={priorityBrandColor(reminder.priority)} className={reminder.isCompleted ? 'opacity-60' : ''} data-testid={`card-reminder-${reminder.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto hover:bg-transparent"
              onClick={() => toggleComplete(reminder)}
              data-testid={`button-complete-${reminder.id}`}
            >
              {reminder.isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
            
            <Favicon
              url={reminder.subscriptionId ? subscriptionUrlMap[reminder.subscriptionId] : undefined}
              name={reminder.category || reminder.title}
              className="w-8 h-8 flex-shrink-0 rounded-lg"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className={`font-medium ${reminder.isCompleted ? 'line-through text-muted-foreground' : ''}`} data-testid={`text-title-${reminder.id}`}>
                  {reminder.title}
                </h3>
                <Badge variant="outline" className={getPriorityColor(reminder.priority)} data-testid={`badge-priority-${reminder.id}`}>
                  {reminder.priority}
                </Badge>
                {isPast(new Date(reminder.dueDate)) && !reminder.isCompleted && (
                  <Badge variant="destructive" data-testid={`badge-overdue-${reminder.id}`}>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Overdue
                  </Badge>
                )}
              </div>
              
              {reminder.description && (
                <p className="text-sm text-muted-foreground mb-2" data-testid={`text-description-${reminder.id}`}>
                  {reminder.description}
                </p>
              )}
              
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span data-testid={`text-date-${reminder.id}`}>{getDateLabel(new Date(reminder.dueDate))}</span>
                </div>
                
                {reminder.dueTime && (
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span data-testid={`text-time-${reminder.id}`}>{reminder.dueTime}</span>
                  </div>
                )}
                
                <Badge variant="outline" data-testid={`badge-category-${reminder.id}`}>{reminder.category}</Badge>
                
                {reminder.isRecurring && (
                  <div className="flex items-center space-x-1">
                    <Repeat className="h-4 w-4" />
                    <span>Recurring</span>
                  </div>
                )}
                
                {reminder.notificationEnabled && (
                  <Bell className="h-4 w-4" />
                )}
              </div>
              
              {reminder.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {reminder.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs" data-testid={`badge-tag-${tag}-${reminder.id}`}>
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-1 ml-2">
            <div 
              className="w-3 h-3 rounded-full border border-gray-300"
              style={{ backgroundColor: reminder.color }}
              data-testid={`color-indicator-${reminder.id}`}
            />
            <Button variant="ghost" size="sm" onClick={() => handleEdit(reminder)} data-testid={`button-edit-${reminder.id}`}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(reminder)} data-testid={`button-delete-${reminder.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </BrandCard>
  );

  return (
    <div className="space-y-5 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Reminders</h1>
              <Badge variant="secondary" className="rounded-full text-xs font-semibold">{reminders.length}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">Tasks &amp; deadlines</p>
          </div>
        </div>

        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={resetForm} data-testid="button-add-reminder" className="rounded-xl flex-shrink-0">
              <Plus className="h-4 w-4 mr-1.5" />New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingReminder ? 'Edit Reminder' : 'Add New Reminder'}</DialogTitle>
            </DialogHeader>
            <form id="reminder-form" onSubmit={handleSubmit} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit(e as any); } }} className="flex flex-col flex-1 min-h-0">
              <DialogBody>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      const lower = title.toLowerCase();
                      let priority = formData.priority;
                      if (/urgent|asap|critical|emergency/.test(lower)) priority = 'urgent';
                      else if (/important|deadline|submit|exam|due/.test(lower)) priority = 'high';
                      setFormData(prev => ({ ...prev, title, priority }));
                    }}
                    placeholder="Enter reminder title"
                    required
                    data-testid="input-title"
                  />
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter reminder description (optional)"
                    rows={3}
                    data-testid="input-description"
                  />
                </div>
                
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    required
                    data-testid="input-due-date"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { label: 'Today', date: new Date() },
                      { label: 'Tomorrow', date: addDays(new Date(), 1) },
                      { label: 'Next Week', date: addWeeks(new Date(), 1) },
                      { label: 'Next Month', date: addMonths(new Date(), 1) },
                    ].map(({ label, date }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, dueDate: format(date, 'yyyy-MM-dd') }))}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${formData.dueDate === format(date, 'yyyy-MM-dd') ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 bg-muted/40 hover:bg-muted text-foreground'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="dueTime">Due Time (Optional)</Label>
                  <Input
                    id="dueTime"
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueTime: e.target.value }))}
                    data-testid="input-due-time"
                  />
                  <div className="flex gap-1.5">
                    {[
                      { label: '9 AM', value: '09:00' },
                      { label: '12 PM', value: '12:00' },
                      { label: '2 PM', value: '14:00' },
                      { label: '6 PM', value: '18:00' },
                    ].map(({ label, value }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, dueTime: value }))}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${formData.dueTime === value ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 bg-muted/40 hover:bg-muted text-foreground'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REMINDER_CATEGORIES.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="color">Color</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    {REMINDER_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`w-6 h-6 rounded-full border-2 ${formData.color === color ? 'border-gray-800 dark:border-gray-200' : 'border-gray-300'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                        data-testid={`color-option-${color}`}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="col-span-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isRecurring"
                      checked={formData.isRecurring}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRecurring: !!checked }))}
                      data-testid="checkbox-recurring"
                      className="h-4 w-4"
                    />
                    <Label htmlFor="isRecurring">Recurring reminder</Label>
                  </div>
                </div>
                
                {formData.isRecurring && (
                  <div>
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select value={formData.recurringFrequency} onValueChange={(value: any) => setFormData(prev => ({ ...prev, recurringFrequency: value }))}>
                      <SelectTrigger data-testid="select-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="col-span-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="notificationEnabled"
                      checked={formData.notificationEnabled}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, notificationEnabled: !!checked }))}
                      data-testid="checkbox-notifications"
                      className="h-4 w-4"
                    />
                    <Label htmlFor="notificationEnabled">Enable notifications</Label>
                  </div>
                </div>

                {/* Alarm & Pre-Alert Section */}
                <div className="col-span-2 space-y-3 p-3 bg-primary/10 rounded-lg border border-primary/30">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="alarmEnabled"
                      checked={formData.alarmEnabled}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, alarmEnabled: !!checked }))}
                      data-testid="checkbox-alarm"
                      className="h-4 w-4"
                    />
                    <Label htmlFor="alarmEnabled" className="flex items-center gap-2">
                      <BellRing className="w-4 h-4" />
                      Enable Alarm
                    </Label>
                  </div>

                  {formData.alarmEnabled && (
                    <div className="grid grid-cols-2 gap-3 ml-6">
                      <div>
                        <Label htmlFor="alarmTime" className="text-xs">Alarm Time</Label>
                        <Input
                          id="alarmTime"
                          type="time"
                          value={formData.alarmTime}
                          onChange={(e) => setFormData(prev => ({ ...prev, alarmTime: e.target.value }))}
                          data-testid="input-alarm-time"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="alertMinutes" className="text-xs">Alert Minutes Before</Label>
                        <Select 
                          value={formData.alertMinutesBefore.toString()} 
                          onValueChange={(value) => setFormData(prev => ({ ...prev, alertMinutesBefore: parseInt(value) }))}
                        >
                          <SelectTrigger data-testid="select-alert-minutes" className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 minutes</SelectItem>
                            <SelectItem value="10">10 minutes</SelectItem>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="60">1 hour</SelectItem>
                            <SelectItem value="120">2 hours</SelectItem>
                            <SelectItem value="1440">1 day</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="preAlertEnabled"
                      checked={formData.preAlertEnabled}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, preAlertEnabled: !!checked }))}
                      data-testid="checkbox-pre-alert"
                      className="h-4 w-4"
                    />
                    <Label htmlFor="preAlertEnabled" className="text-sm">
                      Send pre-alert notification
                    </Label>
                  </div>
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="tags">Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs" data-testid={`form-tag-${tag}`}>
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add a tag"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      data-testid="input-new-tag"
                    />
                    <Button type="button" onClick={addTag} size="sm" data-testid="button-add-tag">
                      Add
                    </Button>
                  </div>
                </div>
              </div>
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowAddModal(false); setEditingReminder(null); resetForm(); }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                {!editingReminder && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const form = document.querySelector<HTMLFormElement>('form[data-reminder-form]');
                      if (!formData.title.trim()) return;
                      try {
                        const reminderData = {
                          title: formData.title, description: formData.description || undefined,
                          dueDate: new Date(formData.dueDate + (formData.dueTime ? `T${formData.dueTime}` : 'T09:00')),
                          dueTime: formData.dueTime || undefined, priority: formData.priority,
                          category: formData.category, isCompleted: false, isRecurring: formData.isRecurring,
                          recurringFrequency: formData.isRecurring ? formData.recurringFrequency : undefined,
                          tags: formData.tags, color: formData.color,
                          notificationEnabled: formData.notificationEnabled,
                          alarmEnabled: formData.alarmEnabled,
                          alarmTime: formData.alarmEnabled ? formData.alarmTime : undefined,
                          alertMinutesBefore: formData.alertMinutesBefore,
                          preAlertEnabled: formData.preAlertEnabled,
                        };
                        await addReminder(reminderData);
                        toast({ title: "Saved", description: "Reminder created. Add another?" });
                        resetForm();
                      } catch { toast({ title: "Error", description: "Failed to save", variant: "destructive" }); }
                    }}
                    className="text-xs"
                  >
                    Save & Add Another
                  </Button>
                )}
                <Button type="submit" data-testid="button-save">
                  {editingReminder ? 'Update' : 'Create'} Reminder
                </Button>
                <p className="w-full text-right text-xs text-muted-foreground mt-1">⌘↵ to save</p>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card data-testid="card-stat-total">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold" data-testid="stat-total">{viewStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-stat-completed">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-completed">{viewStats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-stat-overdue">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-destructive" data-testid="stat-overdue">{viewStats.overdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-stat-today">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Due Today</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="stat-today">{viewStats.dueToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-stat-tomorrow">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ChevronRight className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Tomorrow</p>
                <p className="text-2xl font-bold text-primary" data-testid="stat-tomorrow">{viewStats.dueTomorrow}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-stat-week">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold text-primary" data-testid="stat-week">{viewStats.thisWeek}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {[
          { label: `All (${reminders.length})`, key: 'all' },
          { label: `Today (${viewStats.dueToday})`, key: 'today' },
          { label: `This Week (${viewStats.thisWeek})`, key: 'week' },
          { label: `Overdue (${viewStats.overdue})`, key: 'overdue' },
          { label: `Done (${viewStats.completed})`, key: 'done' },
        ].map(({ label, key }) => {
          const isActive = key === 'overdue' ? showOverdueOnly
            : key === 'done' ? showCompletedOnly
            : dateFilter === key;
          const activeColor = key === 'overdue' ? 'bg-red-500 border-red-500 text-white'
            : key === 'done' ? 'bg-green-500 border-green-500 text-white'
            : 'bg-purple-500 border-purple-500 text-white';
          return (
            <button
              key={key}
              onClick={() => {
                if (key === 'overdue') { setShowOverdueOnly(!showOverdueOnly); setShowCompletedOnly(false); setDateFilter('all'); }
                else if (key === 'done') { setShowCompletedOnly(!showCompletedOnly); setShowOverdueOnly(false); setDateFilter('all'); }
                else { setDateFilter(key as any); setShowOverdueOnly(false); setShowCompletedOnly(false); }
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive ? activeColor : 'bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reminders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>
            
            <div>
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-filter-category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {REMINDER_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Priority</Label>
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger data-testid="select-filter-priority">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Date Range</Label>
              <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                <SelectTrigger data-testid="select-filter-date">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showCompleted"
                checked={showCompletedOnly}
                onCheckedChange={(checked) => setShowCompletedOnly(!!checked)}
                data-testid="checkbox-filter-completed"
                className="h-4 w-4"
              />
              <Label htmlFor="showCompleted" className="text-sm">Show completed only</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showOverdue"
                checked={showOverdueOnly}
                onCheckedChange={(checked) => setShowOverdueOnly(!!checked)}
                data-testid="checkbox-filter-overdue"
                className="h-4 w-4"
              />
              <Label htmlFor="showOverdue" className="text-sm">Show overdue only</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4 mr-1" />
                List
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                data-testid="button-view-calendar"
              >
                <Grid className="h-4 w-4 mr-1" />
                Calendar
              </Button>
            </div>
            
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <Label className="text-sm text-muted-foreground">Tags:</Label>
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      setSelectedTags(prev => 
                        prev.includes(tag) 
                          ? prev.filter(t => t !== tag)
                          : [...prev, tag]
                      );
                    }}
                    data-testid={`filter-tag-${tag}`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reminders Display */}
      {sortedReminders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No reminders found</h3>
            <p className="text-muted-foreground mb-4">
              {reminders.length === 0 
                ? "Get started by creating your first reminder."
                : "Try adjusting your filters to see more reminders."
              }
            </p>
            <Button onClick={() => setShowAddModal(true)} data-testid="button-create-first">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Reminder
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {viewMode === 'list' ? (
            <div className="space-y-3 stagger-children">
              {sortedReminders.map(renderReminderCard)}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedReminders)
                .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                .map(([dateKey, dateReminders]) => (
                  <div key={dateKey}>
                    <h3 className="text-lg font-medium mb-3 flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {getDateLabel(new Date(dateKey))}
                      <Badge variant="outline" className="ml-2">{dateReminders.length}</Badge>
                    </h3>
                    <div className="grid gap-3">
                      {dateReminders.map(renderReminderCard)}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!deleteReminderTarget} onOpenChange={(open) => { if (!open) setDeleteReminderTarget(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-delete-reminder">
          <DialogHeader><DialogTitle>Delete Reminder</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete &ldquo;{deleteReminderTarget?.title}&rdquo;? This cannot be undone.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteReminderTarget(null)}>Cancel</Button>
            <Button variant="destructive" data-testid="button-confirm-delete-reminder" onClick={handleDeleteReminderConfirmed}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}