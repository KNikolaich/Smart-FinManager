import { describe, expect, it } from 'vitest';
import { getAICompoundActions } from './aiCompoundActions';

describe('getAICompoundActions', () => {
  it('keeps supported actions in request order', () => {
    const transfer = { type: 'transfer', amount: 2000 };
    const note = { date: '2026-10-02', text: 'Вернёт долг' };

    expect(getAICompoundActions({
      actions: [
        { action: 'transaction', data: transfer },
        { action: 'calendar_note', data: note },
      ],
    })).toEqual([
      { action: 'transaction', data: transfer },
      { action: 'calendar_note', data: note },
    ]);
  });

  it('discards malformed and unsupported action entries', () => {
    expect(getAICompoundActions({
      actions: [
        null,
        { action: 'transaction' },
        { action: 'advice', data: { text: 'ignore' } },
        { action: 'calendar_plan', data: [] },
      ],
    })).toEqual([]);
  });
});