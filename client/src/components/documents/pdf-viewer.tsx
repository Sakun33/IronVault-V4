/**
 * PDF Viewer Component
 * Uses react-pdf for rendering with scroll, zoom, and search support
 * Follows semantic theme tokens for light/dark mode
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  ZoomIn,
  ZoomOut,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  RotateCw,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  data: ArrayBuffer | string;
  filename: string;
  onClose?: () => void;
}

export function PDFViewer({ data, filename, onClose }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Convert ArrayBuffer to data URL if needed
  const pdfSource = React.useMemo(() => {
    if (typeof data === 'string') return data;
    return { data: new Uint8Array(data) };
  }, [data]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setLoading(false);
  }, []);

  const goToPage = useCallback((page: number) => {
    const targetPage = Math.max(1, Math.min(page, numPages));
    setCurrentPage(targetPage);
    
    const pageElement = pageRefs.current.get(targetPage);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Handle scroll to update current page indicator
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      
      for (let i = 1; i <= numPages; i++) {
        const pageElement = pageRefs.current.get(i);
        if (pageElement) {
          const rect = pageElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          if (rect.top >= containerRect.top && rect.top < containerRect.top + containerHeight / 2) {
            setCurrentPage(i);
            break;
          }
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [numPages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        goToPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToPage(currentPage - 1);
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      } else if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault();
        setShowSearch(true);
      } else if (e.key === 'Escape') {
        setShowSearch(false);
        setShowThumbnails(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, goToPage, zoomIn, zoomOut]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={zoomOut} className="h-8 w-8">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Badge variant="outline" className="min-w-[60px] justify-center">
            {Math.round(scale * 100)}%
          </Badge>
          <Button variant="ghost" size="icon" onClick={zoomIn} className="h-8 w-8">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

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
          <Badge variant="secondary" className="min-w-[80px] justify-center">
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

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            className="h-8 w-8"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={rotate} className="h-8 w-8">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Sheet open={showThumbnails} onOpenChange={setShowThumbnails}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-4">
              <SheetHeader>
                <SheetTitle>Pages</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-2 mt-4 overflow-y-auto max-h-[calc(100vh-120px)]">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => {
                      goToPage(pageNum);
                      setShowThumbnails(false);
                    }}
                    className={`p-1 border rounded-md hover:border-primary transition-colors ${
                      currentPage === pageNum ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    <Document file={pdfSource} loading={null}>
                      <Page
                        pageNumber={pageNum}
                        width={100}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </Document>
                    <div className="text-xs text-muted-foreground text-center mt-1">
                      {pageNum}
                    </div>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 p-2 border-b border-border bg-muted">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search in document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-8"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* PDF Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/50"
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}
        
        <Document
          file={pdfSource}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="flex flex-col items-center py-4 gap-4"
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              ref={(el) => {
                if (el) pageRefs.current.set(pageNum, el);
              }}
              className="shadow-lg bg-card rounded-sm"
            >
              <Page
                pageNumber={pageNum}
                scale={scale}
                rotate={rotation}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="rounded-sm overflow-hidden"
                loading={
                  <div className="flex items-center justify-center h-[400px] w-[300px] bg-card">
                    <div className="animate-pulse bg-muted h-full w-full" />
                  </div>
                }
              />
            </div>
          ))}
        </Document>
      </div>

      {/* Page Indicator (floating) */}
      <div className="absolute bottom-4 right-4 pointer-events-none">
        <Badge variant="secondary" className="shadow-lg">
          Page {currentPage} of {numPages}
        </Badge>
      </div>
    </div>
  );
}

export default PDFViewer;
