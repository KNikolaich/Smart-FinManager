import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AIAssistant from './AIAssistant';

const { apiMock, processUserMessageMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  processUserMessageMock: vi.fn(),
}));

vi.mock('../lib/api', () => ({ api: apiMock }));
vi.mock('../services/aiService', () => ({
  processUserMessage: processUserMessageMock,
  getFinancialAdvice: vi.fn(),
}));
vi.mock('../hooks/useVoiceInput', () => ({
  useVoiceInput: () => ({
    isRecording: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}));

const baseProps = {
  accounts: [],
  categories: [],
  transactions: [],
  goals: [],
  plans: [],
  userId: 'user-1',
};

describe('AIAssistant action confirmations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    apiMock.delete.mockResolvedValue(undefined);
    apiMock.get.mockResolvedValue([]);
    apiMock.put.mockResolvedValue(undefined);
    apiMock.post.mockImplementation(async (path: string, message: any) => ({
      ...message,
      id: `message-${message.role}`,
    }));
  });

  it('does not present unsupported monthly-plan changes as a successful action', async () => {
    processUserMessageMock.mockResolvedValueOnce({
      intent: 'plan',
      data: { date: '2026-10-05', text: 'Валера должен вернуть деньги' },
      message: 'Готово, я добавил напоминание.',
    });

    render(<AIAssistant {...baseProps} />);
    const input = await screen.findByPlaceholderText('Напиши мне или прикрепи фото...');
    fireEvent.change(input, {
      target: { value: 'создай напоминалку в плане, что 5 го числа Валера должен вернуть деньги' },
    });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    expect(await screen.findByText(/AI пока не умеет изменять месячный бюджетный план/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Подтвердить' })).toBeNull();
    expect(apiMock.put).not.toHaveBeenCalled();
  });

  it('shows an error, not a success, when an old unsupported plan action is confirmed', async () => {
    apiMock.get.mockResolvedValueOnce([{
      id: 'old-plan-action',
      role: 'assistant',
      type: 'action',
      actionType: 'plan',
      actionData: {},
      content: 'Обновил твои планы.',
    }]);

    render(<AIAssistant {...baseProps} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Подтвердить' }));

    await waitFor(() => expect(apiMock.put).toHaveBeenCalled());
    const savedContent = apiMock.put.mock.calls[0][1].content as string;
    expect(savedContent).toContain('Изменение месячного плана через AI пока не поддерживается');
    expect(savedContent).not.toContain('Операция успешно выполнена');
  });
});