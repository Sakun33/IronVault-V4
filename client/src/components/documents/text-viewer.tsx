/**
 * Text Viewer Component
 * Displays text and markdown files with search and formatting options
 * Uses semantic theme tokens for light/dark mode
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Search,
  X,
  Code,
  Type,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface TextViewerProps {
  data: ArrayBuffer | string;
  filename: string;
  mimeType: string;
}

export function TextViewer({ data, filename, mimeType }: TextViewerProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [isMonospace, setIsMonospace] = useState<boolean>(
    mimeType === 'text/markdown' || filename.endsWith('.md')
  );
  const [currentMatch, setCurrentMatch] = useState<number>(0);
  const [fontSize, setFontSize] = useState<number>(14);

  // Convert ArrayBuffer to string
  const textContent = useMemo(() => {
    if (typeof data === 'string') return data;
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(data);
  }, [data]);

  // Search matches
  const matches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const regex = new RegExp(searchQuery, 'gi');
    const result: number[] = [];
    let match;
    while ((match = regex.exec(textContent)) !== null) {
      result.push(match.index);
    }
    return result;
  }, [textContent, searchQuery]);

  // Highlighted content
  const highlightedContent = useMemo(() => {
    if (!searchQuery.trim() || matches.length === 0) {
      return textContent;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    matches.forEach((matchIndex, i) => {
      // Add text before match
      if (matchIndex > lastIndex) {
        parts.push(textContent.slice(lastIndex, matchIndex));
      }
      
      // Add highlighted match
      const matchText = textContent.slice(matchIndex, matchIndex + searchQuery.length);
      parts.push(
        <mark
          key={i}
          className={`px-0.5 rounded ${
            i === currentMatch
              ? 'bg-primary text-primary-foreground'
              : 'bg-yellow-200 dark:bg-yellow-800 text-foreground'
          }`}
        >
          {matchText}
        </mark>
      );
      
      lastIndex = matchIndex + searchQuery.length;
    });

    // Add remaining text
    if (lastIndex < textContent.length) {
      parts.push(textContent.slice(lastIndex));
    }

    return parts;
  }, [textContent, searchQuery, matches, currentMatch]);

  const goToNextMatch = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatch(prev => (prev + 1) % matches.length);
    }
  }, [matches.length]);

  const goToPrevMatch = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatch(prev => (prev - 1 + matches.length) % matches.length);
    }
  }, [matches.length]);

  const increaseFontSize = useCallback(() => {
    setFontSize(prev => Math.min(prev + 2, 24));
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSize(prev => Math.max(prev - 2, 10));
  }, []);

  // Line count
  const lineCount = useMemo(() => {
    return textContent.split('\n').length;
  }, [textContent]);

  // Word count
  const wordCount = useMemo(() => {
    return textContent.split(/\s+/).filter(word => word.length > 0).length;
  }, [textContent]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            className="h-8 w-8"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Badge variant="outline" className="text-xs">
            {lineCount} lines • {wordCount} words
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={decreaseFontSize} className="h-8 w-8">
            <Type className="h-3 w-3" />
          </Button>
          <Badge variant="outline" className="min-w-[40px] justify-center text-xs">
            {fontSize}px
          </Badge>
          <Button variant="ghost" size="icon" onClick={increaseFontSize} className="h-8 w-8">
            <Type className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="monospace" className="text-xs text-muted-foreground">
            <Code className="h-4 w-4" />
          </Label>
          <Switch
            id="monospace"
            checked={isMonospace}
            onCheckedChange={setIsMonospace}
          />
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 p-2 border-b border-border bg-muted">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            type="text"
            placeholder="Search in document..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentMatch(0);
            }}
            className="flex-1 h-8"
            autoFocus
          />
          {matches.length > 0 && (
            <>
              <Badge variant="secondary" className="text-xs">
                {currentMatch + 1} / {matches.length}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevMatch}
                className="h-8 w-8"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextMatch}
                className="h-8 w-8"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </>
          )}
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

      {/* Text Content */}
      <div className="flex-1 overflow-auto p-4 bg-card">
        <pre
          className={`whitespace-pre-wrap break-words text-foreground ${
            isMonospace ? 'font-mono' : 'font-sans'
          }`}
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
        >
          {highlightedContent}
        </pre>
      </div>
    </div>
  );
}

export default TextViewer;
