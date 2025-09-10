/**
 * Utility functions for handling Kaliningrad timezone (UTC+2)
 */

export const KALININGRAD_TIMEZONE = 'Europe/Kaliningrad';

/**
 * Get current date in Kaliningrad timezone
 */
export function getKaliningradTime(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", {timeZone: KALININGRAD_TIMEZONE}));
}

/**
 * Format date for display in Kaliningrad timezone
 */
export function formatKaliningradDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KALININGRAD_TIMEZONE,
    ...options
  };

  return dateObj.toLocaleString('ru-RU', defaultOptions);
}

/**
 * Format date for display with relative time (today, yesterday, etc.)
 */
export function formatRelativeKaliningradDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = getKaliningradTime();
  
  const dayDiff = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
  
  if (dayDiff === 0) {
    return 'сегодня в ' + formatKaliningradDate(dateObj, { hour: '2-digit', minute: '2-digit' });
  } else if (dayDiff === 1) {
    return 'вчера в ' + formatKaliningradDate(dateObj, { hour: '2-digit', minute: '2-digit' });
  } else if (dayDiff < 7) {
    return `${dayDiff} дн. назад в ` + formatKaliningradDate(dateObj, { hour: '2-digit', minute: '2-digit' });
  } else {
    return formatKaliningradDate(dateObj);
  }
}

/**
 * Get start of day in Kaliningrad timezone
 */
export function getStartOfDayKaliningrad(date?: Date): Date {
  const targetDate = date || getKaliningradTime();
  const startOfDay = new Date(targetDate.toDateString() + ' 00:00:00');
  return new Date(startOfDay.toLocaleString("en-US", {timeZone: KALININGRAD_TIMEZONE}));
}

/**
 * Get end of day in Kaliningrad timezone
 */
export function getEndOfDayKaliningrad(date?: Date): Date {
  const targetDate = date || getKaliningradTime();
  const endOfDay = new Date(targetDate.toDateString() + ' 23:59:59');
  return new Date(endOfDay.toLocaleString("en-US", {timeZone: KALININGRAD_TIMEZONE}));
}