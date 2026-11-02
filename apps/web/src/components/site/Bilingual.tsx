import { createTranslator, messagesFor } from '@heach/i18n';
import type { T } from '../../i18n/messages';
import { translatorFor } from '../../i18n/messages';

/** Odia first, with the selected secondary language; language attributes aid pronunciation. */
export function Bilingual({
  message,
  locale,
}: Readonly<{ message: Parameters<T>[0]; locale: string }>) {
  const { t } = translatorFor(locale);
  const odia = createTranslator(messagesFor('or'), 'or');
  return (
    <span className="bilingual">
      <span lang="or">{odia(message)}</span>
      {locale !== 'or' && (
        <span lang={locale} className="bilingual__secondary">
          {t(message)}
        </span>
      )}
    </span>
  );
}
