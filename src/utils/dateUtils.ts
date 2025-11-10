import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDate(date: number | Date, formatStr: string = 'PP'): string {
  return format(date, formatStr, { locale: es });
}

export function formatRelativeDate(date: number | Date): string {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  
  if (isToday(dateObj)) {
    return 'Hoy';
  }
  if (isTomorrow(dateObj)) {
    return 'Mañana';
  }
  if (isYesterday(dateObj)) {
    return 'Ayer';
  }
  
  return formatDistanceToNow(dateObj, { addSuffix: true, locale: es });
}

export function formatDateTime(date: number | Date): string {
  return format(date, 'PPp', { locale: es });
}
