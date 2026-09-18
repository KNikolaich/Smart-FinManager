import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PaymentCalendarDemo from './PaymentCalendarDemo';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PaymentCalendarDemo />
  </StrictMode>,
);