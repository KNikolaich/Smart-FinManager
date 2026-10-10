import React from 'react';
import { cn } from '../../lib/utils';
import { loadNoteImage } from '../../lib/noteImageStore';
export { referencedImageIds } from '../../lib/markdownImages';

interface InteractiveMarkdownProps {
  content: string;
  onUpdate: (newContent: string) => void;
  className?: string;
  /** Pictures stored next to the text, referenced as `![подпись](img:<id>)`. */
  images?: Record<string, string>;
}

interface SimpleMarkdownProps {
  content: string;
  className?: string;
  images?: Record<string, string>;
}

export interface MarkdownRenderOptions {
  images?: Record<string, string>;
}

const IMAGE_PATTERN = /(!\[[^\]\n]*\]\([^)\s]+(?:\s+"[^"\n]*")?\))/g;
const IMAGE_MATCH = /^!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"([^"\n]*)")?\)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;


/**
 * Picture placement from the optional title: `"right"`, `"center"` (no text
 * wrap), `"left"` (the default) and a width such as `"40%"`.
 */
function imageLayout(title?: string) {
  const words = (title || '').toLowerCase().split(/\s+/).filter(Boolean);
  const width = words.find(word => /^\d{1,3}%$/.test(word));
  const align = words.includes('right') ? 'right' : words.includes('center') ? 'center' : 'left';
  return { align, width };
}

/**
 * A picture of a note. `img:<id>` pictures come from the note itself (old notes
 * that still embed them) or are downloaded from the server; plain http(s) and
 * data URLs are shown as they are.
 */
function MarkdownPicture({ src, alt, title, images }: {
  src: string;
  alt: string;
  title?: string;
  images?: Record<string, string>;
}) {
  const isStored = src.startsWith('img:');
  const embedded = isStored ? images?.[src.slice(4)] : undefined;
  const direct = !isStored && /^(https?:|data:image\/)/i.test(src) ? src : undefined;
  const [loaded, setLoaded] = React.useState<string | undefined>(undefined);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!isStored || embedded) return;
    let active = true;
    setFailed(false);
    loadNoteImage(src.slice(4))
      .then(url => { if (active) setLoaded(url); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [src, isStored, embedded]);

  const resolved = embedded || direct || loaded;
  if (!resolved) {
    return (
      <span className="text-theme-muted italic" data-testid="markdown-image-missing">
        {failed || (!isStored && !direct) ? '[картинка недоступна]' : 'Загрузка картинки…'}
      </span>
    );
  }
  const { align, width } = imageLayout(title);
  return (
    <img
      src={resolved}
      alt={alt}
      title={alt || undefined}
      loading="lazy"
      data-testid="markdown-image"
      data-align={align}
      style={width ? { width } : undefined}
      className={cn(
        'rounded-xl object-contain',
        align === 'left' && 'float-left mr-3 mb-2 max-w-[45%]',
        align === 'right' && 'float-right ml-3 mb-2 max-w-[45%]',
        align === 'center' && 'mx-auto my-2 block max-w-full',
      )}
    />
  );
}

function splitTableRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
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

