'use client';

import type { Locale } from '@heach/i18n';
import { useEffect, useRef, useState } from 'react';

/** The spoken language for each site language (PO-07). */
const SPEECH_LANG: Record<Locale, string> = { or: 'or-IN', en: 'en-IN', hi: 'hi-IN' };

const languageOf = (tag: string) => tag.toLowerCase().split(/[-_]/)[0];

/** A voice for the language of the locale, preferring the Indian variant. */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  locale: Locale,
): SpeechSynthesisVoice | undefined {
  const matching = voices.filter((voice) => languageOf(voice.lang) === locale);
  return matching.find((voice) => voice.lang.toLowerCase().endsWith('in')) ?? matching[0];
}

function synthesis(): SpeechSynthesis | undefined {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
    ? window.speechSynthesis
    : undefined;
}

/** The voice for the locale once the browser has reported its voices; none if it has no such voice. */
function useVoice(locale: Locale): SpeechSynthesisVoice | undefined {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | undefined>();
  useEffect(() => {
    const synth = synthesis();
    if (!synth) return undefined;
    const update = () => {
      setVoice(pickVoice(synth.getVoices(), locale));
    };
    update();
    synth.addEventListener('voiceschanged', update);
    return () => {
      synth.removeEventListener('voiceschanged', update);
    };
  }, [locale]);
  return voice;
}

/**
 * Reads `text` aloud with the browser's own speech synthesis (PO-07). `available` is false on the
 * server, until voices are known, and whenever the browser has no voice for the locale. Speech
 * stops when the text changes and when the component goes away.
 */
export function useSpeech(text: string, locale: Locale) {
  const voice = useVoice(locale);
  const [speaking, setSpeaking] = useState(false);
  const current = useRef<SpeechSynthesisUtterance | undefined>(undefined);

  useEffect(
    () => () => {
      if (!current.current) return;
      current.current = undefined;
      synthesis()?.cancel();
      setSpeaking(false);
    },
    [text, locale],
  );

  const stop = () => {
    current.current = undefined;
    synthesis()?.cancel();
    setSpeaking(false);
  };
  const start = (synth: SpeechSynthesis) => {
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG[locale];
    if (voice) utterance.voice = voice;
    const finished = () => {
      if (current.current !== utterance) return;
      current.current = undefined;
      setSpeaking(false);
    };
    utterance.onend = finished;
    utterance.onerror = finished;
    current.current = utterance;
    setSpeaking(true);
    synth.speak(utterance);
  };
  const toggle = () => {
    const synth = synthesis();
    if (!synth) return;
    if (speaking) stop();
    else start(synth);
  };
  return { available: voice !== undefined, speaking, toggle };
}
