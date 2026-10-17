'use client';

import { Button, Card } from '@heach/ui';
import { useRouter } from 'next/navigation';
import { useI18n } from '../lib/i18n-context';
import { useSession } from '../lib/session';

/** Synthetic identities seeded by API migration 0002; never real people (SE-07.4). */
const TEST_PATIENTS = {
  patientA: '00000000-0000-4000-8000-000000000001',
  patientB: '00000000-0000-4000-8000-000000000002',
} as const;

/** Test identity adapter UI: dev and test only; Step 3 replaces it with OTP sign-in. */
export function TestSignIn() {
  const { locale, t } = useI18n();
  const { status, signInAsTestUser, signOut } = useSession();
  const router = useRouter();
  const signIn = async (userId: string) => {
    await signInAsTestUser(userId);
    router.push(`/${locale}/notes`);
  };
  return (
    <Card title={t('auth.test.title')}>
      <p>{t('auth.test.hint')}</p>
      <div className="actions">
        {(['patientA', 'patientB'] as const).map((key) => (
          <Button key={key} onClick={() => void signIn(TEST_PATIENTS[key])}>
            {t(`auth.test.${key}`)}
          </Button>
        ))}
        {status === 'signed-in' && (
          <Button className="heach-button--ghost" onClick={() => void signOut()}>
            {t('auth.signOut')}
          </Button>
        )}
      </div>
    </Card>
  );
}
