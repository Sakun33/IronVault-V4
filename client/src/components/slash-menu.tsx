import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heading1, Heading2, Heading3, List as ListBullets, ListOrdered,
  CheckSquare, Code, Quote, Minus, Calendar,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

export interface SlashCommand {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  /** Receives the TipTap editor instance so it can run chain commands. */
  apply: (editor: Editor) => void;
}

interface SlashMenuProps {
  open: boolean;
  /** CSS pixels relative to the editor surface — top-left corner of the menu. */
  position: { top: number; left: number } | null;
  query: string;
  editor: Editor | null;
  onClose: () => void;
  onCommandPicked: () => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    hint: '#',
    icon: Heading1,
    apply: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    hint: '##',
    icon: Heading2,
    apply: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    hint: '###',
    icon: Heading3,
    apply: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'ul',
    label: 'Bullet list',
    hint: '⌘⇧8',
    icon: ListBullets,
    apply: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'ol',
    label: 'Numbered list',
    hint: '⌘⇧7',
    icon: ListOrdered,
    apply: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'todo',
    label: 'Checklist',
    hint: '⌘⇧9',
    icon: CheckSquare,
    apply: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    id: 'code',
    label: 'Code block',
    icon: Code,
    apply: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'quote',
    label: 'Quote',
    icon: Quote,
    apply: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'hr',
    label: 'Divider',
    icon: Minus,
    apply: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'date',
    label: 'Date / Time',
    icon: Calendar,
    apply: (e) => e.chain().focus().insertContent(new Date().toLocaleString()).run(),
  },
];

/**
 * Floating menu that appears when the user types "/" at the start of a line.
 * Parent passes the typed query (text after the slash) for filtering.
 * Arrow / Enter / Escape are handled here as window keydowns while open.
 */
export function SlashMenu({ open, position, query, editor, onClose, onCommandPicked }: SlashMenuProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = SLASH_COMMANDS.filter(c => {
    const q = query.toLowerCase();
    return !q || c.label.toLowerCase().includes(q) || c.id.includes(q);
  });

  useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
  }, [open, query]);

  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length, activeIdx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[activeIdx];
        if (cmd && editor) {
          cmd.apply(editor);
          onCommandPicked();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, filtered, activeIdx, editor, onClose, onCommandPicked]);

  return (
    <AnimatePresence>
      {open && position && (
        <motion.div
          initial={{ opacity: 0, y: -2, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -2, scale: 0.97 }}
          transition={{ duration: 0.12 }}
          style={{ top: position.top, left: position.left }}
          className="absolute z-[5] w-56 rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-xl py-1 max-h-[280px] overflow-y-auto smooth-scrollbar"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground/60">No matches for "{query}"</div>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              const active = i === activeIdx;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    if (editor) cmd.apply(editor);
                    onCommandPicked();
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left rounded-lg transition-colors ${
                    active ? 'bg-emerald-500/10 text-emerald-200' : 'hover:bg-white/[0.05] text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm flex-1">{cmd.label}</span>
                  {cmd.hint && (
                    <span className="text-[10px] font-mono text-muted-foreground/60">{cmd.hint}</span>
                  )}
                </button>
              );
            })
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
