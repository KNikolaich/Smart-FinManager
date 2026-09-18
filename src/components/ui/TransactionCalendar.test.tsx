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
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '15 сентября 2026' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].getFullYear()).toBe(2026);
    expect(onSelect.mock.calls[0][0].getMonth()).toBe(8);
    expect(onSelect.mock.calls[0][0].getDate()).toBe(15);
  });

  it('navigates to another month without applying a date filter', () => {
    render(
      <TransactionCalendar
        initialDate={initialDate}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Следующий месяц' }));
    expect(screen.getByText('октябрь 2026')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Показать весь месяц' })).toBeNull();
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(
      <TransactionCalendar
        initialDate={initialDate}
        onSelect={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows unique category icons and mutes icons for future dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));

    render(
      <TransactionCalendar
        initialDate={initialDate}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        categories={[
          { id: 'fuel', userId: 'user', name: 'Заправка', type: 'expense', icon: '⛽', color: '#f00' },
          { id: 'taxi', userId: 'user', name: 'Такси', type: 'expense', icon: '🚕', color: '#00f' },
        ]}
        transactions={[
          { id: '1', userId: 'user', accountId: 'account', categoryId: 'fuel', amount: 10, type: 'expense', description: '', createdAt: '2026-09-17T10:00:00.000Z' },
          { id: '2', userId: 'user', accountId: 'account', categoryId: 'fuel', amount: 20, type: 'expense', description: '', createdAt: '2026-09-17T12:00:00.000Z' },
          { id: '3', userId: 'user', accountId: 'account', categoryId: 'taxi', amount: 30, type: 'expense', description: '', createdAt: '2026-09-20T12:00:00.000Z' },
        ]}
      />
    );

    const pastDay = screen.getByRole('button', { name: /17 сентября 2026/ });
    const futureDay = screen.getByRole('button', { name: /20 сентября 2026/ });

    expect(pastDay.querySelectorAll('[aria-label]').length).toBe(1);
    expect(futureDay.querySelector('[aria-label="Такси"]')?.classList.contains('grayscale')).toBe(true);

    vi.useRealTimers();
  });
});