export function parseMarkdown(
  text: string,
  onToggleCheckbox?: (index: number) => void,
  options: MarkdownRenderOptions = {},
): React.ReactNode {
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
    let parts: { type: 'text' | 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'image'; text: string; url?: string; title?: string }[] = [{ type: 'text', text: inlineText }];
    
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

    // Pictures before links, since ![alt](src) contains link syntax
    nextParts = [];
    for (const part of parts) {
      if (part.type === 'text') {
        for (const sub of part.text.split(IMAGE_PATTERN)) {
          const match = sub.match(IMAGE_MATCH);
          if (match) {
            nextParts.push({ type: 'image', text: match[1], url: match[2], title: match[3] });
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

    // Strikethrough: ~~text~~
    nextParts = [];
    for (const part of parts) {
      if (part.type === 'text') {
        for (const sub of part.text.split(/(~~[^~\n]+~~)/g)) {
          if (sub.startsWith('~~') && sub.endsWith('~~') && sub.length > 4) {
            nextParts.push({ type: 'strike', text: sub.slice(2, -2) });
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
            return <strong key={key} className="font-bold text-theme-main">{p.text}</strong>;
          }
          if (p.type === 'italic') {
            return <em key={key} className="italic text-theme-main">{p.text}</em>;
          }
          if (p.type === 'strike') {
            return <s key={key}>{p.text}</s>;
          }
          if (p.type === 'image') {
            return <MarkdownPicture key={key} src={p.url || ''} alt={p.text} title={p.title} images={options.images} />;
          }
          if (p.type === 'code') {
            return <code key={key} className="bg-theme-main font-mono text-[11px] px-1 py-0.5 rounded text-theme-main">{p.text}</code>;
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
          <pre key={key} className="bg-theme-main text-theme-main p-3 rounded-xl overflow-x-auto my-2 font-mono text-xs">
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
      elements.push(<h1 key={key} className="text-base sm:text-lg font-bold my-2 text-theme-main border-b border-theme-base pb-0.5">{parseInlineElements(rawLine.slice(2), key)}</h1>);
      continue;
    }
    if (rawLine.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={key} className="text-xs sm:text-sm font-bold my-1.5 text-theme-main">{parseInlineElements(rawLine.slice(3), key)}</h2>);
      continue;
    }
    if (rawLine.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={key} className="text-[11px] sm:text-xs font-bold my-1 text-theme-main">{parseInlineElements(rawLine.slice(4), key)}</h3>);
      continue;
    }

    // Blockquotes
    if (rawLine.trim().startsWith('>')) {
      flushList();
      const content = rawLine.trim().replace(/^>\s*/, '');
      elements.push(
        <blockquote key={key} className="border-l-2 border-theme-base pl-3 italic text-theme-muted my-1">
          {parseInlineElements(content, key)}
        </blockquote>
      );
      continue;
    }

    // Horizontal Rule
    if (['---', '***', '___'].includes(rawLine.trim())) {
      flushList();
      elements.push(<hr key={key} className="my-2 border-t border-theme-base" />);
      continue;
    }

    // GFM tables: a header row, a |---|---| separator, then body rows
    if (rawLine.trim().startsWith('|') && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      flushList();
      const header = splitTableRow(rawLine);
      const aligns = splitTableRow(lines[i + 1]).map(cell => (
        cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : 'left'
      ));
      const body: string[][] = [];
      let next = i + 2;
      while (next < lines.length && lines[next].trim().startsWith('|')) {
        body.push(splitTableRow(lines[next]));
        next += 1;
      }
      const columns = header.length;
      const cellClass = (column: number) => cn(
        'border border-theme-base px-2 py-1 align-top',
        aligns[column] === 'center' && 'text-center',
        aligns[column] === 'right' && 'text-right',
      );
      elements.push(
        <div key={key} className="clear-both my-2 max-w-full overflow-x-auto" data-testid="markdown-table">
          <table className="border-collapse text-xs sm:text-sm text-theme-main">
            <thead>
              <tr className="bg-theme-main">
                {header.map((cell, column) => (
                  <th key={column} className={cn(cellClass(column), 'font-bold')}>{parseInlineElements(cell, `${key}-h${column}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: columns }, (_, column) => (
                    <td key={column} className={cellClass(column)}>{parseInlineElements(row[column] || '', `${key}-${rowIndex}-${column}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = next - 1;
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
        <div key={key} className="flex items-start gap-2 my-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => {
              if (onToggleCheckbox) {
                onToggleCheckbox(index);
              }
            }}
            className="mt-0.5 shrink-0 select-none cursor-pointer h-3.5 w-3.5 rounded border-theme-base text-theme-primary focus:ring-theme-primary"
          />
          <span className={cn("text-xs sm:text-sm leading-relaxed", checked ? "line-through text-theme-muted" : "text-theme-main")}>
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
        <li key={`li-${i}`} className="text-xs sm:text-sm text-theme-main leading-relaxed list-disc ml-4">
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
        <li key={`li-${i}`} className="text-xs sm:text-sm text-theme-main leading-relaxed list-decimal ml-4">
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
      <p key={key} className="text-xs sm:text-sm text-theme-main leading-relaxed my-0.5">
        {parseInlineElements(rawLine, key)}
      </p>
    );
  }

  flushList();

  return <>{elements}</>;
}

export default function InteractiveMarkdown({ content, onUpdate, className, images }: InteractiveMarkdownProps) {
  const handleToggle = (index: number) => {
    const updated = toggleCheckboxInMarkdown(content, index);
    onUpdate(updated);
  };

  return (
    <div className={cn("markdown-body flow-root", className)}>
      {parseMarkdown(content, handleToggle, { images })}
    </div>
  );
}

export function SimpleMarkdown({ content, className, images }: SimpleMarkdownProps) {
  return (
    <div className={cn("markdown-body flow-root", className)}>
      {parseMarkdown(content, undefined, { images })}
    </div>
  );
}
