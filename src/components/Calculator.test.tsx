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