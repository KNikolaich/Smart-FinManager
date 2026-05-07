import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Category, TransactionType } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface CategorySelectProps {
  categories: Category[];
  selectedCategoryId: string;
  onChange: (id: string) => void;
  type: TransactionType;
  label?: string;
}

export default function CategorySelect({ categories, selectedCategoryId, onChange, type, label }: CategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const parentCategory = selectedCategory?.parentId 
    ? categories.find(c => c.id === selectedCategory.parentId) 
    : null;

  const filteredCategories = useMemo(() => {
    // Only show categories that match the type
    const typeCategories = categories.filter(c => c.type === type);
    
    // Sort logic
    const sorted = [...typeCategories].sort((a, b) => {
      const aOrder = a.sortOrder ?? Infinity;
      const bOrder = b.sortOrder ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || '').localeCompare(b.name || '');
    });

    if (!searchQuery) return sorted;

    const query = searchQuery.toLowerCase();
    return sorted.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(query);
      const parentMatch = c.parentId 
        ? categories.find(p => p.id === c.parentId)?.name.toLowerCase().includes(query) 
        : false;
      return nameMatch || parentMatch;
    });
  }, [categories, type, searchQuery]);

  // Group by parent for display
  const groupedCategories = useMemo(() => {
    const parents = filteredCategories.filter(c => !c.parentId);
    const children = filteredCategories.filter(c => c.parentId);

    return parents.map(parent => ({
      parent,
      children: children.filter(child => child.parentId === parent.id)
    })).filter(group => group.parent.name.toLowerCase().includes(searchQuery.toLowerCase()) || group.children.length > 0);
  }, [filteredCategories, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {label && <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1 mb-1 block">{label}</label>}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-theme-surface border border-theme-base rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 ring-theme-primary/20 transition-all text-left font-semibold flex items-center justify-between text-theme-main shadow-sm"
      >
        {selectedCategory ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-xl shrink-0">{selectedCategory.icon || (parentCategory?.icon)}</span>
            <div className="flex flex-row items-baseline gap-1.5 leading-tight overflow-hidden">
              <span className="truncate">{selectedCategory.name}</span>
              {parentCategory && (
                <span className="text-[10px] text-theme-muted truncate whitespace-nowrap">({parentCategory.name})</span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-theme-muted">Выберите категорию</span>
        )}
        <ChevronDown className={cn("w-4 h-4 text-theme-muted transition-transform shrink-0 ml-2", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1 }}
            className="absolute z-[200] top-full mt-2 left-0 right-0 bg-theme-surface border border-theme-base rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[400px]"
          >
            {/* Search Input */}
            <div className="p-2 border-b border-theme-base sticky top-0 bg-theme-surface/80 backdrop-blur-sm z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск категории..."
                  className="w-full bg-theme-main border border-theme-base rounded-xl pl-8 pr-8 py-1.5 text-xs outline-none focus:ring-2 ring-theme-primary/20 transition-all text-theme-main"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-theme-main rounded-full transition-colors"
                  >
                    <X className="w-3 h-3 text-theme-muted" />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto p-1.5 no-scrollbar scroll-smooth">
              {groupedCategories.length === 0 ? (
                <div className="py-8 text-center text-theme-muted text-xs italic">
                  Категории не найдены
                </div>
              ) : (
                groupedCategories.map(({ parent, children }) => (
                  <div key={parent.id} className="mb-1 last:mb-0">
                    <button
                      type="button"
                      onClick={() => {
                        onChange(parent.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-3 transition-all",
                        selectedCategoryId === parent.id 
                          ? "bg-theme-primary/10 text-theme-primary font-bold" 
                          : "text-theme-main hover:bg-theme-main"
                      )}
                    >
                      <span className="text-xl shrink-0">{parent.icon}</span>
                      <span>{parent.name}</span>
                    </button>
                    
                    {children.length > 0 && (
                      <div className="ml-4 mt-1 grid grid-cols-1 gap-0.5 border-l-2 border-theme-base/50 pl-2">
                        {children.map(child => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => {
                              onChange(child.id);
                              setIsOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all",
                              selectedCategoryId === child.id 
                                ? "bg-theme-primary/10 text-theme-primary font-bold border-l-2 border-theme-primary" 
                                : "text-theme-muted hover:bg-theme-main hover:text-theme-main"
                            )}
                          >
                            <span className="truncate">{child.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
