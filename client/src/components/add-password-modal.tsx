import React, { useState } from 'react';
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

interface AddPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPassword?: any; // Password to edit, undefined for new password
}

export function AddPasswordModal({ open, onOpenChange, editingPassword }: AddPasswordModalProps) {
  const { addPassword, updatePassword } = useVault();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    username: '',
    password: '',
    category: '',
    notes: '',
  });
  
  // Update form data when editingPassword changes
  React.useEffect(() => {
    if (editingPassword) {
      setFormData({
        name: editingPassword.name || '',
        url: editingPassword.url || '',
        username: editingPassword.username || '',
        password: editingPassword.password || '',
        category: editingPassword.category || '',
        notes: editingPassword.notes || '',
      });
    } else {
      setFormData({
        name: '',
        url: '',
        username: '',
        password: '',
        category: '',
        notes: '',
      });
    }
  }, [editingPassword]);
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.username || !formData.password) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPassword) {
        await updatePassword(editingPassword.id, formData);
        toast({
          title: "Updated",
          description: "Password updated successfully",
        });
      } else {
        await addPassword(formData);
        toast({
          title: "Success",
          description: "Password saved successfully",
        });
        
        // Reset form only for new passwords
        setFormData({
          name: '',
          url: '',
          username: '',
          password: '',
          category: '',
          notes: '',
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: editingPassword ? "Failed to update password" : "Failed to save password",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeneratedPassword = (password: string) => {
    setFormData(prev => ({ ...prev, password }));
  };

  return (
    <>
      <MobileDialog 
        open={open} 
        onOpenChange={onOpenChange}
        title={editingPassword ? 'Edit Password' : 'Add New Password'}
        contentClassName="space-y-4"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              data-testid="cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="password-form"
              className="flex-1"
              disabled={isSubmitting}
              data-testid="save-password-button"
            >
              {isSubmitting ? "Saving..." : (editingPassword ? "Update Password" : "Save Password")}
            </Button>
          </div>
        }
      >
          <form id="password-form" onSubmit={handleSubmit} className="space-y-4">
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
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
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
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowGenerator(true)}
                  data-testid="generate-password-button"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </div>
              
              {formData.password && (
                <PasswordStrengthMeter password={formData.password} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {PASSWORD_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes or security questions..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="resize-none"
                data-testid="textarea-notes"
              />
            </div>

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
