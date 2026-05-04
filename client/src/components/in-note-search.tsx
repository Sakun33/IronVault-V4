import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

interface InNoteSearchProps {
  open: boolean;
  /** Editor element to search inside. */
  editor: HTMLDivElement | null;
  onClose: () => void;
}

interface MatchHandle {
  range: Range;
  span: HTMLSpanElement;
}

/**
 * Cmd+F-style in-note search. Wraps every match in a span.iv-search-match
 * and tracks the active one with .iv-search-active. On close all wrappers
 * are unwrapped so the underlying contentEditable returns to its original
 * state — no lingering markers in the saved HTML.
 */
export function InNoteSearch({ open, editor, onClose }: InNoteSearchProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<MatchHandle[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastWrapsRef = useRef<HTMLSpanElement[]>([]);

  // Clear all match wrappers
  const clearWraps = () => {
    for (const span of lastWrapsRef.current) {
      const parent = span.parentNode;
      if (!parent) continue;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    }
    lastWrapsRef.current = [];
    // Normalize so adjacent text nodes merge — keeps subsequent searches sane.
    if (editor) editor.normalize();
  };

  // Re-find matches whenever the query changes
  useEffect(() => {
    if (!open || !editor) return;
    clearWraps();
    setMatches([]);
    setActive(0);
    const q = query.trim();
    if (!q) return;

    const found: MatchHandle[] = [];
    const lower = q.toLowerCase();
    // Walk text nodes; skip script/style + wrappers we previously inserted
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = node.nodeValue;
        if (!text) return NodeFilter.FILTER_SKIP;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_SKIP;
        if (parent.classList.contains('iv-search-match')) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT', 'STYLE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return text.toLowerCase().includes(lower) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    const wraps: HTMLSpanElement[] = [];
    const nodes: Text[] = [];
    let node: Node | null = walker.nextNode();
    while (node) { nodes.push(node as Text); node = walker.nextNode(); }

    for (const text of nodes) {
      const value = text.nodeValue || '';
      const lowerValue = value.toLowerCase();
      let cursor = 0;
      const segments: Array<Text | HTMLSpanElement> = [];
      while (cursor < value.length) {
        const idx = lowerValue.indexOf(lower, cursor);
        if (idx === -1) {
          segments.push(document.createTextNode(value.slice(cursor)));
          break;
        }
        if (idx > cursor) segments.push(document.createTextNode(value.slice(cursor, idx)));
        const span = document.createElement('span');
        span.className = 'iv-search-match';
        span.textContent = value.slice(idx, idx + lower.length);
        segments.push(span);
        wraps.push(span);
        const range = document.createRange();
        range.selectNodeContents(span);
        found.push({ range, span });
        cursor = idx + lower.length;
      }
      // Replace the original text node with the spliced sequence
      const fragment = document.createDocumentFragment();
      for (const s of segments) fragment.appendChild(s);
      text.parentNode?.replaceChild(fragment, text);
    }

    lastWrapsRef.current = wraps;
    setMatches(found);
    setActive(found.length ? 0 : 0);
    return () => { /* per-render cleanup is in clearWraps */ };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  // Move .iv-search-active highlight as the active index changes
  useEffect(() => {
    if (!matches.length) return;
    matches.forEach((m, i) => {
      m.span.classList.toggle('iv-search-active', i === active);
      if (i === active) {
        m.span.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }, [active, matches]);

  // Auto-focus on open, cleanup on close
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      clearWraps();
      setQuery('');
      setMatches([]);
      setActive(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup on unmount
  useEffect(() => () => clearWraps(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = matches.length;
  const summary = useMemo(() => total ? `${active + 1} / ${total}` : (query ? '0 / 0' : ''), [active, total, query]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16 }}
          className="absolute right-3 top-12 z-[6] flex items-center gap-1 px-2 py-1.5 rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
          role="search"
        >
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Find in note"
            aria-label="Find in note"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) setActive(a => (total ? (a - 1 + total) % total : 0));
                else setActive(a => (total ? (a + 1) % total : 0));
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            className="bg-transparent border-0 outline-none text-sm w-40 placeholder:text-muted-foreground/50"
          />
          <span className="text-[11px] text-muted-foreground/70 tabular-nums px-1 min-w-[42px] text-center">{summary}</span>
          <button
            type="button"
            aria-label="Previous match"
            onClick={() => setActive(a => total ? (a - 1 + total) % total : 0)}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] disabled:opacity-30"
            disabled={!total}
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next match"
            onClick={() => setActive(a => total ? (a + 1) % total : 0)}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] disabled:opacity-30"
            disabled={!total}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <span className="w-px h-5 bg-border/60 mx-0.5" aria-hidden />
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
