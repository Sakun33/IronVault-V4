import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Table,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  Minus,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Save,
  Eye,
  FileText,
  Palette,
  MoreHorizontal,
  Paintbrush,
  Highlighter,
  Text,
  Superscript,
  Subscript,
  Indent,
  Outdent,
  Columns,
  Layout,
  Shapes,
  Zap,
  Sparkles,
  BookOpen,
  FileImage,
  Upload,
  Download,
  Search,
  Replace,
  SpellCheck,
  Languages,
  Settings,
  Maximize,
  Minimize
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showPreview?: boolean;
  onSave?: () => void;
  enableAdvancedFeatures?: boolean;
  enableSpellCheck?: boolean;
  enableAutoSave?: boolean;
  maxLength?: number;
  wordCount?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ 
  onClick, 
  isActive, 
  disabled, 
  children, 
  title 
}) => (
  <Button
    variant={isActive ? "default" : "ghost"}
    size="sm"
    onClick={onClick}
    disabled={disabled}
    className="h-8 w-8 p-0"
    title={title}
  >
    {children}
  </Button>
);

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Start writing...",
  className,
  showPreview = true,
  onSave,
  enableAdvancedFeatures = true,
  enableSpellCheck = true,
  enableAutoSave = true,
  maxLength,
  wordCount = true
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [fontSize, setFontSize] = useState('16');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [textColor, setTextColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [currentWordCount, setCurrentWordCount] = useState(0);
  const [currentCharCount, setCurrentCharCount] = useState(0);
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(enableSpellCheck);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 });
  const [currentWord, setCurrentWord] = useState('');

  // Common text suggestions/phrases
  const commonPhrases: Record<string, string[]> = {
    'meeting': ['Meeting scheduled for', 'Meeting notes:', 'Meeting agenda:'],
    'todo': ['TODO:', '[ ] Task item', '- [ ] Checkbox item'],
    'note': ['Note:', 'Important note:', 'Please note that'],
    'action': ['Action items:', 'Next steps:', 'Follow-up required:'],
    'date': [new Date().toLocaleDateString(), new Date().toLocaleString(), 'Due date:'],
    'email': ['Dear ', 'Best regards,', 'Thank you for your email'],
    'list': ['• Item 1\n• Item 2\n• Item 3', '1. First\n2. Second\n3. Third'],
    'table': ['| Column 1 | Column 2 |\n|----------|----------|\n| Data | Data |'],
    'code': ['```\ncode here\n```', '`inline code`'],
    'link': ['[text](url)', 'https://'],
    'heading': ['# Heading 1', '## Heading 2', '### Heading 3'],
    'important': ['⚠️ Important:', '🔴 Critical:', '⭐ Key point:'],
    'checkbox': ['☐ Unchecked', '☑ Checked', '✓ Done'],
  };

  // Update history when value changes
  useEffect(() => {
    if (value !== history[historyIndex]) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(value);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [value]);

  // Auto-save functionality - DISABLED to prevent modal closing
  // useEffect(() => {
  //   if (enableAutoSave && onSave) {
  //     const timer = setTimeout(() => {
  //       onSave();
  //     }, 2000); // Auto-save every 2 seconds
  //     return () => clearTimeout(timer);
  //   }
  // }, [value, enableAutoSave, onSave]);

  // Word and character count
  useEffect(() => {
    if (wordCount) {
      const text = editorRef.current?.textContent || '';
      setCurrentWordCount(text.trim().split(/\s+/).filter(word => word.length > 0).length);
      setCurrentCharCount(text.length);
    }
  }, [value, wordCount]);

  // Set initial content and handle value changes
  useEffect(() => {
    if (editorRef.current && !isPreviewMode) {
      // Only update if the content is different to avoid cursor issues
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value, isPreviewMode]);

  const execCommand = (command: string, value?: string) => {
    // Focus the editor first
    editorRef.current?.focus();
    
    // Execute the command
    const success = document.execCommand(command, false, value);
    
    // Ensure cursor is positioned correctly after command
    if (success) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // Ensure cursor is at the end of the selection
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    
    updateContent();
  };

  const updateContent = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      onChange(content);
    }
  };

  const insertTextAtCursor = (text: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      // Position cursor after the inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      updateContent();
    }
  };

  const insertText = (text: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      // Move cursor to end of inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    updateContent();
  };

  const insertMarkdown = (before: string, after: string = '', placeholder: string = 'text') => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      const text = selectedText || placeholder;
      range.deleteContents();
      const textNode = document.createTextNode(`${before}${text}${after}`);
      range.insertNode(textNode);
      // Move cursor to end of inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    updateContent();
  };

  const insertTable = () => {
    const tableHtml = `
      <table class="border-collapse border border-border w-full">
        <thead>
          <tr>
            <th class="border border-border p-2 bg-muted">Header 1</th>
            <th class="border border-border p-2 bg-muted">Header 2</th>
            <th class="border border-border p-2 bg-muted">Header 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="border border-gray-300 p-2">Data 1</td>
            <td class="border border-gray-300 p-2">Data 2</td>
            <td class="border border-gray-300 p-2">Data 3</td>
          </tr>
          <tr>
            <td class="border border-gray-300 p-2">Data 4</td>
            <td class="border border-gray-300 p-2">Data 5</td>
            <td class="border border-gray-300 p-2">Data 6</td>
          </tr>
        </tbody>
      </table>
    `;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = tableHtml;
      range.insertNode(tempDiv.firstChild!);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    updateContent();
  };

  const insertChecklist = () => {
    const checklistHtml = `
      <div class="checklist-container" style="margin: 10px 0;">
        <div class="checklist-item" style="display: flex; align-items: flex-start; margin: 8px 0; padding: 4px;">
          <input type="checkbox" class="checklist-checkbox" style="margin-right: 8px; margin-top: 2px; flex-shrink: 0;" />
          <div contenteditable="true" class="checklist-text" style="flex: 1; min-height: 20px; outline: none;">Checklist item 1</div>
        </div>
        <div class="checklist-item" style="display: flex; align-items: flex-start; margin: 8px 0; padding: 4px;">
          <input type="checkbox" class="checklist-checkbox" style="margin-right: 8px; margin-top: 2px; flex-shrink: 0;" />
          <div contenteditable="true" class="checklist-text" style="flex: 1; min-height: 20px; outline: none;">Checklist item 2</div>
        </div>
        <div class="checklist-item" style="display: flex; align-items: flex-start; margin: 8px 0; padding: 4px;">
          <input type="checkbox" class="checklist-checkbox" style="margin-right: 8px; margin-top: 2px; flex-shrink: 0;" />
          <div contenteditable="true" class="checklist-text" style="flex: 1; min-height: 20px; outline: none;">Checklist item 3</div>
        </div>
      </div>
    `;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = checklistHtml;
      const checklistElement = tempDiv.firstChild as HTMLElement;
      
      // Add event listeners to checkboxes
      const checkboxes = checklistElement.querySelectorAll('.checklist-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function(this: HTMLInputElement) {
          const textElement = this.nextElementSibling as HTMLElement;
          if (textElement) {
            if (this.checked) {
              textElement.style.textDecoration = 'line-through';
              textElement.style.opacity = '0.6';
              textElement.style.backgroundColor = '#f0f0f0';
            } else {
              textElement.style.textDecoration = 'none';
              textElement.style.opacity = '1';
              textElement.style.backgroundColor = 'transparent';
            }
          }
        });
      });
      
      range.insertNode(checklistElement);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    updateContent();
  };

  const insertFlowChart = () => {
    const flowChartHtml = `
      <div class="flow-chart p-4 border-2 border-dashed border-border rounded-lg">
        <div class="text-center mb-4">
          <h3 class="font-bold">Flow Chart</h3>
          <p class="text-sm text-muted-foreground">Click to edit</p>
        </div>
        <div class="flex flex-col items-center space-y-4">
          <div class="bg-primary/10 border-2 border-primary/30 rounded-lg p-3 min-w-[200px] text-center">
            <strong>Start</strong>
          </div>
          <div class="text-muted-foreground">↓</div>
          <div class="bg-green-100 border-2 border-green-300 rounded-lg p-3 min-w-[200px] text-center">
            <strong>Process</strong>
          </div>
          <div class="text-muted-foreground">↓</div>
          <div class="bg-red-100 border-2 border-red-300 rounded-lg p-3 min-w-[200px] text-center">
            <strong>End</strong>
          </div>
        </div>
      </div>
    `;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = flowChartHtml;
      range.insertNode(tempDiv.firstChild!);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    updateContent();
  };

  // Advanced functions
  const changeFontSize = (size: string) => {
    execCommand('fontSize', '7'); // Use fontSize 7 for custom sizing
    if (editorRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = `${size}px`;
        span.innerHTML = range.toString() || 'Text';
        range.deleteContents();
        range.insertNode(span);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    updateContent();
  };

  const changeFontFamily = (family: string) => {
    execCommand('fontName', family);
  };

  const changeTextColor = (color: string) => {
    execCommand('foreColor', color);
  };

  const changeBackgroundColor = (color: string) => {
    execCommand('backColor', color);
  };

  const insertSuperscript = () => {
    execCommand('superscript');
  };

  const insertSubscript = () => {
    execCommand('subscript');
  };

  const indentText = () => {
    execCommand('indent');
  };

  const outdentText = () => {
    execCommand('outdent');
  };

  const insertColumns = () => {
    const columnsHtml = `
      <div class="columns-container" style="display: flex; gap: 20px; margin: 10px 0;">
        <div class="column" style="flex: 1; border: 1px dashed #ccc; padding: 10px; min-height: 100px;">
          <p>Column 1</p>
        </div>
        <div class="column" style="flex: 1; border: 1px dashed #ccc; padding: 10px; min-height: 100px;">
          <p>Column 2</p>
        </div>
      </div>
    `;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = columnsHtml;
      range.insertNode(tempDiv.firstChild!);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    updateContent();
  };

  const findAndReplace = () => {
    if (!findText) return;
    
    const editor = editorRef.current;
    if (!editor) return;
    
    const content = editor.innerHTML;
    const newContent = content.replace(new RegExp(findText, 'gi'), replaceText);
    editor.innerHTML = newContent;
    updateContent();
  };

  const insertCodeBlock = () => {
    const codeBlockHtml = `
      <pre class="code-block" style="background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin: 10px 0; font-family: 'Courier New', monospace; overflow-x: auto;">
        <code>// Your code here</code>
      </pre>
    `;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = codeBlockHtml;
      range.insertNode(tempDiv.firstChild!);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    updateContent();
  };

  const insertMathFormula = () => {
    const mathHtml = `
      <div class="math-formula" style="background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin: 10px 0; text-align: center;">
        <span style="font-family: 'Times New Roman', serif; font-size: 18px;">E = mc²</span>
      </div>
    `;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = mathHtml;
      range.insertNode(tempDiv.firstChild!);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    updateContent();
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  };

  const togglePreview = () => {
    setIsPreviewMode(!isPreviewMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          break;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          break;
        case 's':
          e.preventDefault();
          onSave?.();
          break;
      }
    }
  };

  const handleInput = (e: React.FormEvent) => {
    // Small delay to ensure DOM is updated
    setTimeout(() => {
      updateContent();
      checkForSuggestions();
    }, 0);
  };

  // Check for word suggestions as user types
  const checkForSuggestions = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const text = range.startContainer.textContent || '';
    const cursorPos = range.startOffset;
    
    // Get the current word being typed
    const textBeforeCursor = text.substring(0, cursorPos);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1].toLowerCase();
    
    if (lastWord.length >= 2) {
      // Find matching suggestions
      const matchingSuggestions: string[] = [];
      Object.keys(commonPhrases).forEach(key => {
        if (key.startsWith(lastWord)) {
          matchingSuggestions.push(...commonPhrases[key]);
        }
      });
      
      if (matchingSuggestions.length > 0) {
        setCurrentWord(lastWord);
        setSuggestions(matchingSuggestions.slice(0, 5));
        
        // Get position for suggestions dropdown
        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current?.getBoundingClientRect();
        if (editorRect) {
          setSuggestionPosition({
            top: rect.bottom - editorRect.top + 5,
            left: rect.left - editorRect.left
          });
        }
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  // Insert suggestion
  const insertSuggestion = (suggestion: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const text = range.startContainer.textContent || '';
    const cursorPos = range.startOffset;
    
    // Find the start of the current word
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
    const wordStart = lastSpaceIndex + 1;
    
    // Replace the current word with the suggestion
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.startContainer as Text;
      const before = text.substring(0, wordStart);
      const after = text.substring(cursorPos);
      textNode.textContent = before + suggestion + after;
      
      // Move cursor to end of inserted suggestion
      const newRange = document.createRange();
      newRange.setStart(textNode, (before + suggestion).length);
      newRange.setEnd(textNode, (before + suggestion).length);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    
    setShowSuggestions(false);
    updateContent();
  };

  const toolbarButtons = [
    // History
    { icon: <Undo className="w-4 h-4" />, action: undo, title: "Undo (Ctrl+Z)", disabled: historyIndex <= 0 },
    { icon: <Redo className="w-4 h-4" />, action: redo, title: "Redo (Ctrl+Shift+Z)", disabled: historyIndex >= history.length - 1 },
    
    // Separator
    { separator: true },
    
    // Text formatting
    { icon: <Bold className="w-4 h-4" />, action: () => execCommand('bold'), title: "Bold (Ctrl+B)" },
    { icon: <Italic className="w-4 h-4" />, action: () => execCommand('italic'), title: "Italic (Ctrl+I)" },
    { icon: <Underline className="w-4 h-4" />, action: () => execCommand('underline'), title: "Underline (Ctrl+U)" },
    { icon: <Strikethrough className="w-4 h-4" />, action: () => execCommand('strikeThrough'), title: "Strikethrough" },
    
    // Separator
    { separator: true },
    
    // Headings
    { icon: <Heading1 className="w-4 h-4" />, action: () => insertMarkdown('# ', '', 'Heading 1'), title: "Heading 1" },
    { icon: <Heading2 className="w-4 h-4" />, action: () => insertMarkdown('## ', '', 'Heading 2'), title: "Heading 2" },
    { icon: <Heading3 className="w-4 h-4" />, action: () => insertMarkdown('### ', '', 'Heading 3'), title: "Heading 3" },
    
    // Separator
    { separator: true },
    
    // Lists
    { icon: <List className="w-4 h-4" />, action: () => execCommand('insertUnorderedList'), title: "Bullet List" },
    { icon: <ListOrdered className="w-4 h-4" />, action: () => execCommand('insertOrderedList'), title: "Numbered List" },
    { icon: <CheckSquare className="w-4 h-4" />, action: insertChecklist, title: "Checklist" },
    
    // Separator
    { separator: true },
    
    // Special elements
    { icon: <Quote className="w-4 h-4" />, action: () => insertMarkdown('> ', '', 'Quote'), title: "Quote" },
    { icon: <Code className="w-4 h-4" />, action: () => insertMarkdown('`', '`', 'code'), title: "Inline Code" },
    { icon: <Table className="w-4 h-4" />, action: insertTable, title: "Table" },
    { icon: <Minus className="w-4 h-4" />, action: () => insertMarkdown('---\n'), title: "Horizontal Rule" },
    
    // Separator
    { separator: true },
    
    // Links and media
    { icon: <Link className="w-4 h-4" />, action: () => execCommand('createLink', prompt('Enter URL:') || ''), title: "Link" },
    { icon: <Image className="w-4 h-4" />, action: () => execCommand('insertImage', prompt('Enter image URL:') || ''), title: "Image" },
    
    // Separator
    { separator: true },
    
    // Alignment
    { icon: <AlignLeft className="w-4 h-4" />, action: () => execCommand('justifyLeft'), title: "Align Left" },
    { icon: <AlignCenter className="w-4 h-4" />, action: () => execCommand('justifyCenter'), title: "Align Center" },
    { icon: <AlignRight className="w-4 h-4" />, action: () => execCommand('justifyRight'), title: "Align Right" },
    
    // Separator
    { separator: true },
    
    // Special features
    { icon: <Type className="w-4 h-4" />, action: insertFlowChart, title: "Flow Chart" },
    
    // Advanced features (if enabled)
    ...(enableAdvancedFeatures ? [
      { separator: true },
      { icon: <Superscript className="w-4 h-4" />, action: insertSuperscript, title: "Superscript" },
      { icon: <Subscript className="w-4 h-4" />, action: insertSubscript, title: "Subscript" },
      { icon: <Indent className="w-4 h-4" />, action: indentText, title: "Indent" },
      { icon: <Outdent className="w-4 h-4" />, action: outdentText, title: "Outdent" },
      { icon: <Columns className="w-4 h-4" />, action: insertColumns, title: "Columns" },
      { icon: <BookOpen className="w-4 h-4" />, action: insertCodeBlock, title: "Code Block" },
      { icon: <Zap className="w-4 h-4" />, action: insertMathFormula, title: "Math Formula" },
    ] : []),
  ];

  return (
    <Card className={cn("w-full", className)}>
      {/* Toolbar */}
      <div className="border-b p-2">
        <div className="flex flex-wrap items-center gap-1">
          {toolbarButtons.map((button, index) => {
            if (button.separator) {
              return <Separator key={index} orientation="vertical" className="h-6 mx-1" />;
            }
            return (
              <ToolbarButton
                key={index}
                onClick={button.action || (() => {})}
                disabled={button.disabled}
                title={button.title || ''}
              >
                {button.icon}
              </ToolbarButton>
            );
          })}
          
          {enableAdvancedFeatures && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <ToolbarButton
                onClick={() => setShowAdvancedTools(!showAdvancedTools)}
                isActive={showAdvancedTools}
                title="Advanced Tools"
              >
                <Settings className="w-4 h-4" />
              </ToolbarButton>
            </>
          )}
          
          {showPreview && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <ToolbarButton
                onClick={togglePreview}
                isActive={isPreviewMode}
                title="Toggle Preview"
              >
                {isPreviewMode ? <FileText className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </ToolbarButton>
            </>
          )}
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          <ToolbarButton
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </ToolbarButton>
          
          {onSave && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <ToolbarButton
                onClick={onSave}
                title="Save (Ctrl+S)"
              >
                <Save className="w-4 h-4" />
              </ToolbarButton>
            </>
          )}
        </div>
        
        {/* Advanced Tools Panel */}
        {showAdvancedTools && enableAdvancedFeatures && (
          <div className="mt-2 pt-2 border-t">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="fontSize" className="text-xs">Font Size:</Label>
                <Select value={fontSize} onValueChange={setFontSize}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12px</SelectItem>
                    <SelectItem value="14">14px</SelectItem>
                    <SelectItem value="16">16px</SelectItem>
                    <SelectItem value="18">18px</SelectItem>
                    <SelectItem value="20">20px</SelectItem>
                    <SelectItem value="24">24px</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => changeFontSize(fontSize)}>
                  Apply
                </Button>
              </div>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center gap-2">
                <Label htmlFor="fontFamily" className="text-xs">Font:</Label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                    <SelectItem value="Courier New">Courier New</SelectItem>
                    <SelectItem value="Georgia">Georgia</SelectItem>
                    <SelectItem value="Verdana">Verdana</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => changeFontFamily(fontFamily)}>
                  Apply
                </Button>
              </div>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center gap-2">
                <Label htmlFor="textColor" className="text-xs">Text Color:</Label>
                <Input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-12 h-8 p-1"
                />
                <Button size="sm" onClick={() => changeTextColor(textColor)}>
                  Apply
                </Button>
              </div>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center gap-2">
                <Label htmlFor="backgroundColor" className="text-xs">Background:</Label>
                <Input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-12 h-8 p-1"
                />
                <Button size="sm" onClick={() => changeBackgroundColor(backgroundColor)}>
                  Apply
                </Button>
              </div>
              
              <Separator orientation="vertical" className="h-6" />
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFindReplace(!showFindReplace)}
                title="Find & Replace"
              >
                <Search className="w-4 h-4" />
              </Button>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center gap-2">
                <SpellCheck className={`w-4 h-4 ${spellCheckEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                <Label htmlFor="spellcheck" className="text-xs">Autocorrect</Label>
                <Button
                  size="sm"
                  variant={spellCheckEnabled ? "default" : "outline"}
                  onClick={() => setSpellCheckEnabled(!spellCheckEnabled)}
                  title={spellCheckEnabled ? "Disable Spellcheck" : "Enable Spellcheck"}
                >
                  {spellCheckEnabled ? 'On' : 'Off'}
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Find & Replace Panel */}
        {showFindReplace && (
          <div className="mt-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Find text..."
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className="w-40"
              />
              <Input
                placeholder="Replace with..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="w-40"
              />
              <Button size="sm" onClick={findAndReplace}>
                Replace All
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Editor Content */}
      <CardContent className="p-0">
        {isPreviewMode ? (
          <div 
            className="min-h-[400px] p-4 prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        ) : (
          <div className="relative">
            <div
              ref={editorRef}
              contentEditable
              spellCheck={spellCheckEnabled}
              className="min-h-[400px] p-4 focus:outline-none prose prose-sm dark:prose-invert max-w-none"
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              data-placeholder={placeholder}
              style={{
              direction: 'ltr',
              textAlign: 'left',
              '--tw-prose-body': 'inherit',
              '--tw-prose-headings': 'inherit',
              '--tw-prose-lead': 'inherit',
              '--tw-prose-links': 'inherit',
              '--tw-prose-bold': 'inherit',
              '--tw-prose-counters': 'inherit',
              '--tw-prose-bullets': 'inherit',
              '--tw-prose-hr': 'inherit',
              '--tw-prose-quotes': 'inherit',
              '--tw-prose-quote-borders': 'inherit',
              '--tw-prose-captions': 'inherit',
              '--tw-prose-code': 'inherit',
              '--tw-prose-pre-code': 'inherit',
              '--tw-prose-pre-bg': 'inherit',
              '--tw-prose-th-borders': 'inherit',
              '--tw-prose-td-borders': 'inherit',
            } as React.CSSProperties}
            />
            
            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div 
                className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[200px]"
                style={{ top: suggestionPosition.top, left: suggestionPosition.left }}
              >
                <div className="p-1">
                  <div className="px-2 py-1 text-xs text-muted-foreground border-b mb-1">Suggestions for "{currentWord}"</div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
                      onClick={() => insertSuggestion(suggestion)}
                    >
                      {suggestion.length > 40 ? suggestion.substring(0, 40) + '...' : suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      {/* Status Bar */}
      {(wordCount || maxLength) && (
        <div className="border-t p-2 bg-muted/50">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              {wordCount && (
                <span>Words: {currentWordCount}</span>
              )}
              {wordCount && (
                <span>Characters: {currentCharCount}</span>
              )}
            </div>
            {maxLength && (
              <span className={currentCharCount > maxLength ? 'text-red-500' : ''}>
                {currentCharCount} / {maxLength}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default RichTextEditor;
