import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InteractiveMarkdown from './InteractiveMarkdown';

describe('InteractiveMarkdown', () => {
  it('keeps the text of a task line selectable in view mode', () => {
    const { container } = render(<InteractiveMarkdown content="- [ ] Купить молоко" onUpdate={vi.fn()} />);
    const row = container.querySelector('input[type="checkbox"]')!.parentElement!;
    expect(row.className).not.toContain('select-none');
    expect(row.textContent).toContain('Купить молоко');
  });

  it('still toggles the checkbox', () => {
    const onUpdate = vi.fn();
    const { container } = render(<InteractiveMarkdown content={'- [ ] a\n- [x] b'} onUpdate={onUpdate} />);
    fireEvent.click(container.querySelectorAll('input[type="checkbox"]')[1]);
    expect(onUpdate).toHaveBeenCalledWith('- [ ] a\n- [ ] b');
  });

  it('renders a stored picture floated left so the text wraps around it', () => {
    render(
      <InteractiveMarkdown
        content={'![чек](img:a1)\nТекст рядом'}
        images={{ a1: 'data:image/png;base64,AAAA' }}
        onUpdate={vi.fn()}
      />,
    );
    const image = screen.getByTestId('markdown-image') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(image.className).toContain('float-left');
  });

  it('places a picture on the right or centred, with a width, from its title', () => {
    render(
      <InteractiveMarkdown
        content={'![](img:a1 "right 30%")\n\n![](img:a1 "center")'}
        images={{ a1: 'data:image/png;base64,AAAA' }}
        onUpdate={vi.fn()}
      />,
    );
    const [right, center] = screen.getAllByTestId('markdown-image') as HTMLImageElement[];
    expect(right.className).toContain('float-right');
    expect(right.style.width).toBe('30%');
    expect(center.dataset.align).toBe('center');
    expect(center.className).not.toContain('float');
  });

  it('shows a placeholder instead of a broken picture', () => {
    render(<InteractiveMarkdown content="![](img:missing)" onUpdate={vi.fn()} />);
    expect(screen.queryByTestId('markdown-image')).toBeNull();
    expect(screen.getByText('[картинка не найдена]')).toBeTruthy();
  });

  it('renders a markdown table with aligned columns', () => {
    render(
      <InteractiveMarkdown
        content={'До\n| Товар | Цена |\n| :--- | ---: |\n| Хлеб | **50** |\n| Молоко |\nПосле'}
        onUpdate={vi.fn()}
      />,
    );
    const table = screen.getByTestId('markdown-table');
    const rows = table.querySelectorAll('tr');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toBe('ТоварЦена');
    expect(rows[1].querySelectorAll('td')[1].className).toContain('text-right');
    expect(rows[1].querySelector('strong')?.textContent).toBe('50');
    expect(rows[2].querySelectorAll('td')).toHaveLength(2);
    expect(screen.getByText('После')).toBeTruthy();
  });

  it('renders strikethrough from the editor toolbar', () => {
    const { container } = render(<InteractiveMarkdown content="~~старое~~ новое" onUpdate={vi.fn()} />);
    expect(container.querySelector('s')?.textContent).toBe('старое');
  });
});
