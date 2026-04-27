import { useState } from 'react';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload, FileText, Shield, Database, FileSpreadsheet, HelpCircle, ExternalLink, CreditCard, DollarSign, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { isNativeApp } from '@/native/platform';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import ImportPasswords from '@/components/import-passwords';

interface ImportExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportExportModal({ open, onOpenChange }: ImportExportModalProps) {
  const { exportVault, importVault, importPasswordsFromCSV, getAvailableCSVParsers, importBankStatementsFromCSV, refreshData } = useVault();
  const { toast } = useToast();
  
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedParser, setSelectedParser] = useState<string>('');
  const [isImportingCSV, setIsImportingCSV] = useState(false);
  const csvParsers = getAvailableCSVParsers();

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter a password for the export file",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const encryptedData = await exportVault(exportPassword);
      const filename = `ironvault-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;

      if (isNativeApp()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        await Filesystem.writeFile({
          path: filename,
          data: encryptedData,
          directory: Directory.Cache,
          encoding: 'utf8' as any,
        });
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
        await Share.share({ title: 'IronVault Backup', url: uri, dialogTitle: 'Save Backup' });
      } else {
        const blob = new Blob([encryptedData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      
      toast({
        title: "Export Complete",
        description: "Your vault has been exported successfully",
      });
      
      setExportPassword('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export vault data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      toast({
        title: "Error",
        description: "Please select a file to import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const fileContent = await importFile.text();
      
      // Check if this is a CSV file that might be a complete export
      if (importFile.name.toLowerCase().endsWith('.csv')) {
        const lines = fileContent.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        // Check if this looks like a complete vault export
        const hasCompleteDataHeaders = headers.some(h => 
          h.includes('subscription') || h.includes('note') || h.includes('expense') ||
          h.includes('reminder') || h.includes('bank') || h.includes('investment') ||
          h.includes('template') || h.includes('sample')
        );
        
        if (hasCompleteDataHeaders || importFile.name.toLowerCase().includes('complete') || importFile.name.toLowerCase().includes('template')) {
          toast({
            title: "CSV Complete Export Detected",
            description: "This appears to be a complete vault export in CSV format. Please use the 'CSV Import' tab and select 'Generic CSV' parser, or convert to JSON format for full import.",
            variant: "destructive",
          });
          return;
        }
      }
      
      // Check if this is a bank statement CSV file
      if (importFile.name.toLowerCase().includes('bank') && importFile.name.toLowerCase().endsWith('.csv')) {
        try {
          const result = await importBankStatementsFromCSV(fileContent);
          await refreshData(); // Refresh data after successful bank import
          toast({
            title: "Bank Statements Import Complete",
            description: `Successfully imported ${result.statements} bank statements with ${result.transactions} transactions.`,
          });
          setImportFile(null);
          setImportPassword('');
          onOpenChange(false);
          return;
        } catch (error) {
          console.error('Bank statement import error:', error);
          const errorMessage = error instanceof Error ? error.message : "Failed to import bank statement CSV";
          toast({
            title: "Bank Statement Import Failed",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }
      }
      
      // Try to import without password first (for plaintext files)
      try {
        await importVault(fileContent);
        await refreshData(); // Refresh data after successful import
        toast({
          title: "Import Complete",
          description: "Vault data imported successfully",
        });
      } catch (error) {
        // If import fails without password, check if it's an encrypted file
        if (error instanceof Error && error.message.includes('encrypted vault file')) {
          // This is an encrypted file, require password
          if (!importPassword.trim()) {
            toast({
              title: "Password Required",
              description: "This is an encrypted vault file. Please enter the password to decrypt it.",
              variant: "destructive",
            });
            setIsImporting(false);
            return;
          }
          
          // Try again with password
          await importVault(fileContent, importPassword);
          await refreshData(); // Refresh data after successful encrypted import
          toast({
            title: "Import Complete",
            description: "Encrypted vault data imported successfully",
          });
        } else {
          // Re-throw other errors
          throw error;
        }
      }
      
      setImportFile(null);
      setImportPassword('');
      onOpenChange(false);
    } catch (error) {
      console.error('Import error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to import vault data";
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Accept JSON, CSV, and other text files
      const validTypes = ['application/json', 'text/csv', 'text/plain'];
      const validExtensions = ['.json', '.csv', '.txt'];
      
      if (!validTypes.includes(file.type) && !validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        toast({
          title: "Invalid File",
          description: "Please select a JSON, CSV, or text file",
          variant: "destructive",
        });
        return;
      }
      setImportFile(file);
    }
  };

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
        toast({
          title: "Invalid File",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      setCsvFile(file);
      // Auto-select generic parser if no parser is selected
      if (!selectedParser) {
        setSelectedParser('generic');
      }
    }
  };

  const handleCSVImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      toast({
        title: "Error",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }

    setIsImportingCSV(true);
    try {
      const csvContent = await csvFile.text();
      
      // Check if this looks like a complete vault export (has multiple data types)
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // If it has headers that suggest it's a complete export, route to regular import
      const hasCompleteDataHeaders = headers.some(h => 
        h.includes('subscription') || h.includes('note') || h.includes('expense') ||
        h.includes('reminder') || h.includes('bank') || h.includes('investment') ||
        h.includes('template') || h.includes('sample')
      );
      
      if (hasCompleteDataHeaders && (csvFile.name.toLowerCase().includes('complete') || csvFile.name.toLowerCase().includes('template'))) {
        // Auto-select the complete data parser
        setSelectedParser('complete-data');
        toast({
          title: "Complete Data Export Detected",
          description: "Auto-selected 'Complete Data Export' parser. Click 'Import Vault' to proceed.",
        });
        return;
      }
      
      // Check if this looks like bank statements
      if (csvFile.name.toLowerCase().includes('bank') || 
          headers.some(h => h.includes('date') && h.includes('amount') && h.includes('description'))) {
        try {
          const result = await importBankStatementsFromCSV(csvContent);
          toast({
            title: "Bank Statements Import Complete",
            description: `Successfully imported ${result.statements} bank statements with ${result.transactions} transactions.`,
          });
          setCsvFile(null);
          setSelectedParser('');
          onOpenChange(false);
          return;
        } catch (error) {
          console.error('Bank statement import error:', error);
          const errorMessage = error instanceof Error ? error.message : "Failed to import bank statement CSV";
          toast({
            title: "Bank Statement Import Failed",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }
      }

      // Check if this looks like investment data
      if (csvFile.name.toLowerCase().includes('investment') || 
          headers.some(h => h.includes('ticker') && h.includes('quantity') && h.includes('price'))) {
        toast({
          title: "Investment Template Detected",
          description: "This appears to be an investment template. Please use the 'Import' tab for investment data, or use 'Generic CSV' parser for password data.",
          variant: "destructive",
        });
        return;
      }

      if (!selectedParser) {
        toast({
          title: "Error", 
          description: "Please select a password manager format",
          variant: "destructive",
        });
        return;
      }

      const result = await importPasswordsFromCSV(csvContent, selectedParser);
      await refreshData(); // Refresh data after successful CSV import
      
      toast({
        title: "CSV Import Complete",
        description: `Successfully imported ${result.imported} passwords. ${result.skipped} duplicates were skipped.`,
      });
      
      setCsvFile(null);
      setSelectedParser('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "CSV Import Failed",
        description: error instanceof Error ? error.message : "Failed to import CSV file",
        variant: "destructive",
      });
    } finally {
      setIsImportingCSV(false);
    }
  };

  const resetForm = () => {
    setExportPassword('');
    setImportPassword('');
    setImportFile(null);
    setCsvFile(null);
    setSelectedParser('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const downloadTemplate = (type: string) => {
    let csvContent = '';
    let filename = '';

    switch (type) {
      case 'passwords':
        csvContent = 'Title,Username,Password,URL,Notes,Tags\n"Sample Website","user@example.com","password123","https://example.com","Sample password entry","work,important"\n"Another Site","admin","admin123","https://another.com","Another sample","personal"';
        filename = 'passwords-template.csv';
        break;
      case 'subscriptions':
        csvContent = 'Name,Plan,Cost,Currency,Billing Cycle,Next Billing Date,Category,Notes\n"Netflix","Premium","15.99","USD","monthly","2024-01-15","Entertainment","Streaming service"\n"Spotify","Family","16.99","USD","monthly","2024-01-20","Entertainment","Music streaming"';
        filename = 'subscriptions-template.csv';
        break;
      case 'notes':
        csvContent = 'Title,Content,Notebook,Tags,Is Pinned\n"Meeting Notes","Discussion about project timeline and deliverables","Work","meeting,project","false"\n"Personal Goals","Learn new programming language and read 12 books this year","Personal","goals,learning","true"';
        filename = 'notes-template.csv';
        break;
      case 'expenses':
        csvContent = 'Description,Amount,Currency,Category,Date,Tags,Is Recurring\n"Groceries","85.50","USD","Food","2024-01-10","food,weekly","true"\n"Gas","45.00","USD","Transportation","2024-01-12","transport,fuel","false"';
        filename = 'expenses-template.csv';
        break;
      case 'bank-statements':
        csvContent = 'Date,Description,Amount,Type,Balance,Account,Category\n"2024-01-10","Salary Deposit","3000.00","credit","5000.00","Checking","Income"\n"2024-01-11","Grocery Store","85.50","debit","4914.50","Checking","Food"';
        filename = 'bank-statements-template.csv';
        break;
      case 'investments':
        csvContent = 'Name,Type,Ticker,Quantity,Purchase Price,Current Price,Institution\n"Apple Inc","Stock","AAPL","10","150.00","155.00","Fidelity"\n"Vanguard S&P 500","ETF","VOO","50","400.00","405.00","Vanguard"';
        filename = 'investments-template.csv';
        break;
      default:
        return;
    }

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: `${filename} has been downloaded successfully`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="import-export-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Import / Export Vault
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="export" data-testid="tab-export">Export</TabsTrigger>
            <TabsTrigger value="import" data-testid="tab-import">Import</TabsTrigger>
            <TabsTrigger value="csv-import" data-testid="tab-csv-import">CSV Import</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          </TabsList>
          
          <DialogBody>
            <TabsContent value="export" className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Export Security</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your vault data will be encrypted with the password you provide below. 
                Store this password safely - you'll need it to import the data later.
              </p>
            </div>
            
            <form onSubmit={handleExport} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="export-password">Export Password</Label>
                <Input
                  id="export-password"
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="Enter a secure password for the export file"
                  data-testid="input-export-password"
                  disabled={isExporting}
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={isExporting || !exportPassword.trim()}
                className="w-full"
                data-testid="button-export"
              >
                {isExporting ? (
                  "Exporting..."
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export Vault
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="import" className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Import Options</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Import data from IronVault backups (encrypted) or plaintext exports from other password managers. 
                Encrypted files will require a password, while plaintext files can be imported directly.
              </p>
            </div>
            
            <form onSubmit={handleImport} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="import-file">Import File</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".json,.csv,.txt,application/json,text/csv,text/plain"
                  onChange={handleFileChange}
                  data-testid="input-import-file"
                  disabled={isImporting}
                />
                {importFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {importFile.name}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="import-password">Password (if encrypted)</Label>
                <Input
                  id="import-password"
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Enter password for encrypted files (optional for plaintext)"
                  data-testid="input-import-password"
                  disabled={isImporting}
                />
                <p className="text-xs text-muted-foreground">
                  Only required for encrypted IronVault backup files
                </p>
              </div>
              
              <Button 
                type="submit" 
                disabled={isImporting || !importFile}
                className="w-full"
                data-testid="button-import"
              >
                {isImporting ? (
                  "Importing..."
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Vault
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="csv-import" className="space-y-4">
            <ImportPasswords />
          </TabsContent>
          
          <TabsContent value="templates" className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Sample Templates</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Download sample Excel/CSV templates to understand the required format for importing data. 
                Fill in your data and import the completed file.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Passwords Template */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Passwords Template
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Template for importing passwords from other password managers or creating new entries.
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <strong>Columns:</strong> Title, Username, Password, URL, Notes, Tags
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => downloadTemplate('passwords')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                    </Button>
                  </CardContent>
                </Card>

                {/* Subscriptions Template */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Subscriptions Template
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Template for importing subscription data including billing cycles and costs.
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <strong>Columns:</strong> Name, Plan, Cost, Currency, Billing Cycle, Next Billing Date, Category, Notes
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => downloadTemplate('subscriptions')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                    </Button>
                  </CardContent>
                </Card>

                {/* Notes Template */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Notes Template
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Template for importing notes and documents with categories and tags.
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <strong>Columns:</strong> Title, Content, Notebook, Tags, Is Pinned
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => downloadTemplate('notes')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                    </Button>
                  </CardContent>
                </Card>

                {/* Expenses Template */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Expenses Template
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Template for importing expense tracking data with categories and dates.
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <strong>Columns:</strong> Description, Amount, Currency, Category, Date, Tags, Is Recurring
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => downloadTemplate('expenses')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                    </Button>
                  </CardContent>
                </Card>

                {/* Bank Statements Template */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      Bank Statements Template
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Template for importing bank statement transactions and account data.
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <strong>Columns:</strong> Date, Description, Amount, Type, Balance, Account, Category
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => downloadTemplate('bank-statements')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                    </Button>
                  </CardContent>
                </Card>

                {/* Investments Template */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Investments Template
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Template for importing investment portfolio data and performance metrics.
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <strong>Columns:</strong> Name, Type, Ticker, Quantity, Purchase Price, Current Price, Institution
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => downloadTemplate('investments')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-lg bg-primary/10 p-4">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-5 h-5 text-primary mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-medium text-primary">Import Instructions</h4>
                    <ol className="text-sm text-primary space-y-1 list-decimal list-inside">
                      <li>Download the appropriate template for your data type</li>
                      <li>Fill in your data following the column headers exactly</li>
                      <li>Save the file as CSV format (.csv)</li>
                      <li>Use the CSV Import tab to upload your completed file</li>
                      <li>Select the appropriate parser format if importing from another password manager</li>
                    </ol>
                    <div className="text-xs text-primary mt-2">
                      <strong>Note:</strong> Duplicate entries will be automatically skipped during import.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          </DialogBody>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}