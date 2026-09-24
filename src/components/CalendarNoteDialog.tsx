import { ScrollText, X } from 'lucide-react';
import type { CalendarNote } from '../types';
import { parseDateKey } from '../lib/plannedPaymentOccurrences';

export type CalendarNoteDialogMode = 'create' | 'view' | 'edit';

interface CalendarNoteDialogProps {
  mode: CalendarNoteDialogMode;
  note: CalendarNote;
  error: string | null;
  saving: boolean;
  canEdit: boolean;
  confirmDelete: boolean;
  onChange: (note: CalendarNote) => void;
  onClose: () => void;
  onEdit: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onSave: () => void;
}

export default function CalendarNoteDialog({
  mode,
  note,
  error,
  saving,
  canEdit,
  confirmDelete,
  onChange,
  onClose,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onSave,
}: CalendarNoteDialogProps) {
  const isView = mode === 'view';
  const title = mode === 'create' ? 'Новая записка' : mode === 'edit' ? 'Редактировать записку' : 'Записка календаря';

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-3 sm:p-5"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="w-full max-w-md rounded-2xl border border-amber-200 bg-theme-surface p-4 shadow-2xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-note-dialog-title"
        data-testid="dialog-calendar-note"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <ScrollText size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <h2 id="calendar-note-dialog-title" className="text-base font-bold text-theme-main">{title}</h2>
              {isView && <p className="mt-1 text-xs text-theme-muted">{formatLongDate(note.date)}</p>}
            </div>
          </div>
          <button type="button" aria-label="Закрыть записку" onClick={onClose} disabled={saving} className="rounded-lg p-1 text-theme-muted hover:bg-theme-main disabled:opacity-40">
            <X size={17} />
          </button>
        </header>

        {isView ? (
          <p className="mt-4 min-h-16 whitespace-pre-wrap break-words rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            {note.text}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-bold text-theme-muted">
              Дата
              <input
                type="date"
                required
                value={note.date}
                data-testid="input-calendar-note-date"
                onChange={event => onChange({ ...note, date: event.target.value })}
                className="mt-1 w-full rounded-xl border border-theme-base bg-theme-main px-3 py-2 text-sm font-normal text-theme-main"
              />
            </label>
            <label className="block text-xs font-bold text-theme-muted">
              Текст записки
              <textarea
                autoFocus
                required
                maxLength={2000}
                rows={5}
                value={note.text}
                data-testid="input-calendar-note-text"
                onChange={event => onChange({ ...note, text: event.target.value })}
                placeholder="Напоминание на эту дату"
                className="mt-1 w-full resize-y rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-normal text-amber-950 placeholder:text-amber-700/60"
              />
              <span className="mt-1 block text-right text-[10px] font-normal text-theme-muted">{note.text.length}/2000</span>
            </label>
          </div>
        )}

        {confirmDelete && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3" role="alertdialog" aria-label="Подтверждение удаления записки">
            <p className="text-sm font-semibold text-rose-900">Удалить эту записку?</p>
            <p className="mt-1 text-xs text-rose-800">Это действие нельзя отменить.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={onCancelDelete} disabled={saving} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-theme-muted disabled:opacity-40">Оставить</button>
              <button type="button" data-testid="button-confirm-delete-calendar-note" onClick={onConfirmDelete} disabled={saving} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Удаляем…' : 'Удалить'}</button>
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-xs text-rose-600" role="alert">{error}</p>}

        {!confirmDelete && (
          <footer className="mt-5 flex flex-wrap justify-end gap-2">
            {isView ? (
              <>
                <button type="button" onClick={onClose} className="rounded-xl bg-theme-main px-3 py-2 text-xs font-bold text-theme-muted">Закрыть</button>
                {canEdit && (
                  <>
                    <button type="button" data-testid="button-edit-calendar-note" onClick={onEdit} className="rounded-xl bg-theme-primary px-3 py-2 text-xs font-bold text-white">Редактировать</button>
                    <button type="button" data-testid="button-delete-calendar-note" onClick={onRequestDelete} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white">Удалить</button>
                  </>
                )}
              </>
            ) : (
              <>
                <button type="button" onClick={onClose} disabled={saving} className="rounded-xl bg-theme-main px-3 py-2 text-xs font-bold text-theme-muted disabled:opacity-40">Отмена</button>
                <button type="button" data-testid="button-save-calendar-note" onClick={onSave} disabled={saving || !note.date || !note.text.trim() || !canEdit} className="rounded-xl bg-theme-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Сохраняем…' : 'Сохранить'}</button>
              </>
            )}
          </footer>
        )}
      </section>
    </div>
  );
}

function formatLongDate(date: string) {
  return parseDateKey(date).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}