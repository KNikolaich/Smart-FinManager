import { api } from '../lib/api';

interface DemoGenerationResult {
  categoriesAdded: number;
  accountsAdded: number;
  transactionsAdded: number;
  goalsAdded: number;
  cashbackCategoriesAdded: number;
  calendarPlansAdded: number;
  calendarNotesAdded: number;
  months: string[];
}

interface DemoCalendarGenerationResult {
  categoriesAdded: number;
  calendarPlansAdded: number;
  calendarNotesAdded: number;
}

export const generateDemoData = async (
  _userId: string,
  onProgress: (message: string) => void,
) => {
  onProgress('Подготавливаем демо-данные...');
  const result = await api.post<DemoGenerationResult>('/demo-data/generate', {});
  onProgress(`Добавлено операций: ${result.transactionsAdded}`);
  onProgress(`Добавлено планов календаря: ${result.calendarPlansAdded}`);
  onProgress(`Добавлено заметок в календарь: ${result.calendarNotesAdded}`);
  onProgress(
    `Готово: добавлено ${result.calendarPlansAdded} планов и ${result.calendarNotesAdded} заметок.`,
  );
  return result;
};

export const addDemoCalendarData = async (
  _userId: string,
  onProgress: (message: string) => void,
) => {
  onProgress('Добавляем пропущенные планы и заметки...');
  const result = await api.post<DemoCalendarGenerationResult>('/demo-data/calendar', {});
  onProgress(`Добавлено планов календаря: ${result.calendarPlansAdded}`);
  onProgress(`Добавлено заметок в календарь: ${result.calendarNotesAdded}`);
  onProgress('Готово!');
  return result;
};