import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { X, Terminal, Clock, User, Bot, ChevronDown, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

interface AILog {
  id: string;
  userId: string;
  request: any;
  response: any;
  createdAt: string;
}

interface AILogsProps {
  userId: string;
  onClose: () => void;
}

export default function AILogs({ userId, onClose }: AILogsProps) {
  const [logs, setLogs] = useState<AILog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AILog[]>('/ai-logs');
      setLogs(data);
    } catch (err: any) {
      console.error('AI Logs Error:', err);
      setError('Не удалось загрузить логи из базы данных.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchLogs();
    }
  }, [userId]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };

  const highlightJSON = (json: any) => {
    const str = JSON.stringify(json, null, 2);
    return str.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'text-blue-600'; // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-purple-600 font-bold'; // key
          } else {
            cls = 'text-emerald-600'; // string
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-orange-600'; // boolean
        } else if (/null/.test(match)) {
          cls = 'text-neutral-400'; // null
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
        <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-theme-primary p-2 rounded-xl">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Логи AI</h2>
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Последние 100 операций</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
              title="Обновить"
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-neutral-50 no-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-20 px-6">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <p className="text-neutral-900 font-bold mb-2">{error}</p>
              <p className="text-neutral-500 text-sm">Проверьте соединение с сервером или попробуйте обновить страницу.</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20">
              <Terminal className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
              <p className="text-neutral-400">Логов пока нет</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
                <button 
                  onClick={() => toggleExpand(log.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-mono">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md uppercase">
                        {log.request.model || 'Gemini'}
                      </span>
                      <span className="text-sm font-medium text-neutral-700 truncate max-w-[200px]">
                        {typeof log.request.contents === 'string' 
                          ? log.request.contents.slice(0, 50) 
                          : JSON.stringify(log.request.contents || 'Анализ данных').slice(0, 50)}...
                      </span>
                    </div>
                  </div>
                  {expandedLogs.has(log.id) ? <ChevronDown className="w-5 h-5 text-neutral-400" /> : <ChevronRight className="w-5 h-5 text-neutral-400" />}
                </button>

                {expandedLogs.has(log.id) && (
                  <div className="p-4 border-t border-neutral-100 grid grid-cols-1 lg:grid-cols-2 gap-4 bg-white">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-neutral-500 mb-1">
                        <User className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Request</span>
                      </div>
                      <pre 
                        className="p-4 bg-neutral-900 rounded-xl text-[11px] font-mono overflow-x-auto no-scrollbar max-h-[400px]"
                        dangerouslySetInnerHTML={{ __html: highlightJSON(log.request) }}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-emerald-600 mb-1">
                        <Bot className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Response</span>
                      </div>
                      <pre 
                        className="p-4 bg-neutral-900 rounded-xl text-[11px] font-mono overflow-x-auto no-scrollbar max-h-[400px]"
                        dangerouslySetInnerHTML={{ __html: highlightJSON(log.response) }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
