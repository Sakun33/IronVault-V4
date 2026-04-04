/**
 * Document Viewer Component with react-pdf
 * Renders actual PDF content, images, and text files
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileIcon, 
  FileImage, 
  FileText,
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentData {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string; // base64 or data URL
  ocrText?: string;
}

interface DocumentViewerProps {
  document: DocumentData | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentViewer({ document, isOpen, onClose }: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when document changes
  useEffect(() => {
    if (document && isOpen) {
      setCurrentPage(1);
      setScale(1);
      setRotation(0);
      setLoading(true);
      setError(null);
      
      // Prepare PDF data
      if (document.type === 'pdf' && document.content) {
        // If content is base64, convert to data URL
        if (!document.content.startsWith('data:')) {
          setPdfData(`data:application/pdf;base64,${document.content}`);
        } else {
          setPdfData(document.content);
        }
      } else {
        setPdfData(null);
        setLoading(false);
      }
    }
  }, [document, isOpen]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setError('Failed to load PDF document');
    setLoading(false);
  }, []);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, numPages)));
  }, [numPages]);

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const rotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleDownload = useCallback(() => {
    if (!document?.content) return;
    
    const link = window.document.createElement('a');
    if (document.content.startsWith('data:')) {
      link.href = document.content;
    } else {
      const mimeType = document.type === 'pdf' ? 'application/pdf' : 
                       document.type.startsWith('image') ? `image/${document.type}` : 
                       'application/octet-stream';
      link.href = `data:${mimeType};base64,${document.content}`;
    }
    link.download = document.name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  }, [document]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  if (!document) return null;

  const isPDF = document.type === 'pdf' || document.type === 'application/pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(document.type.toLowerCase());
  const isText = ['txt', 'md', 'text/plain', 'text/markdown'].includes(document.type.toLowerCase());

  const renderContent = () => {
    // No content available
    if (!document.content) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
          <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Content Available</h3>
          <p className="text-muted-foreground text-center mb-4">
            This document doesn't have viewable content stored.
          </p>
        </div>
      );
    }

    // PDF Viewer
    if (isPDF) {
      if (loading) {
        return (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading PDF...</p>
          </div>
        );
      }

      if (error) {
        return (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
            <AlertCircle className="w-16 h-16 text-destructive mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Failed to Load PDF</h3>
            <p className="text-muted-foreground text-center mb-4">{error}</p>
            <Button onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download Instead
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center py-4 gap-4 overflow-auto" ref={containerRef}>
          <Document
            file={pdfData}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              rotate={rotation}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-lg rounded-sm"
              loading={
                <div className="flex items-center justify-center h-[500px] w-[350px] bg-card">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              }
            />
          </Document>
        </div>
      );
    }

    // Image Viewer
    if (isImage) {
      const imageSrc = document.content.startsWith('data:') 
        ? document.content 
        : `data:image/${document.type};base64,${document.content}`;
      
      return (
        <div className="flex items-center justify-center h-full p-4 overflow-auto">
          <img
            src={imageSrc}
            alt={document.name}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease-in-out',
            }}
          />
        </div>
      );
    }

    // Text Viewer
    if (isText) {
      let textContent = document.content;
      if (!textContent.startsWith('data:')) {
        try {
          textContent = atob(document.content);
        } catch {
          textContent = document.content;
        }
      } else {
        try {
          const base64 = document.content.split(',')[1];
          textContent = atob(base64);
        } catch {
          textContent = document.content;
        }
      }

      return (
        <div className="h-full overflow-auto p-4 bg-card">
          <pre className="whitespace-pre-wrap break-words text-foreground font-mono text-sm leading-relaxed">
            {textContent}
          </pre>
        </div>
      );
    }

    // Unsupported type
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
        <FileIcon className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">{document.name}</h3>
        <p className="text-muted-foreground text-center mb-4">
          Preview not supported for this file type
        </p>
        <Button onClick={handleDownload}>
          <Download className="w-4 h-4 mr-2" />
          Download File
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full h-[90vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {isPDF ? (
              <FileIcon className="h-5 w-5 text-red-500 shrink-0" />
            ) : isImage ? (
              <FileImage className="h-5 w-5 text-purple-500 shrink-0" />
            ) : (
              <FileText className="h-5 w-5 text-blue-500 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-foreground truncate text-sm">{document.name}</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{document.type.toUpperCase()}</span>
                <span>•</span>
                <span>{formatFileSize(document.size)}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 border-b border-border bg-muted/50 shrink-0">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={zoomOut} className="h-8 w-8">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="min-w-[50px] justify-center text-xs">
              {Math.round(scale * 100)}%
            </Badge>
            <Button variant="ghost" size="icon" onClick={zoomIn} className="h-8 w-8">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {isPDF && numPages > 0 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Badge variant="secondary" className="min-w-[70px] justify-center text-xs">
                {currentPage} / {numPages}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={rotate} className="h-8 w-8">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDownload} className="h-8 w-8">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/30">
          {renderContent()}
        </div>

        {/* Footer with page indicator for PDF */}
        {isPDF && numPages > 0 && (
          <div className="absolute bottom-4 right-4 pointer-events-none">
            <Badge variant="secondary" className="shadow-lg text-xs">
              Page {currentPage} of {numPages}
            </Badge>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
