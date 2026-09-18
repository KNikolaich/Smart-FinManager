# Календарь плановых оплат

Готовый UX-прототип отдельной вкладки для `PlanPage`. Визуально он продолжает текущий лёгкий табличный стиль приложения, но переводит плановые оплаты в более быстрый сценарий «месяц → день → действие».

## Визуальное направление

- **Парадигма:** календарь как рабочая поверхность + agenda-рейл выбранного дня.
- **Настроение:** quiet ledger — тёплая бумажная база, чернильный текст, приглушённые plum / blue / orange метки.
- **Типографика:** `DM Sans` для интерфейса и `Space Mono` для дат и сумм.
- **Статусы:** зелёный — оплачено, оранжевый — ожидает, Todoist сохраняет свой небольшой коралловый маркер.
- **Движение:** короткие fade/translate только при появлении поверхности и диалога; поддержан `prefers-reduced-motion`.

## Файлы

- `src/PaymentCalendarTab.tsx` — переиспользуемый компонент вкладки, типы оплаты, календарная сетка, agenda, фильтр, диалог CRUD, loading/error/empty states.
- `src/PaymentCalendarDemo.tsx` — локальный demo-адаптер с данными и рабочими callback-мутациями.
- `src/styles.css` — локальная тема и responsive-правила. Не меняет `src/index.css` существующего приложения.
- `index.html`, `src/main.tsx`, `vite.config.ts`, `package.json` — изолированный preview проекта.

## Подключение к `PlanPage`

В существующем `src/components/PlanPage.tsx` достаточно оставить текущие ветки без изменений и добавить новую:

```tsx
import PaymentCalendarTab, {
  PlannedPayment,
  PaymentStatus,
} from './PaymentCalendarTab';

type TabType =
  | 'now'
  | 'past'
  | 'config'
  | 'comment'
  | 'cashback'
  | 'credit'
  | 'calendar';
```

В список табов добавляется кнопка `Календарь`, а в основном условии:

```tsx
{activeTab === 'calendar' ? (
  <PaymentCalendarTab
    payments={calendarPayments}
    loading={calendarLoading}
    error={calendarError}
    todoistConnected={todoistConnected}
    onRetry={loadCalendar}
    onStatusChange={(id, status) => updateCalendarPayment(id, { status })}
    onPaymentChange={saveCalendarPayment}
    onPaymentDelete={deleteCalendarPayment}
    onTodoistConnect={openTodoistConnection}
  />
) : /* существующие cashback / credit / table / notes ветки */}
```

Компонент не вызывает API сам и не меняет `PlanData`: все доменные операции проходят через callback-адаптер родителя. Поэтому существующие таблица планов, кэшбек, кредит и заметки остаются независимыми.

### Минимальная форма данных

```ts
interface PlannedPayment {
  id: string;
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  recurrence: string;
  account: string;
  status: 'paid' | 'pending';
  todoist: 'synced' | 'not-linked' | 'syncing' | 'error';
  color: 'plum' | 'blue' | 'orange';
}
```

Если в API пока нет календарного ресурса, UI уже готов: передайте `loading`, `error` и callback-обёртки существующего `api`. Новых backend endpoint’ов в этом артефакте нет.

## Responsive-поведение

- **Desktop:** календарь занимает основную ширину, справа закреплён agenda выбранного дня.
- **До 760 px:** agenda превращается в список месяца под сеткой, ячейки показывают только цветные точки, чтобы не было горизонтального скролла и обрезанного текста.
- **До 480 px:** CTA «Добавить» становится icon-only, форма диалога — одной колонкой, месяц остаётся управляемым большими touch-target’ами.
- На всех размерах календарь сохраняет 7 колонок, текущий день, выбранный день и легенду статусов.

## Состояния и доступные действия

- **Загрузка:** skeleton заголовка, итогов, сетки и agenda без spinner-only состояния.
- **Ошибка:** понятное сообщение и кнопка «Повторить» через `onRetry`.
- **Пустой месяц:** собранный empty state с CTA «Добавить первую оплату».
- **Нет результатов фильтра:** компактное сообщение в mobile-списке и пустой agenda для выбранного дня.
- **На оплате:** отметить оплаченной/ожидающей, изменить, удалить через меню.
- **На календаре:** выбрать день, перейти месяц назад/вперёд, вернуться к сегодняшнему дню, фильтровать по статусу.
- **В форме:** создать/редактировать название, сумму, дату, регулярность, счёт, цветовую метку и связь с Todoist.

## Проверка

```bash
cd artifacts/payment-calendar-design
../../node_modules/.bin/vite build
```

Сборка проходит без изменений backend-кода.