import { useState, useEffect, useRef } from 'react';
import { Bot, Send, User, Sparkles, Loader2, PlusCircle, Target, PieChart, Calendar, Eraser } from 'lucide-react';
import { processUserMessage, getFinancialAdvice } from '../services/aiService';
import { db, handleFirestoreError } from '../firebase';
import { collection, addDoc, updateDoc, doc, increment, writeBatch, query, where, orderBy, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { Account, Category, Transaction, Goal, Budget, Plan, Message, OperationType } from '../types';
import ReactMarkdown from 'react-markdown';

interface AIAssistantProps {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  plans: Plan[];
  userId: string;
  onRedirectToCreateGoal?: (data: { name?: string; targetAmount?: number; deadline?: string }) => void;
}

export default function AIAssistant({ accounts, categories, transactions, budgets, goals, plans, userId, onRedirectToCreateGoal }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'chat_history'),
      where('userId', '==', userId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Message[];
      
      if (history.length === 0) {
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: 'Привет! Я твой финансовый ассистент. Могу помочь добавить операцию, создать цель или проанализировать бюджет. Просто напиши мне!'
          }
        ]);
      } else {
        setMessages(history);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chat_history');
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessage = async (msg: Omit<Message, 'id'>) => {
    try {
      await addDoc(collection(db, 'chat_history'), {
        ...msg,
        userId,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'chat_history');
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

    // Optimistically add to UI if needed, but we rely on onSnapshot for persistence
    await saveMessage(userMessage);

    try {
      const result = await processUserMessage(userId, text, messages, accounts, categories, transactions, goals, budgets, plans);
      
      let assistantMessage: Omit<Message, 'id'>;

      if (result.intent === 'advice') {
        const advice = await getFinancialAdvice(userId, transactions, budgets, goals, accounts, plans);
        assistantMessage = {
          role: 'assistant',
          content: advice
        };
      } else if (result.intent === 'unknown') {
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
      if (type === 'transaction') {
        // Try to find accountId by ID or by Name (more robust matching)
        let accountId = data.accountId;
        let accountName = data.accountName;
        
        let foundAccount = accounts.find(a => {
          const searchId = String(accountId || '').toLowerCase().trim();
          const searchName = String(accountName || '').toLowerCase().trim();
          const accName = a.name.toLowerCase().trim();
          const accIdStr = String(a.id).toLowerCase().trim();
          
          return (searchId && (accIdStr === searchId || accName === searchId || accName.includes(searchId))) || 
                 (searchName && (accName === searchName || accName.includes(searchName) || searchName.includes(accName)));
        });

        // Fallback: if accountId is missing but there's only one account, use it
        if (!foundAccount && accounts.length === 1) {
          foundAccount = accounts[0];
        }

        accountId = foundAccount?.id;

        // Try to find categoryId by ID or by Name (more robust matching)
        let categoryId = data.categoryId;
        let categoryName = data.categoryName; // AI might provide this too

        const foundCategory = categories.find(c => {
          const searchId = String(categoryId || '').toLowerCase().trim();
          const searchName = String(categoryName || '').toLowerCase().trim();
          const catName = c.name.toLowerCase().trim();
          const catIdStr = String(c.id).toLowerCase().trim();

          return (searchId && (catIdStr === searchId || catName === searchId || catName.includes(searchId))) ||
                 (searchName && (catName === searchName || catName.includes(searchName) || searchName.includes(catName)));
        });
        
        categoryId = foundCategory?.id || (categories.length > 0 ? categories.find(c => c.type === data.type)?.id || categories[0].id : null);

        if (!accountId) {
          throw new Error('Не удалось определить счет. Пожалуйста, уточните название счета (например, Карта, Наличные).');
        }
        if (!categoryId) {
          throw new Error('Не удалось определить категорию. Пожалуйста, укажите категорию операции.');
        }

        const amount = Number(data.amount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error('Не удалось определить корректную сумму операции.');
        }

        const batch = writeBatch(db);

        if (data.type === 'transfer') {
          let targetAccountId = data.targetAccountId;
          const foundTargetAccount = accounts.find(a => {
            const searchId = String(targetAccountId).toLowerCase().trim();
            const accountName = a.name.toLowerCase().trim();
            const accountIdStr = String(a.id).toLowerCase().trim();
            
            return accountIdStr === searchId || 
                    accountName === searchId || 
                    accountName.includes(searchId) || 
                    searchId.includes(accountName);
          });
          targetAccountId = foundTargetAccount?.id;

          if (!targetAccountId) {
            throw new Error('Для перевода необходимо указать корректный целевой счет.');
          }
          const sourceRef = doc(db, 'accounts', accountId);
          const targetRef = doc(db, 'accounts', targetAccountId);
          batch.update(sourceRef, { balance: increment(-amount) });
          batch.update(targetRef, { balance: increment(amount) });
          
          const sourceAcc = accounts.find(a => a.id === accountId);
          const targetAcc = accounts.find(a => a.id === targetAccountId);

          const transactionData = {
            userId,
            accountId,
            targetAccountId,
            amount,
            type: 'transfer',
            description: data.description || `Перевод: ${sourceAcc?.name} -> ${targetAcc?.name}`,
            createdAt: new Date().toISOString()
          };

          const transRef = doc(collection(db, 'transactions'));
          batch.set(transRef, transactionData);
        } else {
          const transactionData = {
            userId,
            accountId,
            categoryId,
            amount,
            type: data.type,
            description: data.description || '',
            createdAt: new Date().toISOString()
          };

          const transRef = doc(collection(db, 'transactions'));
          batch.set(transRef, transactionData);
          
          const accountRef = doc(db, 'accounts', accountId);
          batch.update(accountRef, {
            balance: increment(data.type === 'income' ? amount : -amount)
          });
        }
        await batch.commit();
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
          return; // Skip the "Done" message as we are redirecting
        }
      } else if (type === 'plan') {
        const name = data.name || data.title;
        const plannedAmount = Number(data.plannedAmount || data.amount);
        
        if (!name || isNaN(plannedAmount) || plannedAmount <= 0) {
          throw new Error('Не удалось определить название плана или корректную сумму.');
        }

        // Try to find accountId by ID or by Name (more robust matching)
        let accountId = data.accountId;
        let foundAccount = accounts.find(a => {
          const searchId = String(accountId).toLowerCase().trim();
          const accountName = a.name.toLowerCase().trim();
          const accountIdStr = String(a.id).toLowerCase().trim();
          
          return accountIdStr === searchId || 
                 accountName === searchId || 
                 accountName.includes(searchId) || 
                 searchId.includes(accountName);
        });

        // Fallback: if accountId is missing but there's only one account, use it
        if (!foundAccount && accounts.length === 1) {
          foundAccount = accounts[0];
        }

        accountId = foundAccount?.id;

        if (!accountId) {
          throw new Error('Не удалось определить счет для плана. Пожалуйста, укажите счет.');
        }

        await addDoc(collection(db, 'plans'), {
          userId,
          name,
          plannedAmount,
          accountId,
          priority: data.priority || 'medium',
          dateOfFinish: data.dateOfFinish || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
          month: new Date().toISOString().slice(0, 7)
        });
      }

      const msgRef = doc(db, 'chat_history', msgId);
      const msg = messages.find(m => m.id === msgId);
      if (msg) {
        const currentContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        await updateDoc(msgRef, {
          type: 'text',
          content: currentContent + '\n\n✅ **Готово! Операция успешно выполнена.**'
        });
      }
    } catch (error: any) {
      console.error('Action Error:', error);
      const errorMessage = error.message || 'Произошла ошибка при выполнении операции.';
      const msgRef = doc(db, 'chat_history', msgId);
      const msg = messages.find(m => m.id === msgId);
      if (msg) {
        const currentContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        await updateDoc(msgRef, {
          type: 'text',
          content: currentContent + `\n\n❌ **Ошибка:** ${errorMessage}`
        });
      }
      // Still log to firestore error handler if it was a firestore error
      if (error.code || error.message?.includes('permissions')) {
        try {
          handleFirestoreError(error, OperationType.WRITE, type + 's');
        } catch (e) {
          // ignore re-throw
        }
      }
    }
  };

  const quickActions = [   
    { label: 'Анализ бюджета', icon: PieChart, text: 'Проанализируй мой бюджет и дай советы' },
    { label: 'Добавить расход', icon: PlusCircle, text: 'Добавь расход 3500 рублей на продукты с Дебетовой карты' },
    { label: 'Создать цель', icon: Target, text: 'Хочу накопить 50000 на новый велосипед к лету' },
    { label: 'Продлить планы', icon: Calendar, text: 'Обнови планы на будущий месяц' },
  ];

  const clearChat = async () => {
    try {
      const q = query(collection(db, 'chat_history'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'chat_history');
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 sm:py-6 space-y-4 sm:space-y-6">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-2 sm:gap-3", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
              "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0",
              m.role === 'assistant' ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-600"
            )}>
              {m.role === 'assistant' ? <Bot className="w-4 h-4 sm:w-5 sm:h-5" /> : <User className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="space-y-2 sm:space-y-3 max-w-[82%] sm:max-w-[85%]">
              <div className={cn(
                "p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm shadow-sm",
                m.role === 'assistant' ? "bg-white text-neutral-800 rounded-tl-none" : "bg-emerald-600 text-white rounded-tr-none"
              )}>
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed text-[12px] sm:text-sm">
                  <ReactMarkdown>
                    {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
                  </ReactMarkdown>
                </div>
              </div>
              
              {m.type === 'action' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => confirmAction(m.id, m.actionType!, m.actionData)}
                    className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all"
                  >
                    Подтвердить
                  </button>
                  <button 
                    onClick={async () => {
                      const msgRef = doc(db, 'chat_history', m.id);
                      await deleteDoc(msgRef);
                    }}
                    className="bg-white border border-neutral-200 text-neutral-500 px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all"
                  >
                    Отмена
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
              <Bot className="w-5 h-5" />
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
              className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 text-white rounded-lg sm:rounded-xl flex items-center justify-center disabled:opacity-50 transition-all active:scale-95"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
