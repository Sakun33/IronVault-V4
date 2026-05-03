/**
 * Simple Document Viewer - Uses native browser capabilities
 * Works reliably on iOS with Capacitor filesystem support
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { 
  FileIcon, 
  FileImage, 
  FileText,
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
  Share2,
} from 'lucide-react';

interface DocumentData {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  ocrText?: string;
}

interface DocumentViewerProps {
  document: DocumentData | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentViewer({ document, isOpen, onClose }: DocumentViewerProps) {
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Convert base64/dataURL to blob URL for better performance
  useEffect(() => {
    if (document?.content && isOpen) {
      setLoading(true);
      setError(null);
      
      try {
        let base64Data = document.content;
        let mimeType = 'application/octet-stream';
        
        // Extract base64 and mime type from data URL
        if (base64Data.startsWith('data:')) {
          const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
          }
        } else {
          // Determine mime type from document type
          const type = document.type.toLowerCase();
          if (type === 'pdf') mimeType = 'application/pdf';
          else if (['jpg', 'jpeg'].includes(type)) mimeType = 'image/jpeg';
          else if (type === 'png') mimeType = 'image/png';
          else if (type === 'gif') mimeType = 'image/gif';
          else if (type === 'webp') mimeType = 'image/webp';
          else if (['txt', 'text'].includes(type)) mimeType = 'text/plain';
          else if (type === 'md') mimeType = 'text/markdown';
        }
        
        // Convert base64 to blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        setBlobUrl(url);
        setLoading(false);
      } catch (err) {
        console.error('Error processing document:', err);
        setError('Failed to process document');
        setLoading(false);
      }
    }
    
    // Cleanup blob URL on unmount
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [document?.content, document?.type, isOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setRotation(0);
      setLoading(true);
      setError(null);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
    }
  }, [isOpen]);

  // Save to filesystem and share (for native iOS viewing)
  const openWithNativeViewer = async () => {
    if (!document?.content) return;
    
    try {
      let base64Data = document.content;
      
      // Extract base64 from data URL if needed
      if (base64Data.startsWith('data:')) {
        const matches = base64Data.match(/^data:[^;]+;base64,(.+)$/);
        if (matches) {
          base64Data = matches[1];
        }
      }
      
      // Save to temp file
      const fileName = `temp_${Date.now()}_${document.name}`;
      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });
      
      // Get the file URI
      const fileInfo = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache,
      });
      
      // Share to open with native viewer
      await Share.share({
        title: document.name,
        url: fileInfo.uri,
      });
      
      // Clean up after a delay
      setTimeout(async () => {
        try {
          await Filesystem.deleteFile({
            path: fileName,
            directory: Directory.Cache,
          });
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 60000);
      
    } catch (err) {
      console.error('Error opening with native viewer:', err);
      // Fallback to download
      handleDownload();
    }
  };

  const handleDownload = () => {
    if (!document?.content) return;
    
    // On native platforms, use share
    if (Capacitor.isNativePlatform()) {
      openWithNativeViewer();
      return;
    }
    
    // On web, use download link
    if (blobUrl) {
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = document.name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    }
  };

  const openInNewTab = () => {
    if (Capacitor.isNativePlatform()) {
      openWithNativeViewer();
    } else if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  if (!document) return null;

  const isPDF = document.type.toLowerCase() === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(document.type.toLowerCase());
  const isText = ['txt', 'md', 'text'].includes(document.type.toLowerCase());

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      );
    }

    if (error || !blobUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Failed to Load</h3>
          <p className="text-muted-foreground text-center mb-4">{error || 'No content available'}</p>
          {document.content && (
            <Button onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download Instead
            </Button>
          )}
        </div>
      );
    }

    // PDF Viewer - On iOS use native viewer, on web use iframe
    if (isPDF) {
      const isNative = Capacitor.isNativePlatform();
      
      if (isNative) {
        // On iOS/Android, show open button for native PDF viewer
        return (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
            <FileIcon className="w-20 h-20 text-red-500 mb-6" />
            <h3 className="text-xl font-semibold text-foreground mb-2">{document.name}</h3>
            <p className="text-muted-foreground text-center mb-6">
              PDF ready to view
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button onClick={openWithNativeViewer} className="w-full" size="lg">
                <ExternalLink className="w-5 h-5 mr-2" />
                Open PDF
              </Button>
              <Button variant="outline" onClick={openWithNativeViewer} className="w-full">
                <Share2 className="w-4 h-4 mr-2" />
                Share PDF
              </Button>
            </div>
          </div>
        );
      }
      
      // On web, use iframe
      return (
        <div className="flex flex-col h-full">
          <iframe
            src={blobUrl}
            className="flex-1 w-full min-h-[500px] border-0 bg-white"
            title={document.name}
          />
          <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 border-t">
            <Button variant="outline" size="sm" onClick={openInNewTab}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in Browser
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      );
    }

    // Image Viewer
    if (isImage) {
      return (
        <div className="flex items-center justify-center h-full p-4 overflow-auto bg-black/5">
          <img
            src={blobUrl}
            alt={document.name}
            className="max-w-full max-h-full object-contain rounded shadow-lg"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease-in-out',
            }}
            onLoad={() => setLoading(false)}
            onError={() => setError('Failed to load image')}
          />
        </div>
      );
    }

    // Text Viewer
    if (isText) {
      return (
        <iframe
          src={blobUrl}
          className="w-full h-full min-h-[400px] border-0 bg-card"
          title={document.name}
        />
      );
    }

    // Unsupported type - offer download
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
        <FileIcon className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">{document.name}</h3>
        <p className="text-muted-foreground text-center mb-4">
          Preview not available for this file type
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

        {/* Toolbar for images */}
        {isImage && !loading && !error && (
          <div className="flex items-center justify-center gap-2 p-2 border-b border-border bg-muted/50 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="h-8 w-8">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(3, s + 0.25))} className="h-8 w-8">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setRotation(r => (r + 90) % 360)} className="h-8 w-8">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDownload} className="h-8 w-8">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/30">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
