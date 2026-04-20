import React, { useState, useEffect, useCallback } from 'react';
import { MobileDialog } from '@/components/mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Wand2 } from 'lucide-react';
import { PASSWORD_CATEGORIES } from '@shared/schema';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { PasswordStrengthMeter } from '@/components/ui/password-strength-meter';
import { PasswordGeneratorModal } from './password-generator-modal';
import { PasswordGenerator } from '@/lib/password-generator';
import { useFormDefaults } from '@/hooks/use-form-defaults';
import { POPULAR_PASSWORD_SERVICES, detectCategoryFromUrl } from '@/lib/popular-services';

interface AddPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPassword?: any;
}

function generateDefaultPassword() {
  return PasswordGenerator.generate({
    length: 20,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: false,
  });
}

const blankForm = () => ({
  name: '',
  url: '',
  username: '',
  password: '',
  category: '',
  notes: '',
});

export function AddPasswordModal({ open, onOpenChange, editingPassword }: AddPasswordModalProps) {
  const { addPassword, updatePassword } = useVault();
  const { toast } = useToast();
  const { lastUsername, saveUsername } = useFormDefaults();

  const [formData, setFormData] = useState(blankForm());
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingPassword) {
        setFormData({
          name: editingPassword.name || '',
          url: editingPassword.url || '',
          username: editingPassword.username || '',
          password: editingPassword.password || (!editingPassword.id ? generateDefaultPassword() : ''),
          category: editingPassword.category || '',
          notes: editingPassword.notes || '',
        });
      } else {
        setFormData({
          ...blankForm(),
          username: lastUsername,
          password: generateDefaultPassword(),
        });
      }
    }
  }, [open, editingPassword]);

  // Auto-detect category from URL
  const handleUrlChange = useCallback((url: string) => {
    setFormData(prev => {
      const detected = detectCategoryFromUrl(url);
      return {
        ...prev,
        url,
        category: detected && !prev.category ? detected : prev.category,
      };
    });
  }, []);

  const doSave = async (): Promise<boolean> => {
    if (!formData.name || !formData.username || !formData.password) {
      toast({ title: "Error", description: "Name, username, and password are required", variant: "destructive" });
      return false;
    }
    setIsSubmitting(true);
    try {
      if (editingPassword?.id) {
        await updatePassword(editingPassword.id, formData);
        toast({ title: "Updated", description: "Password updated successfully" });
      } else {
        await addPassword(formData);
        saveUsername(formData.username);
        toast({ title: "Saved", description: "Password saved successfully" });
      }
      return true;
    } catch {
      toast({ title: "Error", description: editingPassword ? "Failed to update" : "Failed to save", variant: "destructive" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await doSave();
    if (ok) onOpenChange(false);
  };

  const handleSaveAndAddAnother = async () => {
    const ok = await doSave();
    if (ok) {
      setFormData({
        ...blankForm(),
        username: formData.username,
        password: generateDefaultPassword(),
      });
    }
  };

  // Cmd/Ctrl+Enter submits
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as any);
    }
  }, [formData, isSubmitting]);

  const handleGeneratedPassword = (password: string) => {
    setFormData(prev => ({ ...prev, password }));
  };

  return (
    <>
      <MobileDialog
        open={open}
        onOpenChange={onOpenChange}
        title={editingPassword?.id ? 'Edit Password' : 'Add New Password'}
        contentClassName="space-y-4"
        footer={
          <div className="flex gap-2 w-full">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" data-testid="cancel-button">
              Cancel
            </Button>
            {!editingPassword?.id && (
              <Button type="button" variant="outline" onClick={handleSaveAndAddAnother} disabled={isSubmitting} className="flex-1 text-xs">
                Save & Add Another
              </Button>
            )}
            <Button type="submit" form="password-form" className="flex-1" disabled={isSubmitting} data-testid="save-password-button">
              {isSubmitting ? "Saving…" : (editingPassword?.id ? "Update" : "Save")}
            </Button>
          </div>
        }
      >
        <form id="password-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
          {/* Service template chips */}
          {!editingPassword?.id && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quick fill</Label>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_PASSWORD_SERVICES.slice(0, 8).map(svc => (
                  <button
                    key={svc.name}
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      name: svc.name,
                      url: svc.url,
                      category: svc.category,
                    }))}
                    className="px-2 py-1 text-xs rounded-full border border-border/60 bg-muted/40 hover:bg-muted text-foreground transition-colors"
                  >
                    {svc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="site-name">Site/Service Name *</Label>
            <Input
              id="site-name"
              placeholder="e.g., Google, Facebook, Banking"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              data-testid="input-site-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-url">Website URL</Label>
            <Input
              id="site-url"
              type="url"
              placeholder="https://example.com"
              value={formData.url}
              onChange={(e) => handleUrlChange(e.target.value)}
              data-testid="input-site-url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username/Email *</Label>
            <Input
              id="username"
              placeholder="your.email@example.com"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              required
              data-testid="input-username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter or generate password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                  className="pr-10"
                  data-testid="input-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              <Button type="button" variant="outline" onClick={() => setShowGenerator(true)} data-testid="generate-password-button">
                <Wand2 className="h-4 w-4 mr-2" />
                Generate
              </Button>
            </div>
            {formData.password && <PasswordStrengthMeter password={formData.password} />}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {PASSWORD_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes or security questions…"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="resize-none"
              data-testid="textarea-notes"
            />
          </div>

          <p className="text-xs text-muted-foreground text-right">⌘↵ to save</p>
        </form>
      </MobileDialog>

      <PasswordGeneratorModal
        open={showGenerator}
        onOpenChange={setShowGenerator}
        onPasswordGenerated={handleGeneratedPassword}
      />
    </>
  );
}
