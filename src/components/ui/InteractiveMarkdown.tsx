import React from 'react';
import { cn } from '../../lib/utils';

interface InteractiveMarkdownProps {
  content: string;
  onUpdate: (newContent: string) => void;
  className?: string;
}

interface SimpleMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Toggles the N-th checkbox in the markdown source.
 * Focuses specifically on GFM task list markers at the start of lines.
 */
function toggleCheckboxInMarkdown(text: string, indexToToggle: number): string {
  let count = 0;
  
  // GFM task list regex: matches markers like "- [ ]", "* [x]", "1. [ ]" at start of line
  // or after some indentation. Safely runs on WebKit/Safari.
  return text.replace(/^(\s*([-*+]|\d+\.))\s*\[([ xX])\]/gm, (match, prefix, bullet, char) => {
    if (count === indexToToggle) {
      count++;
      return `${prefix} [${char === ' ' ? 'x' : ' '}]`;
    }
    count++;
    return match;
  });
}

export function parseMarkdown(text: string, onToggleCheckbox?: (index: number) => void): React.ReactNode {
  if (!text) return null;
  
  // Split the text into lines
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inCodeBlock = false;
  let codeLines: string[] = [];
  
  let currentList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;
  let checkboxIndex = 0;

  const flushList = () => {
    if (currentList) {
      const ListTag = currentList.type;
      const key = `list-${elements.length}`;
      elements.push(
        <ListTag key={key} className={ListTag === 'ul' ? 'list-disc pl-5 my-2 space-y-1' : 'list-decimal pl-5 my-2 space-y-1'}>
          {currentList.items}
        </ListTag>
      );
      currentList = null;
    }
  };

  const parseInlineElements = (inlineText: string, lineKey: string): React.ReactNode => {
    let parts: { type: 'text' | 'bold' | 'italic' | 'code' | 'link'; text: string; url?: string }[] = [{ type: 'text', text: inlineText }];
    
    // Process code blocks first: `code`
    let nextParts: typeof parts = [];
    for (const part of parts) {
      if (part.type === 'text') {
        const subparts = part.text.split(/(`[^`\n]+`)/g);
        for (const sub of subparts) {
          if (sub.startsWith('`') && sub.endsWith('`')) {
            nextParts.push({ type: 'code', text: sub.slice(1, -1) });
          } else if (sub) {
            nextParts.push({ type: 'text', text: sub });
          }
        }
      } else {
        nextParts.push(part);
      }
    }
    parts = nextParts;

    // Process links next: [label](url)
    nextParts = [];
    for (const part of parts) {
      if (part.type === 'text') {
        const subparts = part.text.split(/(\[[^\]\n]+\]\([^)\n]+\))/g);
        for (const sub of subparts) {
          const match = sub.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          if (match) {
            nextParts.push({ type: 'link', text: match[1], url: match[2] });
          } else if (sub) {
            nextParts.push({ type: 'text', text: sub });
          }
        }
      } else {
        nextParts.push(part);
      }
    }
    parts = nextParts;

    // Process Bold next: **text**
    nextParts = [];
    for (const part of parts) {
      if (part.type === 'text') {
        const subparts = part.text.split(/(\*\*[^*\n]+\*\*)/g);
        for (const sub of subparts) {
          if (sub.startsWith('**') && sub.endsWith('**')) {
            nextParts.push({ type: 'bold', text: sub.slice(2, -2) });
          } else if (sub) {
            nextParts.push({ type: 'text', text: sub });
          }
        }
      } else {
        nextParts.push(part);
      }
    }
    parts = nextParts;

    // Process Italic next: *text*
    nextParts = [];
    for (const part of parts) {
      if (part.type === 'text') {
        const subparts = part.text.split(/(\*[^*\n]+\*)/g);
        for (const sub of subparts) {
          if (sub.startsWith('*') && sub.endsWith('*')) {
            nextParts.push({ type: 'italic', text: sub.slice(1, -1) });
          } else if (sub) {
            nextParts.push({ type: 'text', text: sub });
          }
        }
      } else {
        nextParts.push(part);
      }
    }
    parts = nextParts;

    return (
      <span key={lineKey}>
        {parts.map((p, idx) => {
          const key = `${lineKey}-${idx}`;
          if (p.type === 'bold') {
            return <strong key={key} className="font-bold text-neutral-900">{p.text}</strong>;
          }
          if (p.type === 'italic') {
            return <em key={key} className="italic text-neutral-700">{p.text}</em>;
          }
          if (p.type === 'code') {
            return <code key={key} className="bg-neutral-150 font-mono text-[11px] px-1 py-0.5 rounded text-neutral-800">{p.text}</code>;
          }
          if (p.type === 'link') {
            return (
              <a key={key} href={p.url} target="_blank" rel="noopener noreferrer" className="text-theme-primary hover:underline font-bold">
                {p.text}
              </a>
            );
          }
          return p.text;
        })}
      </span>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const key = `md-${i}`;

    // Handle code blocks
    if (rawLine.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        const codeText = codeLines.join('\n');
        elements.push(
          <pre key={key} className="bg-neutral-900 text-neutral-100 p-3 rounded-xl overflow-x-auto my-2 font-mono text-xs">
            <code>{codeText}</code>
          </pre>
        );
        inCodeBlock = false;
        codeLines = [];
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    // Headers
    if (rawLine.startsWith('# ')) {
      flushList();
      elements.push(<h1 key={key} className="text-base sm:text-lg font-bold my-2 text-neutral-900 border-b border-neutral-100 pb-0.5">{parseInlineElements(rawLine.slice(2), key)}</h1>);
      continue;
    }
    if (rawLine.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={key} className="text-xs sm:text-sm font-bold my-1.5 text-neutral-900">{parseInlineElements(rawLine.slice(3), key)}</h2>);
      continue;
    }
    if (rawLine.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={key} className="text-[11px] sm:text-xs font-bold my-1 text-neutral-800">{parseInlineElements(rawLine.slice(4), key)}</h3>);
      continue;
    }

    // Blockquotes
    if (rawLine.trim().startsWith('>')) {
      flushList();
      const content = rawLine.trim().replace(/^>\s*/, '');
      elements.push(
        <blockquote key={key} className="border-l-2 border-neutral-300 pl-3 italic text-neutral-600 my-1">
          {parseInlineElements(content, key)}
        </blockquote>
      );
      continue;
    }

    // Horizontal Rule
    if (['---', '***', '___'].includes(rawLine.trim())) {
      flushList();
      elements.push(<hr key={key} className="my-2 border-t border-neutral-150" />);
      continue;
    }

    // GFM Task Lists Checkboxes: "- [ ]", "- [x]", "* [ ]", "* [x]"
    const checkboxMatch = rawLine.match(/^(\s*)([-*+])\s+\[([ xX])\]\s*(.*)$/);
    if (checkboxMatch) {
      flushList();
      const checked = checkboxMatch[3].toLowerCase() === 'x';
      const textContent = checkboxMatch[4];
      const index = checkboxIndex++;
      
      elements.push(
        <div key={key} className="flex items-start gap-2 my-1 select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => {
              if (onToggleCheckbox) {
                onToggleCheckbox(index);
              }
            }}
            className="mt-0.5 cursor-pointer h-3.5 w-3.5 rounded border-gray-300 text-theme-primary focus:ring-theme-primary"
          />
          <span className={cn("text-xs sm:text-sm leading-relaxed", checked ? "line-through text-neutral-400" : "text-neutral-800")}>
            {parseInlineElements(textContent, key)}
          </span>
        </div>
      );
      continue;
    }

    // Unordered Lists: "- ", "* ", "+ "
    const ulMatch = rawLine.match(/^(\s*)([-*+])\s+(.*)$/);
    if (ulMatch) {
      const textContent = ulMatch[3];
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(
        <li key={`li-${i}`} className="text-xs sm:text-sm text-neutral-800 leading-relaxed list-disc ml-4">
          {parseInlineElements(textContent, `li-content-${i}`)}
        </li>
      );
      continue;
    }

    // Ordered Lists: "1. ", "12. "
    const olMatch = rawLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const textContent = olMatch[3];
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(
        <li key={`li-${i}`} className="text-xs sm:text-sm text-neutral-800 leading-relaxed list-decimal ml-4">
          {parseInlineElements(textContent, `li-content-${i}`)}
        </li>
      );
      continue;
    }

    // Empty lines
    if (!rawLine.trim()) {
      flushList();
      elements.push(<div key={key} className="h-1" />);
      continue;
    }

    // Standard Paragraph
    flushList();
    elements.push(
      <p key={key} className="text-xs sm:text-sm text-neutral-800 leading-relaxed my-0.5">
        {parseInlineElements(rawLine, key)}
      </p>
    );
  }

  flushList();

  return <>{elements}</>;
}

export default function InteractiveMarkdown({ content, onUpdate, className }: InteractiveMarkdownProps) {
  const handleToggle = (index: number) => {
    const updated = toggleCheckboxInMarkdown(content, index);
    onUpdate(updated);
  };

  return (
    <div className={cn("markdown-body", className)}>
      {parseMarkdown(content, handleToggle)}
    </div>
  );
}

export function SimpleMarkdown({ content, className }: SimpleMarkdownProps) {
  return (
    <div className={cn("markdown-body", className)}>
      {parseMarkdown(content)}
    </div>
  );
}
