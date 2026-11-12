import { Button, Notice } from '@heach/ui';
import type { AssistedSession } from '@heach/types';
import { api } from '../api';
import { t } from '../i18n';
import { usePending } from '../use-pending';
import type { SessionHandler } from '../use-assisted-call';
import { ErrorNotice } from './AssistedParts';

interface Props {
  session: AssistedSession;
  onSession: SessionHandler;
}

/** Who is being helped (masked) and until when, with a way to end the session at once. */
export function AssistedSessionBar({ session, onSession }: Readonly<Props>) {
  const { pending, error, run } = usePending();
  const end = () =>
    run(async () => {
      await api(`/assisted-onboarding/sessions/${session.sessionId}/end`, { method: 'POST' });
      onSession(null);
    });
  return (
    <section aria-label={t('assisted.session')}>
      <dl className="admin-facts">
        <dt>{t('assisted.session')}</dt>
        <dd>{[session.mobile, session.maskedName].filter(Boolean).join(' · ')}</dd>
        <dt>{t('assisted.endsAt')}</dt>
        <dd>{new Date(session.expiresAt).toLocaleTimeString('en-IN')}</dd>
      </dl>
      {session.accountCreated && <Notice tone="success">{t('assisted.accountCreated')}</Notice>}
      <ErrorNotice error={error} />
      <Button className="heach-button--secondary" onClick={() => void end()} disabled={pending}>
        {t('assisted.end')}
      </Button>
    </section>
  );
}
