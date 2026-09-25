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

export const generateDemoData = async (
  _userId: string,
  onProgress: (message: string) => void,
) => {
  onProgress('Подготавливаем демо-данные...');
  const result = await api.post<DemoGenerationResult>('/demo-data/generate', {});
  onProgress(`Добавлено операций: ${result.transactionsAdded}`);
  onProgress(`Добавлено планов календаря: ${result.calendarPlansAdded}`);
  onProgress(`Добавлено заметок в календарь: ${result.calendarNotesAdded}`);
  onProgress('Готово!');
  return result;
};