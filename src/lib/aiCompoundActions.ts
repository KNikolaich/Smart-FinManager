export type AICompoundActionKind = 'transaction' | 'calendar_plan' | 'calendar_note';

export interface AICompoundAction {
  action: AICompoundActionKind;
  data: unknown;
}

const ALLOWED_ACTIONS = new Set<AICompoundActionKind>([
  'transaction',
  'calendar_plan',
  'calendar_note',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function getAICompoundActions(value: unknown): AICompoundAction[] {
  const record = asRecord(value);
  if (!Array.isArray(record?.actions)) return [];

  return record.actions.flatMap((item): AICompoundAction[] => {
    const actionRecord = asRecord(item);
    const action = actionRecord?.action ?? actionRecord?.kind ?? actionRecord?.intent;
    const data = actionRecord?.data;

    if (
      typeof action !== 'string' ||
      !ALLOWED_ACTIONS.has(action as AICompoundActionKind) ||
      !asRecord(data)
    ) {
      return [];
    }

    return [{
      action: action as AICompoundActionKind,
      data,
    }];
  });
}