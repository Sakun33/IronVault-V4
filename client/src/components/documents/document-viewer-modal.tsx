/**
 * Document Viewer Modal
 * Unified viewer for all document types (PDF, images, text)
 * Uses semantic theme tokens for light/dark mode
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Download,
  Share2,
  Trash2,
  FileText,
  Image as ImageIcon,
  FileType,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { DocumentMeta, isPreviewSupported, formatFileSize } from '@/lib/documents';
import { PDFViewer } from './pdf-viewer';
import { ImageViewer } from './image-viewer';
import { TextViewer } from './text-viewer';
import { ExportSheet } from './export-sheet';

interface DocumentViewerModalProps {
  document: DocumentMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGetData: (id: string) => Promise<ArrayBuffer>;
  onExport: (id: string, password?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function DocumentViewerModal({
  document,
  open,
  onOpenChange,
  onGetData,
  onExport,
  onDelete,
}: DocumentViewerModalProps) {
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load document data when opened
  useEffect(() => {
    if (open && document) {
      setLoading(true);
      setError(null);
      setData(null);

      onGetData(document.id)
        .then((arrayBuffer) => {
          setData(arrayBuffer);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load document');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, document, onGetData]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      setData(null);
      setError(null);
      setShowExportSheet(false);
      setShowDeleteConfirm(false);
    }
  }, [open]);

  const handleExport = useCallback(async (password?: string) => {
    if (!document) return;
    await onExport(document.id, password);
  }, [document, onExport]);

  const handleDelete = useCallback(async () => {
    if (!document) return;
    await onDelete(document.id);
    onOpenChange(false);
  }, [document, onDelete, onOpenChange]);

  const getDocumentIcon = () => {
    if (!document) return <FileType className="h-5 w-5" />;
    
    if (document.mimeType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    if (document.mimeType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-purple-500" />;
    }
    if (document.mimeType.startsWith('text/')) {
      return <FileText className="h-5 w-5 text-blue-500" />;
    }
    return <FileType className="h-5 w-5 text-muted-foreground" />;
  };

  const renderViewer = () => {
    if (!document || !data) return null;

    const canPreview = isPreviewSupported(document.mimeType);

    if (!canPreview) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <FileType className="h-16 w-16 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-medium text-foreground">Preview not supported</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This file type cannot be previewed in the app
            </p>
          </div>
          <Button onClick={() => setShowExportSheet(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export to view
          </Button>
        </div>
      );
    }

    if (document.mimeType === 'application/pdf') {
      return <PDFViewer data={data} filename={document.name} />;
    }

    if (document.mimeType.startsWith('image/')) {
      return <ImageViewer data={data} filename={document.name} mimeType={document.mimeType} />;
    }

    if (document.mimeType.startsWith('text/')) {
      return <TextViewer data={data} filename={document.name} mimeType={document.mimeType} />;
    }

    return null;
  };

  if (!document) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {getDocumentIcon()}
              <div className="min-w-0 flex-1">
                <h2 className="font-medium text-foreground truncate">{document.name}</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{document.mimeType.split('/')[1]?.toUpperCase()}</span>
                  <span>•</span>
                  <span>{formatFileSize(document.sizeBytes)}</span>
                  {document.pdfPageCount && (
                    <>
                      <span>•</span>
                      <span>{document.pdfPageCount} pages</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowExportSheet(true)}
                className="h-8 w-8"
                title="Export"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-8 w-8 text-destructive hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden bg-background relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Decrypting document...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3 text-center p-4">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <h3 className="text-lg font-medium text-foreground">Failed to load document</h3>
                  <p className="text-sm text-muted-foreground max-w-md">{error}</p>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {!loading && !error && data && renderViewer()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Sheet */}
      <ExportSheet
        open={showExportSheet}
        onOpenChange={setShowExportSheet}
        filename={document.name}
        onExport={handleExport}
      />

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-foreground">Delete Document</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Are you sure you want to delete "{document.name}"? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="flex-1"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DocumentViewerModal;
