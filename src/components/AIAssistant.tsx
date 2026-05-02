import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { Send, User, Sparkles, Loader2, PlusCircle, Target, PieChart, Calendar, Eraser } from 'lucide-react';
import { RobotIcon } from './icons/RobotIcon';
import { processUserMessage, getFinancialAdvice } from '../services/aiService';
import { api } from '../lib/api';
import { Account, Category, Transaction, Goal, Plan, Message } from '../types';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

interface AIAssistantProps {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  goals: Goal[];
  plans: Plan[];
  userId: string;
  onRedirectToCreateGoal?: (data: { name?: string; targetAmount?: number; deadline?: string }) => void;
  onRefresh?: () => void;
  onResult?: (result: any) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export interface AIAssistantHandle {
  handleVoiceInput: (onStart?: () => void, onEnd?: () => void) => void;
}

const AIAssistant = forwardRef<AIAssistantHandle, AIAssistantProps>(function AIAssistant({ accounts, categories, transactions, goals, plans, userId, onRedirectToCreateGoal, onRefresh, onResult, showToast }, ref) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { startListening } = useVoiceInput();

  useImperativeHandle(ref, () => ({
    handleVoiceInput: (onStart?: () => void, onEnd?: () => void) => {
      if (onStart) onStart();
      startListening(
        async (text) => {
          // Final result
          await handleSend(text);
          if (onEnd) onEnd();
        },
        (error) => {
          if (onEnd) onEnd();
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: '❌ **Ошибка распознавания голоса.**'
          }]);
        },
        (interimText) => {
          // Interim result
          setInput(interimText);
        }
      );
    }
  }));

  useEffect(() => {
    if (!userId) return;
    fetchHistory();
  }, [userId]);

  const fetchHistory = async () => {
    try {
      const history: Message[] = await api.get('/chat-history');
      if (history.length === 0) {
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: 'Привет, друг! Я твой финансовый наставник. Расскажи, как прошел день? Могу записать твои расходы, помочь поставить цель или прикинуть план на месяц. Просто скажи — я всё сделаю!'
          }
        ]);
      } else {
        setMessages(history);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessage = async (msg: Omit<Message, 'id'>) => {
    try {
      const saved = await api.post<Message>('/chat-history', msg);
      setMessages(prev => [...prev.filter(m => m.id !== 'welcome'), saved]);
      return saved;
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || input;
    if (!text.trim() || loading) return;

    const userMessage: Omit<Message, 'id'> = {
      role: 'user',
      content: text
    };

    if (!textOverride) setInput('');
    setLoading(true);

    await saveMessage(userMessage);

    try {
      const result = await processUserMessage(userId, text, accounts, categories);
      
      if (onResult) onResult(result);
      
      let assistantMessage: Omit<Message, 'id'>;

      if (result.intent === 'advice') {
        const advice = await getFinancialAdvice(userId, transactions, goals, accounts, plans);
        assistantMessage = {
          role: 'assistant',
          content: advice
        };
      } else if (result.intent === 'unknown') {
        assistantMessage = {
          role: 'assistant',
          content: result.message
        };
      } else if (['transaction', 'goal', 'plan'].includes(result.intent)) {
        assistantMessage = {
          role: 'assistant',
          content: result.message
        };
      } else {
        assistantMessage = {
          role: 'assistant',
          content: result.message,
          type: 'action',
          actionType: result.intent as any,
          actionData: result.data
        };
      }

      await saveMessage(assistantMessage);
    } catch (error) {
      console.error('AI Error:', error);
      await saveMessage({
        role: 'assistant',
        content: 'Произошла ошибка при обработке запроса. Попробуй еще раз.'
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmAction = async (msgId: string, type: string, data: any) => {
    try {
      if (!data) {
        throw new Error('Не удалось получить данные для выполнения операции.');
      }

      const findAccount = (idOrName?: string, name?: string) => {
        if (!idOrName && !name) return null;
        const searchId = String(idOrName || '').toLowerCase().trim();
        const searchName = String(name || '').toLowerCase().trim();

        const filteredAccounts = accounts.filter(a => a.showOnDashboard && !a.isArchived);
        return filteredAccounts.find(a => {
          const accName = a.name.toLowerCase().trim();
          const accId = String(a.id).toLowerCase().trim();
          return (searchId && (accId === searchId || accName === searchId || accName.includes(searchId) || searchId.includes(accName))) ||
                 (searchName && (accName === searchName || accName.includes(searchName) || searchName.includes(accName)));
        });
      };

      const findCategory = (idOrName?: string, name?: string) => {
        if (!idOrName && !name) return null;
        const searchId = String(idOrName || '').toLowerCase().trim();
        const searchName = String(name || '').toLowerCase().trim();

        return categories.find(c => {
          const catName = c.name.toLowerCase().trim();
          const catId = String(c.id).toLowerCase().trim();
          return (searchId && (catId === searchId || catName === searchId || catName.includes(searchId) || searchId.includes(catName))) ||
                 (searchName && (catName === searchName || catName.includes(searchName) || searchName.includes(catName)));
        });
      };

      if (type === 'transaction') {
        let foundAccount = findAccount(data.accountId, data.accountName);

        if (!foundAccount && accounts.length === 1) {
          foundAccount = accounts[0];
        }

        if (!foundAccount) {
          if (accounts.length === 0) {
            throw new Error('У вас еще нет созданных счетов. Пожалуйста, создайте счет в разделе "Главная".');
          }
          throw new Error('Не удалось определить счет. Пожалуйста, уточните название счета (например, Карта, Наличные).');
        }

        const accountId = foundAccount.id;

        let foundCategory = findCategory(data.categoryId, data.categoryName);
        
        if (!foundCategory && categories.length > 0) {
          // Fallback to first category of the same type if possible
          foundCategory = categories.find(c => c.type === data.type) || categories[0];
        }

        if (!foundCategory) {
          if (categories.length === 0) {
            throw new Error('У вас еще нет созданных категорий. Пожалуйста, создайте категорию в разделе "Главная".');
          }
          throw new Error('Не удалось определить категорию. Пожалуйста, укажите категорию операции.');
        }

        const categoryId = foundCategory.id;

        const amount = Number(data.amount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error('Не удалось определить корректную сумму операции.');
        }

        if (data.type === 'transfer') {
          let foundTargetAccount = findAccount(data.targetAccountId, data.targetAccountName);

          if (!foundTargetAccount) {
            throw new Error('Для перевода необходимо указать корректный целевой счет.');
          }
          
          const targetAccountId = foundTargetAccount.id;
          const sourceAcc = accounts.find(a => a.id === accountId);
          const targetAcc = accounts.find(a => a.id === targetAccountId);

          await api.post('/transactions', {
            accountId,
            targetAccountId,
            amount,
            type: 'transfer',
            description: data.description || `Перевод: ${sourceAcc?.name} -> ${targetAcc?.name}`,
            createdAt: new Date().toISOString()
          });
        } else {
          await api.post('/transactions', {
            accountId,
            categoryId,
            amount,
            type: data.type,
            description: data.description || '',
            createdAt: new Date().toISOString()
          });
        }
        if (onRefresh) onRefresh();
      } else if (type === 'goal') {
        const name = data.name || data.title;
        const targetAmount = Number(data.targetAmount || data.amount);

        if (!name || isNaN(targetAmount) || targetAmount <= 0) {
          throw new Error('Не удалось определить название цели или корректную сумму. Пожалуйста, укажите название и сумму (например, "На машину 500000").');
        }

        if (onRedirectToCreateGoal) {
          onRedirectToCreateGoal({
            name,
            targetAmount,
            deadline: data.deadline || null
          });
          return;
        }
      } else if (type === 'plan') {
        const name = data.name || data.title;
        const plannedAmount = Number(data.plannedAmount || data.amount);
        
        if (!name || isNaN(plannedAmount) || plannedAmount <= 0) {
          throw new Error('Не удалось определить название плана или корректную сумму.');
        }

        let foundAccount = findAccount(data.accountId, data.accountName);

        if (!foundAccount && accounts.length === 1) {
          foundAccount = accounts[0];
        }

        if (!foundAccount) {
          throw new Error('Не удалось определить счет для плана. Пожалуйста, укажите счет.');
        }

        const accountId = foundAccount.id;

        const newPlan: Plan = {
          id: Math.random().toString(36).substring(2, 9),
          userId: userId,
          name,
          plannedAmount,
          accountId,
          priority: (data.priority as any) || 'medium',
          dateOfFinish: data.dateOfFinish || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
          month: new Date().toISOString().slice(0, 7)
        };

        const savedPlans = localStorage.getItem('ai_temporary_plans');
        const currentPlans = savedPlans ? JSON.parse(savedPlans) : [];
        localStorage.setItem('ai_temporary_plans', JSON.stringify([...currentPlans, newPlan]));
        
        if (onRefresh) onRefresh();
      }

      const msg = messages.find(m => m.id === msgId);
      if (msg) {
        const currentContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        await api.put(`/chat-history/${msgId}`, {
          type: 'text',
          content: currentContent + '\n\n✅ **Готово! Операция успешно выполнена.**'
        });
        fetchHistory();
      }
    } catch (error: any) {
      console.error('Action Error:', error);
      const errorMessage = error.message || 'Произошла ошибка при выполнении операции.';
      const msg = messages.find(m => m.id === msgId);
      if (msg) {
        const currentContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        await api.put(`/chat-history/${msgId}`, {
          type: 'text',
          content: currentContent + `\n\n❌ **Ошибка:** ${errorMessage}`
        });
        fetchHistory();
      }
    }
  };

  const quickActions = [   
    { label: 'Анализ бюджета', icon: PieChart, text: 'Проанализируй мой бюджет и дай советы' },
    { label: 'Добавить расход', icon: PlusCircle, text: 'Добавь расход 5500 рублей на продукты с Т Дебетовой карты' },
    { label: 'Создать цель', icon: Target, text: 'Хочу накопить 50000 на новый велосипед к лету' },
    { label: 'Продлить планы', icon: Calendar, text: 'Обнови планы на будущий месяц' },
  ];

  const clearChat = async () => {
    try {
      await api.delete('/chat-history');
      fetchHistory();
      if (showToast) showToast('Чат очищен', 'success');
    } catch (error) {
      console.error('Error clearing chat history:', error);
      if (showToast) showToast('Ошибка при очистке чата', 'error');
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      await api.delete(`/chat-history/${id}`);
      fetchHistory();
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 sm:py-6 space-y-4 sm:space-y-6 no-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div 
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={cn("flex gap-2 sm:gap-3", m.role === 'user' ? "flex-row-reverse" : "flex-row")}
            >
            <div className="shrink-0 pt-0.5">
              {m.role === 'assistant' ? (
                <RobotIcon className="w-6 h-6 sm:w-8 sm:h-8 text-theme-primary" />
              ) : (
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-theme-main flex items-center justify-center text-theme-muted border border-theme-base">
                  <User className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              )}
            </div>
            <div className="space-y-2 sm:space-y-3 max-w-[82%] sm:max-w-[85%]">
              <div className={cn(
                "p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm shadow-sm",
                m.role === 'assistant' ? "bg-white text-neutral-800 rounded-tl-none" : "bg-theme-primary text-white rounded-tr-none"
              )}>
                <div className="markdown-body text-[12px] sm:text-sm">
                  <ReactMarkdown>
                    {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
                  </ReactMarkdown>
                </div>
              </div>
              
              {m.type === 'action' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => confirmAction(m.id, m.actionType!, typeof m.actionData === 'string' ? JSON.parse(m.actionData) : m.actionData)}
                    className="bg-theme-primary text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all"
                  >
                    Подтвердить
                  </button>
                  <button 
                    onClick={() => deleteMessage(m.id)}
                    className="bg-white border border-neutral-200 text-neutral-500 px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all"
                  >
                    Отмена
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
        {loading && (
          <div className="flex gap-3">
            <div className="shrink-0 pt-0.5">
              <RobotIcon className="w-6 h-6 sm:w-8 sm:h-8 text-theme-primary" />
            </div>
            <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <span className="text-xs text-neutral-400">Думаю...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 bg-white border-t border-neutral-100 shrink-0">
        <div className="flex gap-1.5 sm:gap-2 mb-2 sm:mb-4 overflow-x-auto no-scrollbar pb-1">
          {quickActions.map((action, i) => (
            <button 
              key={i}
              onClick={() => setInput(action.text)}
              className="shrink-0 flex items-center gap-1.5 sm:gap-2 bg-neutral-50 text-neutral-600 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-medium border border-neutral-100 hover:bg-neutral-100 transition-colors"
            >
              <action.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" />
              {action.label}
            </button>
          ))}
        </div>
        <div className="relative flex gap-1.5 sm:gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Напиши мне..."
            className="flex-1 bg-neutral-50 border border-neutral-100 rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-4 text-base sm:text-sm outline-none focus:border-emerald-500 transition-all"
          />
          <div className="flex gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={clearChat}
              title="Очистить чат"
              className="w-10 h-10 sm:w-12 sm:h-12 bg-neutral-100 text-neutral-500 rounded-lg sm:rounded-xl flex items-center justify-center hover:bg-neutral-200 transition-all active:scale-95"
            >
              <Eraser className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="w-10 h-10 sm:w-12 sm:h-12 bg-theme-primary text-white rounded-lg sm:rounded-xl flex items-center justify-center disabled:opacity-50 transition-all active:scale-95"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
);

export default AIAssistant;
