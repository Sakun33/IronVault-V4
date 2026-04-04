import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, X, AlertTriangle, Calendar, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { SubscriptionReminderService, SubscriptionReminder } from '@/lib/subscription-reminder-service';
import { SubscriptionEntry } from '@shared/schema';
import { format } from 'date-fns';

interface SubscriptionReminderComponentProps {
  subscriptions: SubscriptionEntry[];
  onReminderAction?: (reminder: SubscriptionReminder, action: 'dismiss' | 'read') => void;
}

export function SubscriptionReminderComponent({ 
  subscriptions, 
  onReminderAction 
}: SubscriptionReminderComponentProps) {
  const [reminders, setReminders] = useState<SubscriptionReminder[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming'>('active');
  
  const reminderService = SubscriptionReminderService.getInstance();

  useEffect(() => {
    // Generate reminders when subscriptions change
    const newReminders = reminderService.generateReminders(subscriptions);
    setReminders(newReminders);
  }, [subscriptions]);

  const activeReminders = reminderService.getActiveReminders();
  const upcomingReminders = reminderService.getUpcomingReminders();

  const handleDismiss = (reminderId: string) => {
    reminderService.dismissReminder(reminderId);
    setReminders([...reminderService.getActiveReminders(), ...reminderService.getUpcomingReminders()]);
    onReminderAction?.(reminders.find(r => r.id === reminderId)!, 'dismiss');
  };

  const handleMarkAsRead = (reminderId: string) => {
    reminderService.markAsRead(reminderId);
    setReminders([...reminderService.getActiveReminders(), ...reminderService.getUpcomingReminders()]);
    onReminderAction?.(reminders.find(r => r.id === reminderId)!, 'read');
  };

  const getReminderIcon = (type: SubscriptionReminder['type']) => {
    switch (type) {
      case 'renewal':
        return <Calendar className="w-4 h-4 text-primary" />;
      case 'expiry':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'price_change':
        return <DollarSign className="w-4 h-4 text-orange-600" />;
      case 'trial_end':
        return <Clock className="w-4 h-4 text-purple-600" />;
      case 'feature_change':
        return <Bell className="w-4 h-4 text-green-600" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getReminderBadgeColor = (type: SubscriptionReminder['type']) => {
    switch (type) {
      case 'renewal':
        return 'bg-primary/10 text-primary border-primary/30';
      case 'expiry':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'price_change':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'trial_end':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'feature_change':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const currentReminders = activeTab === 'active' ? activeReminders : upcomingReminders;

  if (reminders.length === 0) {
    return (
      <Card className="rounded-2xl shadow-sm border-0 bg-card">
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">All Caught Up!</h3>
          <p className="text-muted-foreground">No subscription reminders at this time.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm border-0 bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5 text-purple-600" />
            Reminders
          </CardTitle>
          <div className="flex gap-1 flex-shrink-0">
            <Button
              variant={activeTab === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('active')}
              className="text-xs h-7 px-2"
            >
              Active ({activeReminders.length})
            </Button>
            <Button
              variant={activeTab === 'upcoming' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('upcoming')}
              className="text-xs h-7 px-2"
            >
              Soon ({upcomingReminders.length})
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {currentReminders.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground">
              No {activeTab} reminders at this time.
            </p>
          </div>
        ) : (
          currentReminders.map((reminder) => (
            <div
              key={reminder.id}
              className={`p-3 rounded-xl border ${
                reminder.isRead 
                  ? 'bg-muted border-border' 
                  : 'bg-card border-border'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getReminderIcon(reminder.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-foreground text-sm">
                      {reminder.title}
                    </h4>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getReminderBadgeColor(reminder.type)}`}
                    >
                      {reminder.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2">
                    {reminder.message}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Due: {format(reminder.dueDate, 'MMM dd, yyyy')}
                    </span>
                    
                    <div className="flex gap-1">
                      {!reminder.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(reminder.id)}
                          className="text-xs h-6 px-2"
                        >
                          Mark Read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(reminder.id)}
                        className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default SubscriptionReminderComponent;
