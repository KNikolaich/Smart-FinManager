import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Calculator from './Calculator';

function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('Calculator decimal input', () => {
  it('multiplies two decimal numbers without rounding to an integer', () => {
    const onConfirm = vi.fn();
    render(<Calculator initialValue="" onConfirm={onConfirm} onCancel={vi.fn()} />);

    click('1');
    click('Десятичная точка');
    click('5');
    click('Умножить');
    click('2');
    click('Десятичная точка');
    click('4');
    click('Вычислить');

    expect(screen.getByTestId('calculator-display').textContent).toBe('3.6');
    click('OK');
    expect(onConfirm).toHaveBeenCalledWith('3.6');
  });

  it('starts a fractional operand with zero after an operator', () => {
    render(<Calculator initialValue="2.5" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    click('Разделить');
    click('Десятичная точка');
    click('5');
    click('Вычислить');

    expect(screen.getByTestId('calculator-display').textContent).toBe('5');
  });

  it('does not add a second decimal point to the same operand', () => {
    render(<Calculator initialValue="" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    click('1');
    click('Десятичная точка');
    click('2');
    click('Десятичная точка');
    click('3');

    expect(screen.getByTestId('calculator-display').textContent).toBe('1.23');
  });
});

describe('Calculator keyboard and continuous operations', () => {
  it('calculates on the first Enter and confirms on the second Enter', () => {
    const onConfirm = vi.fn();
    render(<Calculator initialValue="" onConfirm={onConfirm} onCancel={vi.fn()} />);

    for (const key of ['1', ',', '5', '*', '2', '.', '4', 'Enter']) {
      fireEvent.keyDown(window, { key });
    }

    expect(screen.getByTestId('calculator-display').textContent).toBe('3.6');
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith('3.6');
  });

  it('shows the intermediate result when the next operator is pressed', () => {
    render(<Calculator initialValue="100" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    click('Сложить');
    click('5');
    click('0');
    click('0');
    click('Умножить');

    expect(screen.getByTestId('calculator-display').textContent).toBe('600');

    click('2');
    click('Вычислить');
    expect(screen.getByTestId('calculator-display').textContent).toBe('1200');
  });

  it('lets a repeated operator replace the pending operation', () => {
    render(<Calculator initialValue="100" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    click('Сложить');
    click('Умножить');
    click('2');
    click('Вычислить');

    expect(screen.getByTestId('calculator-display').textContent).toBe('200');
  });
});