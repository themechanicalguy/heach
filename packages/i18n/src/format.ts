import type { Locale } from './locales.js';

/**
 * Money in rupees (I18N-03). Every language uses the Indian grouping with Latin digits, so a
 * price reads the same in Odia, English and Hindi: ₹1,23,456.50. (CLDR's Odia data groups in
 * thousands, which patients would misread.)
 */
export function formatCurrency(rupees: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rupees);
}

/** A date in the user's language, in India time. */
export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(`${locale}-IN`, {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

/** A date and time in the user's language, in India time (AV-04). */
export function formatDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(`${locale}-IN`, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function inIndia(locale: Locale, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(`${locale}-IN`, { ...options, timeZone: 'Asia/Kolkata' });
}

/** A time of day in India time, for slot buttons (AV-04). */
export function formatTime(date: Date, locale: Locale): string {
  return inIndia(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
}

/** The short weekday name of a date in India time, for the day strip. */
export function formatWeekday(date: Date, locale: Locale): string {
  return inIndia(locale, { weekday: 'short' }).format(date);
}

/** The day of the month in India time, for the day strip. */
export function formatDayOfMonth(date: Date, locale: Locale): string {
  return inIndia(locale, { day: 'numeric' }).format(date);
}

/** A month and year in India time, above the day strip. */
export function formatMonthYear(date: Date, locale: Locale): string {
  return inIndia(locale, { month: 'long', year: 'numeric' }).format(date);
}

/** Paise from the API as rupees text (I18N-03). */
export function formatPaise(paise: number): string {
  return formatCurrency(paise / 100);
}
