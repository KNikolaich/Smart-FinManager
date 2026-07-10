import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';

export function useGlobalInputContextMenu() {
  const [globalContextMenu, setGlobalContextMenu] = useState<{ x: number, y: number, items: any[] } | null>(null);

  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();

      const target = e.target as HTMLElement;
      const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

      if (isInput) {
        const input = target as HTMLInputElement | HTMLTextAreaElement;

        const items = [
          {
            label: 'Выделить всё',
            icon: Wallet,
            onClick: () => {
              input.focus();
              input.select();
            }
          },
          {
            label: 'Копировать',
            divider: true,
            onClick: async () => {
              const text = input.value.substring(input.selectionStart || 0, input.selectionEnd || 0);
              if (text) await navigator.clipboard.writeText(text);
            }
          },
          {
            label: 'Вырезать',
            onClick: async () => {
              const start = input.selectionStart || 0;
              const end = input.selectionEnd || 0;
              const text = input.value.substring(start, end);
              if (text) {
                await navigator.clipboard.writeText(text);
                const newValue = input.value.substring(0, start) + input.value.substring(end);
                input.value = newValue;
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
              }
            }
          },
          {
            label: 'Вставить',
            onClick: async () => {
              try {
                const text = await navigator.clipboard.readText();
                const start = input.selectionStart || 0;
                const end = input.selectionEnd || 0;
                const newValue = input.value.substring(0, start) + text + input.value.substring(end);
                input.value = newValue;
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
                const newPos = start + text.length;
                input.setSelectionRange(newPos, newPos);
              } catch (err) {
                console.error('Failed to read clipboard:', err);
              }
            }
          },
          {
            label: 'Удалить',
            variant: 'danger',
            onClick: () => {
              const start = input.selectionStart || 0;
              const end = input.selectionEnd || 0;
              if (start !== end) {
                const newValue = input.value.substring(0, start) + input.value.substring(end);
                input.value = newValue;
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
                input.setSelectionRange(start, start);
              }
            }
          }
        ];

        setGlobalContextMenu({ x: e.clientX, y: e.clientY, items });
      }
    };

    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => window.removeEventListener('contextmenu', handleGlobalContextMenu);
  }, []);

  return { globalContextMenu, closeGlobalContextMenu: () => setGlobalContextMenu(null) };
}
