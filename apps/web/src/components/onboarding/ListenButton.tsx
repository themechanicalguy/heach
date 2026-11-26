'use client';

import { Button } from '@heach/ui';
import { useI18n } from '../../lib/i18n-context';
import type { EditableStep } from './ReviewStep';
import { useSpeech } from './use-speech';

/**
 * Reads the instructions of one onboarding step aloud (PO-07), for providers who read with
 * difficulty. Only the fixed catalogue text is spoken, never anything the provider entered.
 * Renders nothing when the browser cannot speak in the page language.
 */
export function ListenButton({ step }: Readonly<{ step: EditableStep | 'review' }>) {
  const { locale, t } = useI18n();
  const { available, speaking, toggle } = useSpeech(t(`application.voice.${step}`), locale);
  if (!available) return null;
  return (
    <Button className="heach-button--secondary" onClick={toggle}>
      {t(speaking ? 'application.voice.stop' : 'application.voice.listen')}
    </Button>
  );
}
