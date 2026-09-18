import { useMemo, useState } from 'react';
import PaymentCalendarTab, {
  PlannedPayment,
  PaymentStatus,
} from './PaymentCalendarTab';

const INITIAL_PAYMENTS: PlannedPayment[] = [
  {
    id: 'rent',
    title: 'Аренда квартиры',
    amount: 48500,
    date: '2026-04-05',
    recurrence: 'Ежемесячно',
    account: 'Тинькофф Black',
    status: 'pending',
    todoist: 'synced',
    color: 'plum',
  },
  {
    id: 'internet',
    title: 'Домашний интернет',
    amount: 890,
    date: '2026-04-08',
    recurrence: 'Ежемесячно',
    account: 'Тинькофф Black',
    status: 'paid',
    todoist: 'synced',
    color: 'blue',
  },
  {
    id: 'gym',
    title: 'Абонемент в зал',
    amount: 3200,
    date: '2026-04-12',
    recurrence: 'Ежемесячно',
    account: 'Сбер — дебетовая',
    status: 'pending',
    todoist: 'not-linked',
    color: 'orange',
  },
  {
    id: 'phone',
    title: 'Мобильная связь',
    amount: 799,
    date: '2026-04-15',
    recurrence: 'Ежемесячно',
    account: 'Тинькофф Black',
    status: 'pending',
    todoist: 'synced',
    color: 'blue',
  },
  {
    id: 'insurance',
    title: 'Страховка автомобиля',
    amount: 12400,
    date: '2026-04-18',
    recurrence: 'Ежегодно',
    account: 'Сбер — дебетовая',
    status: 'pending',
    todoist: 'not-linked',
    color: 'orange',
  },
  {
    id: 'cloud',
    title: 'Облачное хранилище',
    amount: 299,
    date: '2026-04-21',
    recurrence: 'Ежемесячно',
    account: 'Тинькофф Black',
    status: 'paid',
    todoist: 'synced',
    color: 'plum',
  },
  {
    id: 'school',
    title: 'Курс английского',
    amount: 6500,
    date: '2026-04-24',
    recurrence: 'Ежемесячно',
    account: 'Сбер — дебетовая',
    status: 'pending',
    todoist: 'synced',
    color: 'orange',
  },
  {
    id: 'music',
    title: 'Музыкальный сервис',
    amount: 199,
    date: '2026-04-27',
    recurrence: 'Ежемесячно',
    account: 'Тинькофф Black',
    status: 'pending',
    todoist: 'not-linked',
    color: 'plum',
  },
];

export default function PaymentCalendarDemo() {
  const [payments, setPayments] = useState(INITIAL_PAYMENTS);
  const [todoistConnected, setTodoistConnected] = useState(true);

  const updateStatus = (id: string, status: PaymentStatus) => {
    setPayments((current) =>
      current.map((payment) => (payment.id === id ? { ...payment, status } : payment)),
    );
  };

  const updatePayment = (nextPayment: PlannedPayment) => {
    setPayments((current) =>
      current.some((payment) => payment.id === nextPayment.id)
        ? current.map((payment) => (payment.id === nextPayment.id ? nextPayment : payment))
        : [...current, nextPayment],
    );
  };

  const deletePayment = (id: string) => {
    setPayments((current) => current.filter((payment) => payment.id !== id));
  };

  const syncedPayments = useMemo(
    () =>
      payments.map((payment) =>
        payment.todoist === 'syncing' && todoistConnected
          ? { ...payment, todoist: 'synced' as const }
          : payment,
      ),
    [payments, todoistConnected],
  );

  return (
    <main className="demo-shell">
      <PaymentCalendarTab
        payments={syncedPayments}
        todoistConnected={todoistConnected}
        onTodoistConnect={() => setTodoistConnected((connected) => !connected)}
        onStatusChange={updateStatus}
        onPaymentChange={updatePayment}
        onPaymentDelete={deletePayment}
      />
    </main>
  );
}