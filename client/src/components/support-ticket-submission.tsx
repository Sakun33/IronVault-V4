// Support Ticket Submission Component
// Allows users to submit encrypted support tickets
// Integrated into the main SecureVault app settings

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bug, 
  Send, 
  Upload, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Info,
  LifeBuoy,
  MessageSquare
} from 'lucide-react';
import { useAnalytics } from './analytics-integration';

interface SupportTicketSubmissionProps {
  trigger?: React.ReactNode;
  featureContext?: string;
  errorContext?: string;
}

export default function SupportTicketSubmission({ 
  trigger,
  featureContext = 'general',
  errorContext 
}: SupportTicketSubmissionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'bug',
    priority: 'medium',
    includeLogs: true,
    includeScreenshot: false
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { submitSupportTicket, isAnalyticsEnabled } = useAnalytics();

  const categories = [
    { value: 'bug', label: 'Bug Report', icon: Bug },
    { value: 'feature', label: 'Feature Request', icon: CheckCircle },
    { value: 'performance', label: 'Performance Issue', icon: AlertTriangle },
    { value: 'ui', label: 'UI/UX Issue', icon: XCircle },
    { value: 'other', label: 'Other', icon: Info }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: 'text-green-600' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
    { value: 'high', label: 'High', color: 'text-red-600' },
    { value: 'critical', label: 'Critical', color: 'text-red-800' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      // Collect logs if requested
      let logs = '';
      if (formData.includeLogs) {
        logs = await collectLogs();
      }

      // Collect screenshot if requested
      let screenshot = '';
      if (formData.includeScreenshot) {
        screenshot = await captureScreenshot();
      }

      // Submit ticket
      await submitSupportTicket({
        title: formData.title,
        description: formData.description,
        category: formData.category as any,
        priority: formData.priority as any,
        featureContext: `${featureContext} - ${formData.category}`,
        errorStack: errorContext,
        logs: logs,
        screenshot: screenshot
      });

      setSubmitStatus('success');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        category: 'bug',
        priority: 'medium',
        includeLogs: true,
        includeScreenshot: false
      });

      // Close modal after delay
      setTimeout(() => {
        setIsOpen(false);
        setSubmitStatus('idle');
      }, 2000);

    } catch (error) {
      console.error('Failed to submit ticket:', error);
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const collectLogs = async (): Promise<string> => {
    try {
      const logs = [];
      
      // Get recent console messages (if available)
      if (window.console && (window.console as any).getLogs) {
        logs.push('Console Logs:', (window.console as any).getLogs());
      }
      
      // Get localStorage info (non-sensitive)
      logs.push('LocalStorage Keys:', Object.keys(localStorage));
      
      // Get IndexedDB info
      if ('indexedDB' in window) {
        logs.push('IndexedDB Available: true');
      }
      
      // Get Web Crypto API info
      if ('crypto' in window && 'subtle' in window.crypto) {
        logs.push('Web Crypto API Available: true');
      }
      
      // Get app version info
      logs.push('App Version: 1.0.0');
      logs.push('Platform:', navigator.platform);
      logs.push('Language:', navigator.language);
      
      return logs.join('\n');
    } catch (error) {
      return `Error collecting logs: ${error}`;
    }
  };

  const captureScreenshot = async (): Promise<string> => {
    try {
      // Use html2canvas if available, otherwise return empty string
      if (typeof (window as any).html2canvas === 'function') {
        const canvas = await (window as any).html2canvas(document.body, {
          height: 600,
          width: 800,
          scale: 0.5
        });
        return canvas.toDataURL('image/png');
      }
      return '';
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return '';
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isAnalyticsEnabled) {
    return null; // Don't show if analytics not enabled
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full justify-start gap-2">
            <LifeBuoy className="w-4 h-4" />
            Report an Issue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5" />
            Report an Issue
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title">Issue Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Brief description of the issue"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Please describe the issue in detail. Include steps to reproduce if applicable."
              rows={4}
              required
            />
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-center gap-2">
                        <category.icon className="w-4 h-4" />
                        {category.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      <span className={priority.color}>{priority.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-3">
            <Label>Additional Information</Label>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="includeLogs"
                checked={formData.includeLogs}
                onCheckedChange={(checked) => handleInputChange('includeLogs', checked)}
              />
              <Label htmlFor="includeLogs" className="text-sm">
                Include system logs and technical information
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="includeScreenshot"
                checked={formData.includeScreenshot}
                onCheckedChange={(checked) => handleInputChange('includeScreenshot', checked)}
              />
              <Label htmlFor="includeScreenshot" className="text-sm">
                Include screenshot of current page
              </Label>
            </div>
          </div>

          {/* Context Information */}
          {featureContext && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This report will be associated with: <strong>{featureContext}</strong>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Context */}
          {errorContext && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Error context: <code className="text-xs bg-muted px-1 rounded">{errorContext}</code>
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Status */}
          {submitStatus === 'success' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Report submitted successfully! Thank you for your feedback.
              </AlertDescription>
            </Alert>
          )}

          {submitStatus === 'error' && (
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to submit report: {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.title || !formData.description}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Report
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Privacy Notice */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <p>
            <strong>Privacy Notice:</strong> All reports are encrypted locally before storage. 
            No personal information is collected. Only technical details and issue descriptions 
            are included to help us improve the app.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
