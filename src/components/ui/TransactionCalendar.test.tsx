import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionCalendar } from './TransactionCalendar';

describe('TransactionCalendar', () => {
  const initialDate = new Date(2026, 8, 8, 12);

  it('returns the selected calendar day', () => {
    const onSelect = vi.fn();
    render(
      <TransactionCalendar
        initialDate={initialDate}
        onSelect={onSelect}
        onShowMonth={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '15 сентября 2026' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].getFullYear()).toBe(2026);
    expect(onSelect.mock.calls[0][0].getMonth()).toBe(8);
    expect(onSelect.mock.calls[0][0].getDate()).toBe(15);
  });

  it('navigates to another month and can open its full list', () => {
    const onShowMonth = vi.fn();
    render(
      <TransactionCalendar
        initialDate={initialDate}
        onSelect={vi.fn()}
        onShowMonth={onShowMonth}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Следующий месяц' }));
    expect(screen.getByText('октябрь 2026')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Показать весь месяц' }));
    expect(onShowMonth).toHaveBeenCalledTimes(1);
    expect(onShowMonth.mock.calls[0][0].getMonth()).toBe(9);
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(
      <TransactionCalendar
        initialDate={initialDate}
        onSelect={vi.fn()}
        onShowMonth={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});