import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface InteractiveMarkdownProps {
  content: string;
  onUpdate: (newContent: string) => void;
  className?: string;
}

export default function InteractiveMarkdown({ content, onUpdate, className }: InteractiveMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Find all checkboxes in the rendered output
    const checkboxes = containerRef.current.querySelectorAll('input[type="checkbox"]');
    
    const handlers: (() => void)[] = [];

    checkboxes.forEach((cb, index) => {
      // Remove disabled attribute to make it interactive as per browser defaults
      // but we'll preventDefault to handle it our way
      cb.removeAttribute('disabled');
      
      const handleClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Find the index of this checkbox in the source text that corresponds to task lists
        const newContent = toggleCheckboxInMarkdown(content, index);
        if (newContent !== content) {
          onUpdate(newContent);
        }
      };

      cb.addEventListener('click', handleClick);
      handlers.push(() => cb.removeEventListener('click', handleClick));
    });

    return () => {
      handlers.forEach(cleanup => cleanup());
    };
  }, [content, onUpdate]);

  return (
    <div ref={containerRef} className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

/**
 * Toggles the N-th checkbox in the markdown source.
 * Focuses specifically on GFM task list markers at the start of lines.
 */
function toggleCheckboxInMarkdown(text: string, indexToToggle: number): string {
  let count = 0;
  
  // GFM task list regex: matches markers like "- [ ]", "* [x]", "1. [ ]" at start of line
  // or after some indentation.
  return text.replace(/^(\s*([-*+]|\d+\.))\s*\[([ xX])\]/gm, (match, prefix, bullet, char) => {
    if (count === indexToToggle) {
      count++;
      return `${prefix} [${char === ' ' ? 'x' : ' '}]`;
    }
    count++;
    return match;
  });
}
