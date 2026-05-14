import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { Send, User, Sparkles, Loader2, PlusCircle, Target, PieChart, Calendar, Eraser, Paperclip, X as CloseIcon, Mic, MicOff, Camera, Image as ImageIcon } from 'lucide-react';
import { RobotIcon } from './icons/RobotIcon';
import { processUserMessage, getFinancialAdvice } from '../services/aiService';
import { api } from '../lib/api';
import { Account, Category, Transaction, Goal, Plan, Message } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  onOpenAddTransaction?: (initialData?: any) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export interface AIAssistantHandle {
  handleVoiceInput: (onStart?: () => void, onEnd?: () => void) => void;
}

const AIAssistant = forwardRef<AIAssistantHandle, AIAssistantProps>(function AIAssistant({ accounts, categories, transactions, goals, plans, userId, onRedirectToCreateGoal, onRefresh, onResult, onOpenAddTransaction, showToast }, ref) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { isRecording, startListening, stopListening } = useVoiceInput();

  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startStream = async (deviceId?: string) => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) videoRef.current.srcObject = newStream;
      setStream(newStream);
    } catch (err) {
      console.error('Error accessing camera:', err);
      if (showToast) showToast('Не удалось получить доступ к камере', 'error');
    }
  };

  useEffect(() => {
    if (isCapturing) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
          startStream(videoDevices[0].deviceId);
        }
      });
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  }, [isCapturing]);

  const capturePhoto = () => {
    if (videoRef.current && stream) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.5);
      setAttachments(prev => [...prev, base64]);
      setIsCapturing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        if (showToast) showToast('Файл слишком большой (макс 5мб)', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAttachments(prev => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const onVoiceInput = (onStart?: () => void, onEnd?: () => void) => {
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
  };

  useImperativeHandle(ref, () => ({
    handleVoiceInput: onVoiceInput
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
            content: 'Приветствую! Я финансовый помощник. Расскажи, как прошел день? Могу записать твои расходы, помочь поставить цель или прикинуть план на месяц. Просто скажи — я всё сделаю!'
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

  const confirmAction = async (msgId: string, type: string, data: any, silent = false) => {
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
          if (silent) return false;
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
          if (silent) return false;
          if (categories.length === 0) {
            throw new Error('У вас еще нет созданных категорий. Пожалуйста, создайте категорию в разделе "Главная".');
          }
          throw new Error('Не удалось определить категорию. Пожалуйста, укажите категорию операции.');
        }

        const categoryId = foundCategory.id;

        const amount = Number(data.amount);
        if (isNaN(amount) || amount <= 0) {
          if (silent) return false;
          throw new Error('Не удалось определить корректную сумму операции.');
        }

        if (data.type === 'transfer') {
          let foundTargetAccount = findAccount(data.targetAccountId, data.targetAccountName);

          if (!foundTargetAccount) {
            if (silent) return false;
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
        if (silent && showToast) showToast('Операция добавлена', 'success');
        return true;
      } else if (type === 'goal') {
        const name = data.name || data.title;
        const targetAmount = Number(data.targetAmount || data.amount);

        if (!name || isNaN(targetAmount) || targetAmount <= 0) {
          if (silent) return false;
          throw new Error('Не удалось определить название цели или корректную сумму. Пожалуйста, укажите название и сумму (например, "На машину 500000").');
        }

        if (onRedirectToCreateGoal) {
          onRedirectToCreateGoal({
            name,
            targetAmount,
            deadline: data.deadline || null
          });
          return true;
        }
      } else if (type === 'plan') {
        // ... handled similarly if needed
        // but let's stick to core transaction flow
        if (silent) return false; // plans might need manual overview
      }

      if (!silent) {
        const msg = messages.find(m => m.id === msgId);
        if (msg) {
          const currentContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          await api.put(`/chat-history/${msgId}`, {
            type: 'text',
            content: currentContent + '\n\n✅ **Готово! Операция успешно выполнена.**'
          });
          fetchHistory();
        }
      }
      return true;
    } catch (error: any) {
      console.error('Action Error:', error);
      if (silent) return false;
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
      return false;
    }
  };

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || input;
    if ((!text.trim() && attachments.length === 0) || loading) return;

    if (!textOverride) setInput('');
    const currentAttachments = [...attachments];
    const userMessage: Omit<Message, 'id'> = {
      role: 'user',
      content: text,
      attachments: currentAttachments
    };
    
    setAttachments([]);
    setLoading(true);

    await saveMessage(userMessage);

    try {
      const result = await processUserMessage(userId, text, accounts, categories, currentAttachments, transactions);
      
      if (result.data?.error_code === 'REGION_NOT_SUPPORTED') {
        if (showToast) showToast('⚠️ Регион не поддерживается! Используйте VPN или смените локацию.', 'error');
      }

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
          content: result.message,
          type: 'action',
          actionType: result.intent as any,
          actionData: result.data
        };
      } else {
        assistantMessage = {
          role: 'assistant',
          content: result.message
        };
      }

      const savedMsg = await saveMessage(assistantMessage);

      // Auto-action logic
      if (savedMsg?.id) {
        if (result.intent === 'transaction') {
          const success = await confirmAction(savedMsg.id, 'transaction', result.data, true);
          if (success) {
            // Update message to remove buttons
            const currentContent = typeof assistantMessage.content === 'string' ? assistantMessage.content : JSON.stringify(assistantMessage.content);
            await api.put(`/chat-history/${savedMsg.id}`, {
              type: 'text',
              content: currentContent + '\n\n✅ **Операция добавлена.**'
            });
            fetchHistory();
          } else {
            // Data incomplete - open form
            if (onOpenAddTransaction) {
              onOpenAddTransaction({
                ...result.data,
                createdAt: new Date().toISOString()
              });
            }
          }
        } else if (result.intent === 'goal') {
          // Open goal manager form
          const success = await confirmAction(savedMsg.id, 'goal', result.data, true);
          if (success) {
             await api.put(`/chat-history/${savedMsg.id}`, {
              type: 'text',
              content: typeof assistantMessage.content === 'string' ? assistantMessage.content : JSON.stringify(assistantMessage.content)
            });
            fetchHistory();
          }
        }
      }
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

  const quickActions = [   
    { label: 'Анализ', icon: PieChart, text: 'Проанализируй мой бюджет и дай советы. ' },
    { label: 'Цель', icon: Target, text: 'Хочу накопить 50000 на отпуск до 1 июня' },
    { label: 'Доход', icon: PlusCircle, text: 'Получил 5000 рублей с фриланса на Дебетовую карту' },
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
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 sm:py-6 space-y-4 sm:space-y-6 no-scrollbar relative">
        <button
          onClick={clearChat}
          className="absolute bottom-4 right-4 w-10 h-10 bg-white text-neutral-400 rounded-full flex items-center justify-center hover:bg-neutral-100 transition-all active:scale-95 shadow-md border border-neutral-100 z-10"
          title="Очистить чат"
        >
          <Eraser className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
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
                <RobotIcon className="w-6 h-6 sm:w-10 sm:h-10 text-theme-primary" active />
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
                  </ReactMarkdown>
                </div>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.attachments.map((base64, i) => (
                      <img key={i} src={base64} alt="attachment" className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg border border-theme-base/20" />
                    ))}
                  </div>
                )}
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
              <RobotIcon className="w-6 h-6 sm:w-10 sm:h-10 text-theme-primary" active />
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
        {/* Row 1: Action Buttons & Quick Actions */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex gap-1 items-center">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*" 
              multiple 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 sm:w-11 sm:h-11 bg-neutral-100 text-neutral-500 rounded-lg sm:rounded-xl flex items-center justify-center hover:bg-neutral-200 transition-all active:scale-95 shrink-0"
              title="Прикрепить фото"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => setIsCapturing(true)}
              className="w-8 h-8 sm:w-11 sm:h-11 bg-neutral-100 text-neutral-500 rounded-lg sm:rounded-xl flex items-center justify-center hover:bg-neutral-200 transition-all active:scale-95 shrink-0"
              title="Сделать фото"
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={isRecording ? stopListening : () => onVoiceInput()}
              className={cn(
                "w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all active:scale-95",
                isRecording ? "bg-red-500 text-white animate-pulse" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              )}
              title={isRecording ? "Остановить запись" : "Голосовой ввод"}
            >
              {isRecording ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>

          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar justify-end pb-1">
            {quickActions.map((action, i) => (
              <button 
                key={i}
                onClick={() => setInput(action.text)}
                className="shrink-0 flex items-center gap-1.5 sm:gap-2 bg-neutral-50 text-neutral-600 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-medium border border-neutral-100 hover:bg-neutral-100 transition-colors whitespace-nowrap"
              >
                <action.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Textarea & Send */}
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Напиши мне или прикрепи фото..."
            rows={1}
            className="flex-1 bg-neutral-50 border border-neutral-100 rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-3.5 text-base sm:text-sm outline-none focus:border-emerald-500 transition-all resize-none max-h-32 mb-1"
          />

          <button
            onClick={() => handleSend()}
            disabled={(!input.trim() && attachments.length === 0) || loading}
            className="w-10 h-10 sm:w-11 sm:h-11 bg-theme-primary text-white rounded-lg sm:rounded-xl flex items-center justify-center disabled:opacity-50 transition-all active:scale-95 shadow-sm shadow-theme-primary/20 mb-1 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
        
        {attachments.length > 0 && (
           <div className="flex flex-wrap gap-1.5 mt-2">
            {attachments.map((base64, index) => (
              <div key={index} className="relative group w-10 h-10 sm:w-11 sm:h-11 shrink-0">
                <img src={base64} alt="attachment" className="w-full h-full object-cover rounded-lg border border-neutral-200" />
                <button 
                  onClick={() => removeAttachment(index)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                >
                  <CloseIcon size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {isCapturing && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex-1 relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          </div>
          <div className="p-4 bg-black flex items-center justify-between gap-4">
            <button onClick={() => setIsCapturing(false)} className="text-white text-sm font-medium">Отмена</button>
            <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-neutral-300 hover:bg-neutral-100 transition-all active:scale-95" />
            {cameraDevices.length > 1 ? (
              <select onChange={(e) => startStream(e.target.value)} value={selectedDeviceId} className="bg-transparent text-white text-sm">
                {cameraDevices.map(d => <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label || 'Камера'}</option>)}
              </select>
            ) : <div className="w-12"></div>}
          </div>
        </div>
      )}
    </div>
  );
}
);

export default AIAssistant;
