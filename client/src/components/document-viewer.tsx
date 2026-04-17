import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileIcon, 
  FileImage, 
  FileSpreadsheet, 
  FileText,
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Search, 
  Bookmark, 
  BookmarkCheck, 
  Maximize, 
  Minimize,
  AlertCircle,
  Info
} from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  ocrText?: string;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    created?: Date;
    modified?: Date;
  };
}

interface DocumentViewerProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentViewer({ document, isOpen, onClose }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const viewerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document) {
      setLoading(true);
      setError(null);
      
      // Simulate document loading
      setTimeout(() => {
        setLoading(false);
        setTotalPages(Math.max(1, Math.floor(Math.random() * 50) + 1));
      }, 1000);
    }
  }, [document]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleRotateCounter = () => {
    setRotation(prev => (prev - 90 + 360) % 360);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  const toggleBookmark = () => {
    setIsBookmarked(prev => !prev);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      // Simulate search results
      setSearchResults([1, 3, 5, 7, 9]);
    } else {
      setSearchResults([]);
    }
  };

  const handleDownload = () => {
    if (document) {
      // Simulate download
      const blob = new Blob([document.content || ''], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const loadDocumentContent = () => {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const getFileColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf': return 'text-red-600';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp': return 'text-purple-600';
      case 'doc':
      case 'docx': return 'text-primary';
      case 'xls':
      case 'xlsx': return 'text-green-600';
      case 'ppt':
      case 'pptx': return 'text-orange-600';
      case 'txt': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  if (!document) return null;

  const fileColor = getFileColor(document.type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-7xl max-h-[95svh] p-0 ${isFullscreen ? 'w-screen h-screen' : ''}`}>
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileIcon className={`w-6 h-6 ${fileColor}`} />
              <div>
                <DialogTitle className="text-lg">{document.name}</DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{document.type.toUpperCase()}</span>
                  <span>•</span>
                  <span>{(document.size / 1024 / 1024).toFixed(2)} MB</span>
                  {document.metadata?.author && (
                    <>
                      <span>•</span>
                      <span>by {document.metadata.author}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleBookmark}
                className="flex items-center gap-2"
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-4 h-4 text-primary" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              
              <span className="text-sm font-medium min-w-[60px] text-center">
                {zoom}%
              </span>
              
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleRotateCounter}>
                <RotateCcw className="w-4 h-4" />
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleRotate}>
                <RotateCw className="w-4 h-4" />
              </Button>
              
              <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Document Content */}
        <div 
          ref={viewerRef}
          className="flex-1 overflow-auto bg-muted p-4"
          style={{ height: isFullscreen ? 'calc(100vh - 200px)' : '600px' }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading document...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 mb-2">{error}</p>
                <Button onClick={loadDocumentContent}>Retry</Button>
              </div>
            </div>
          ) : (
            <div 
              ref={contentRef}
              className="mx-auto bg-card shadow-lg"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center top',
                transition: 'transform 0.2s ease-in-out'
              }}
            >
              {/* Document Content Based on Type */}
              <div className="p-8 min-h-[800px]">
                {document.type === 'pdf' ? (
                  <div className="w-full h-full min-h-[600px]">
                    {document.content ? (
                      <iframe
                        src={document.content}
                        className="w-full h-full min-h-[600px] border-0 rounded-lg"
                        title={document.name}
                        style={{
                          transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                          transformOrigin: 'center top',
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-card rounded-lg border p-8">
                        <FileIcon className="w-16 h-16 text-red-600 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">{document.name}</h3>
                        <p className="text-muted-foreground text-center mb-4">
                          PDF Document - {totalPages} page{totalPages > 1 ? 's' : ''}
                        </p>
                        <div className="flex items-center gap-4 mb-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage <= 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm">Page {currentPage} of {totalPages}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage >= totalPages}
                          >
                            Next
                          </Button>
                        </div>
                        <Button onClick={handleDownload} className="mt-2">
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                      </div>
                    )}
                  </div>
                ) : document.type === 'jpg' || document.type === 'jpeg' || document.type === 'png' || document.type === 'gif' || document.type === 'bmp' ? (
                  <div className="flex flex-col items-center justify-center">
                    {document.content ? (
                      <img
                        src={document.content}
                        alt={document.name}
                        className="max-w-full max-h-[500px] object-contain rounded-lg shadow-lg"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center min-h-[300px] bg-card rounded-lg border p-8">
                        <FileImage className="w-16 h-16 text-purple-600 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">{document.name}</h3>
                        <p className="text-muted-foreground text-center mb-4">Image File</p>
                        <Button onClick={handleDownload}>
                          <Download className="w-4 h-4 mr-2" />
                          Download Image
                        </Button>
                      </div>
                    )}
                  </div>
                ) : document.type === 'doc' || document.type === 'docx' ? (
                  <div className="text-center mb-8">
                    <FileIcon className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">{document.name}</h2>
                    <p className="text-muted-foreground mb-4">Word Document</p>
                    <div className="bg-muted p-8 rounded-lg border-2 border-dashed border-border">
                      <p className="text-muted-foreground mb-4">Word Document Viewer Placeholder</p>
                      <p className="text-sm text-muted-foreground">
                        In a real implementation, this would display the actual Word document content with formatting,
                        tables, images, and other elements preserved.
                      </p>
                    </div>
                  </div>
                ) : document.type === 'xls' || document.type === 'xlsx' ? (
                  <div className="text-center mb-8">
                    <FileSpreadsheet className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">{document.name}</h2>
                    <p className="text-muted-foreground mb-4">Excel Spreadsheet</p>
                    <div className="bg-muted p-8 rounded-lg border-2 border-dashed border-border">
                      <p className="text-muted-foreground mb-4">Excel Viewer Placeholder</p>
                      <p className="text-sm text-muted-foreground">
                        In a real implementation, this would display the actual Excel spreadsheet with formulas,
                        charts, and formatting preserved.
                      </p>
                    </div>
                  </div>
                ) : document.type === 'ppt' || document.type === 'pptx' ? (
                  <div className="text-center mb-8">
                    <FileIcon className="w-16 h-16 text-orange-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">{document.name}</h2>
                    <p className="text-muted-foreground mb-4">PowerPoint Presentation</p>
                    <div className="bg-muted p-8 rounded-lg border-2 border-dashed border-border">
                      <p className="text-muted-foreground mb-4">PowerPoint Viewer Placeholder</p>
                      <p className="text-sm text-muted-foreground">
                        In a real implementation, this would display the actual PowerPoint presentation with slides,
                        animations, and transitions preserved.
                      </p>
                    </div>
                  </div>
                ) : document.type === 'txt' ? (
                  <div className="text-center mb-8">
                    <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">{document.name}</h2>
                    <p className="text-muted-foreground mb-4">Text Document</p>
                    <div className="bg-card p-8 rounded-lg border">
                      <pre className="text-left text-sm whitespace-pre-wrap font-mono">
                        {document.ocrText || "This is a placeholder for the actual text content. In a real implementation, this would display the decrypted text file content with proper formatting and line breaks."}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center mb-8">
                    <FileIcon className={`w-16 h-16 ${fileColor} mx-auto mb-4`} />
                    <h2 className="text-2xl font-bold mb-2">{document.name}</h2>
                    <p className="text-muted-foreground mb-4">Document File ({document.type.toUpperCase()})</p>
                    <div className="bg-muted p-8 rounded-lg border-2 border-dashed border-border">
                      <p className="text-muted-foreground mb-4">Generic Document Viewer Placeholder</p>
                      <p className="text-sm text-muted-foreground">
                        This file type is supported but requires a specialized viewer. In a real implementation,
                        this would display the appropriate viewer for the file type or provide download functionality.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* OCR Text and Metadata for all document types */}
                {(document.ocrText || document.metadata) && (
                  <div className="mt-8 space-y-6">
                    {document.ocrText && (
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Extracted Text (OCR)
                        </h4>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{document.ocrText}</p>
                      </div>
                    )}
                    
                    {document.metadata && (
                      <div className="p-4 bg-primary/10 rounded-lg">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Info className="w-4 h-4" />
                          Document Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {document.metadata.title && (
                            <div>
                              <span className="font-medium">Title:</span> {document.metadata.title}
                            </div>
                          )}
                          {document.metadata.author && (
                            <div>
                              <span className="font-medium">Author:</span> {document.metadata.author}
                            </div>
                          )}
                          {document.metadata.subject && (
                            <div>
                              <span className="font-medium">Subject:</span> {document.metadata.subject}
                            </div>
                          )}
                          {document.metadata.keywords && document.metadata.keywords.length > 0 && (
                            <div>
                              <span className="font-medium">Keywords:</span> {document.metadata.keywords.join(', ')}
                            </div>
                          )}
                          {document.metadata.created && (
                            <div>
                              <span className="font-medium">Created:</span> {document.metadata.created.toLocaleDateString()}
                            </div>
                          )}
                          {document.metadata.modified && (
                            <div>
                              <span className="font-medium">Modified:</span> {document.metadata.modified.toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Zoom: {zoom}%</span>
              {rotation > 0 && <span>Rotation: {rotation}°</span>}
              {searchResults.length > 0 && (
                <span>Search results: {searchResults.length} found</span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {document.type === 'pdf' && (
                <Badge variant="outline">PDF Document</Badge>
              )}
              {document.ocrText && (
                <Badge variant="outline">OCR Available</Badge>
              )}
              {isBookmarked && (
                <Badge variant="outline">Bookmarked</Badge>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}