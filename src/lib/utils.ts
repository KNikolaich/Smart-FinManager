import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTransactionDisplayTitle(description: string | undefined, categoryName: string | undefined, type: string) {
  if (!description || description.trim() === '') {
    return categoryName || (type === 'transfer' ? 'Перевод' : 'Без описания');
  }
  
  // If description starts with non-letter and non-digit (service characters)
  // [а-яА-ЯёЁ] - Russian letters
  // [a-zA-Z] - Latin letters
  // [0-9] - Digits
  const startsWithNormalChar = /^[а-яА-ЯёЁa-zA-Z0-9]/.test(description.trim());
  
  if (!startsWithNormalChar) {
    return categoryName || (type === 'transfer' ? 'Перевод' : 'Без описания');
  }
  
  return description;
}
