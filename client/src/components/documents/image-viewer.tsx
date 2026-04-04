/**
 * Image Viewer Component
 * Supports zoom, pan, and rotation for images
 * Uses semantic theme tokens for light/dark mode
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Move,
  RefreshCw,
} from 'lucide-react';

interface ImageViewerProps {
  data: ArrayBuffer | string;
  filename: string;
  mimeType: string;
}

export function ImageViewer({ data, filename, mimeType }: ImageViewerProps) {
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fitMode, setFitMode] = useState<'fit' | '1:1'>('fit');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Convert ArrayBuffer to data URL
  const imageSrc = React.useMemo(() => {
    if (typeof data === 'string') return data;
    const blob = new Blob([data], { type: mimeType });
    return URL.createObjectURL(blob);
  }, [data, mimeType]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (typeof data !== 'string' && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [data, imageSrc]);

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 5));
    setFitMode('1:1');
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
    setFitMode('1:1');
  }, []);

  const rotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setFitMode('fit');
  }, []);

  const toggleFitMode = useCallback(() => {
    if (fitMode === 'fit') {
      setFitMode('1:1');
      setScale(1);
    } else {
      setFitMode('fit');
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [fitMode]);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1 || fitMode === '1:1') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [scale, fitMode, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && (scale > 1 || fitMode === '1:1')) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  }, [scale, fitMode, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Double tap/click to zoom
  const handleDoubleClick = useCallback(() => {
    if (scale === 1 && fitMode === 'fit') {
      setScale(2);
      setFitMode('1:1');
    } else {
      resetView();
    }
  }, [scale, fitMode, resetView]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.25, Math.min(5, prev + delta)));
    setFitMode('1:1');
  }, []);

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
            variant={fitMode === 'fit' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={toggleFitMode}
            className="h-8 px-2 text-xs"
          >
            {fitMode === 'fit' ? 'Fit' : '1:1'}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={rotate} className="h-8 w-8">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={resetView} className="h-8 w-8">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden bg-muted/50 flex items-center justify-center ${
          isDragging ? 'cursor-grabbing' : scale > 1 || fitMode === '1:1' ? 'cursor-grab' : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        <img
          ref={imageRef}
          src={imageSrc}
          alt={filename}
          className={`max-w-full max-h-full select-none transition-transform duration-100 ${
            fitMode === 'fit' ? 'object-contain' : ''
          }`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
          }}
          draggable={false}
        />
      </div>

      {/* Info Badge */}
      <div className="absolute bottom-4 right-4 pointer-events-none">
        <Badge variant="secondary" className="shadow-lg">
          {fitMode === 'fit' ? 'Fit to screen' : `${Math.round(scale * 100)}%`}
        </Badge>
      </div>
    </div>
  );
}

export default ImageViewer;
