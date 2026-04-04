import { VaultManagerUI } from '@/components/vault-manager-ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

export default function VaultsPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Vault Management</h1>
          <p className="text-muted-foreground">
            Organize your passwords and sensitive data in separate vaults
          </p>
        </div>
      </div>

      <VaultManagerUI />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">About Multi-Vault</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Vaults help you organize your sensitive data. Create separate vaults for work, 
            personal use, or share with family members.
          </p>
          <p>
            Each vault has its own master password and can optionally be unlocked with biometrics 
            for quick access. The default vault is the one that opens automatically when you 
            start the app.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
