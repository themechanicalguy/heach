import { CATALOGUES, type Locale } from '@heach/i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n-context';
import { ListenButton } from './ListenButton';

type Listener = () => void;

class FakeUtterance {
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}

const voice = (lang: string) => ({ lang, name: lang }) as SpeechSynthesisVoice;

function installSpeech(voices: SpeechSynthesisVoice[]) {
  const listeners = new Set<Listener>();
  const synth = {
    getVoices: vi.fn(() => voices),
    speak: vi.fn(),
    cancel: vi.fn(),
    addEventListener: vi.fn((_type: string, listener: Listener) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: Listener) => {
      listeners.delete(listener);
    }),
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return { synth, voices, listeners };
}

const renderStep = (locale: Locale, step: 'identity' | 'documents' | 'review' = 'identity') => {
  const tree = (current: typeof step) => (
    <I18nProvider locale={locale} messages={CATALOGUES[locale]}>
      <ListenButton step={current} />
    </I18nProvider>
  );
  const view = render(tree(step));
  return {
    ...view,
    setStep: (next: typeof step) => {
      view.rerender(tree(next));
    },
  };
};

const spoken = (synth: { speak: ReturnType<typeof vi.fn> }): FakeUtterance =>
  synth.speak.mock.calls[0]?.[0] as FakeUtterance;

beforeEach(() => {
  Reflect.deleteProperty(window, 'speechSynthesis');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'speechSynthesis');
});

describe('PO-07 Listen button: availability', () => {
  it('PO-07 is hidden when the browser has no speech synthesis', () => {
    renderStep('en');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('PO-07 is hidden when no voice matches the language', () => {
    installSpeech([voice('fr-FR'), voice('de-DE')]);
    renderStep('or');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([
    ['or', 'ଶୁଣନ୍ତୁ', 'or-IN'],
    ['en', 'Listen', 'en-IN'],
    ['hi', 'सुनें', 'hi-IN'],
  ] as const)('PO-07 is shown in %s when a voice exists', (locale, label, lang) => {
    installSpeech([voice('fr-FR'), voice(lang)]);
    renderStep(locale);
    expect(screen.getByRole('button', { name: label })).toBeTruthy();
  });

  it('PO-07 accepts an underscore language tag and prefers the Indian voice', () => {
    const { synth } = installSpeech([voice('hi_US'), voice('hi_IN')]);
    renderStep('hi');
    fireEvent.click(screen.getByRole('button'));
    expect(spoken(synth).voice?.lang).toBe('hi_IN');
  });

  it('PO-07 appears when voices load later, and stops listening on unmount', () => {
    const { voices, listeners, synth } = installSpeech([]);
    const { unmount } = renderStep('en');
    expect(screen.queryByRole('button')).toBeNull();
    voices.push(voice('en-GB'));
    act(() => {
      listeners.forEach((listener) => {
        listener();
      });
    });
    expect(screen.getByRole('button', { name: 'Listen' })).toBeTruthy();
    unmount();
    expect(listeners.size).toBe(0);
    expect(synth.removeEventListener).toHaveBeenCalled();
  });
});

describe('PO-07 Listen button: speaking', () => {
  it.each([
    ['or', 'or-IN'],
    ['en', 'en-IN'],
    ['hi', 'hi-IN'],
  ] as const)('PO-07 speaks the step text in %s with the right language', (locale, lang) => {
    const { synth } = installSpeech([voice(lang)]);
    renderStep(locale, 'documents');
    fireEvent.click(screen.getByRole('button'));
    const utterance = spoken(synth);
    expect(utterance.text).toBe(CATALOGUES[locale].application.voice.documents);
    expect(utterance.lang).toBe(lang);
    expect(utterance.voice?.lang).toBe(lang);
  });

  it('PO-07 turns into Stop while speaking, and cancels when pressed again', () => {
    const { synth } = installSpeech([voice('en-IN')]);
    renderStep('en');
    fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
    synth.cancel.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Listen' })).toBeTruthy();
  });

  it('PO-07 goes back to Listen when the speech ends', () => {
    const { synth } = installSpeech([voice('en-IN')]);
    renderStep('en');
    fireEvent.click(screen.getByRole('button'));
    act(() => {
      spoken(synth).onend?.();
    });
    expect(screen.getByRole('button', { name: 'Listen' })).toBeTruthy();
  });

  it('PO-07 cancels when the step changes', () => {
    const { synth } = installSpeech([voice('en-IN')]);
    const { setStep } = renderStep('en', 'identity');
    fireEvent.click(screen.getByRole('button'));
    synth.cancel.mockClear();
    setStep('review');
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Listen' })).toBeTruthy();
  });

  it('PO-07 cancels when the component unmounts', () => {
    const { synth } = installSpeech([voice('en-IN')]);
    const { unmount } = renderStep('en');
    fireEvent.click(screen.getByRole('button'));
    synth.cancel.mockClear();
    unmount();
    expect(synth.cancel).toHaveBeenCalled();
  });
});
