import { createTranslator } from '@heach/i18n';
import { errorReason } from './api';
import en from '../messages/en.json';

/** Admin is English only for the first release, but every string still comes from a key. */
export const t = createTranslator(en);

type ErrorKey = keyof typeof en.errors;

/** The translated message for a failed call. */
export function errorText(error: unknown): string {
  return t(`errors.${errorReason(error, Object.keys(en.errors)) as ErrorKey}`);
}
