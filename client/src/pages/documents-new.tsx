/**
 * Documents Page - Industry Standard Document Vault
 * Features: PDF/Image/Text viewing, AES-256 encrypted export, offline-first
 * Uses semantic theme tokens for light/dark mode
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Image as ImageIcon,
  FileType,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  FolderOpen,
  Shield,
  Filter,
  Loader2,
  Upload,
  X,
  CheckCircle,
} from 'lucide-react';
import {
  DocumentMeta,
  FileCategory,
  formatFileSize,
  getFileCategory,
  listDocuments,
  importDocument,
  getDecryptedDocumentData,
  exportDocument,
  deleteDocument,
  initializeVault,
  ImportProgress,
} from '@/lib/documents';
import { DocumentViewerModal } from '@/components/documents/document-viewer-modal';
import { ExportSheet } from '@/components/documents/export-sheet';
import { format } from 'date-fns';

const FILTER_OPTIONS: { value: FileCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pdf', label: 'PDFs' },
  { value: 'images', label: 'Images' },
  { value: 'text', label: 'Text' },
];

export default function DocumentsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<FileCategory>('all');
  const [selectedDocument, setSelectedDocument] = useState<DocumentMeta | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [exportDocumentId, setExportDocumentId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      await initializeVault();
      const docs = await listDocuments();
      setDocuments(docs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        searchQuery === '' ||
        doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter =
        filterCategory === 'all' ||
        getFileCategory(doc.mimeType) === filterCategory;

      return matchesSearch && matchesFilter;
    });
  }, [documents, searchQuery, filterCategory]);

  // Handle file import
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    setImportProgress({ stage: 'reading', progress: 0, message: 'Starting import...' });

    try {
      for (const file of Array.from(files)) {
        const meta = await importDocument(file, 'default', setImportProgress);
        setDocuments((prev) => [meta, ...prev]);
      }

      toast({
        title: 'Import successful',
        description: `${files.length} document(s) imported and encrypted`,
      });
    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import document',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      setImportProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [toast]);

  // Handle document actions
  const handleView = useCallback((doc: DocumentMeta) => {
    setSelectedDocument(doc);
    setShowViewer(true);
  }, []);

  const handleExportClick = useCallback((docId: string) => {
    setExportDocumentId(docId);
    setShowExportSheet(true);
  }, []);

  const handleExport = useCallback(async (id: string, password?: string) => {
    try {
      const result = await exportDocument(id, { password });
      if (result.success) {
        toast({
          title: 'Export successful',
          description: password ? 'Password-protected ZIP created' : 'Document exported',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export',
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast({
        title: 'Document deleted',
        description: 'The document has been permanently removed',
      });
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const getDocumentIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return <FileText className="h-10 w-10 text-red-500" />;
    }
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="h-10 w-10 text-purple-500" />;
    }
    if (mimeType.startsWith('text/')) {
      return <FileText className="h-10 w-10 text-blue-500" />;
    }
    return <FileType className="h-10 w-10 text-muted-foreground" />;
  };

  const getFileTypeBadge = (mimeType: string) => {
    const type = mimeType.split('/')[1]?.toUpperCase() || 'FILE';
    let className = 'bg-muted text-muted-foreground';
    
    if (mimeType === 'application/pdf') {
      className = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    } else if (mimeType.startsWith('image/')) {
      className = 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    } else if (mimeType.startsWith('text/')) {
      className = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }

    return <Badge variant="outline" className={className}>{type}</Badge>;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.txt,.md"
        multiple
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Documents
            </h1>
            <p className="text-sm text-muted-foreground">
              Encrypted document storage
            </p>
          </div>
          <Button onClick={handleImport} disabled={importing} size="sm">
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Import</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={filterCategory === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterCategory(option.value)}
              className="shrink-0"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Import progress */}
      {importing && importProgress && (
        <div className="p-4 border-b border-border bg-primary/5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{importProgress.message}</p>
              <div className="h-1 mt-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${importProgress.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {documents.length === 0 ? 'No documents yet' : 'No results found'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {documents.length === 0
                ? 'Import your first document to get started. All files are encrypted locally.'
                : 'Try adjusting your search or filter criteria'}
            </p>
            {documents.length === 0 && (
              <Button onClick={handleImport} className="mt-4">
                <Upload className="h-4 w-4 mr-2" />
                Import your first document
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((doc) => (
              <Card
                key={doc.id}
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleView(doc)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="shrink-0 p-2 rounded-lg bg-muted">
                      {getDocumentIcon(doc.mimeType)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">
                        {doc.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {getFileTypeBadge(doc.mimeType)}
                        <span>•</span>
                        <span>{formatFileSize(doc.sizeBytes)}</span>
                        <span>•</span>
                        <span>{format(doc.createdAt, 'MMM d, yyyy')}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(doc)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportClick(doc.id)}>
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(doc.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Document count */}
      {!loading && documents.length > 0 && (
        <div className="shrink-0 p-3 border-t border-border bg-card text-center">
          <p className="text-xs text-muted-foreground">
            {filteredDocuments.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
            {filterCategory !== 'all' && ` • Filtered by ${filterCategory}`}
          </p>
        </div>
      )}

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        document={selectedDocument}
        open={showViewer}
        onOpenChange={setShowViewer}
        onGetData={getDecryptedDocumentData}
        onExport={handleExport}
        onDelete={handleDelete}
      />

      {/* Export Sheet (for list actions) */}
      {exportDocumentId && (
        <ExportSheet
          open={showExportSheet}
          onOpenChange={(open) => {
            setShowExportSheet(open);
            if (!open) setExportDocumentId(null);
          }}
          filename={documents.find((d) => d.id === exportDocumentId)?.name || 'document'}
          onExport={(password) => handleExport(exportDocumentId, password)}
        />
      )}
    </div>
  );
}
