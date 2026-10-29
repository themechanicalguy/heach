'use client';

import type { OtpChallenge } from '@heach/types';
import { Notice } from '@heach/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAccount } from '../../lib/account';
import { useI18n } from '../../lib/i18n-context';
import { destinationFor } from '../../lib/routing';
import { useSession } from '../../lib/session';
import { CodeStep } from './CodeStep';
import { MobileStep } from './MobileStep';

type Stage = { kind: 'mobile' } | { kind: 'code'; challenge: OtpChallenge; lastDigits: string };

/**
 * OTP sign-up and sign-in (AC-01): one flow for new and returning users. After the code, the
 * account decides the next page: setup, consent, the asked-for page or the role's home.
 */
export function SignInFlow({ next }: Readonly<{ next?: string | undefined }>) {
  const { t } = useI18n();
  const { adoptToken } = useSession();
  const { reload } = useAccount();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: 'mobile' });

  const signedIn = async (accessToken: string) => {
    adoptToken(accessToken);
    router.replace(destinationFor(await reload(), next));
  };

  return (
    <section className="flow" aria-labelledby="sign-in-title">
      <div className="flow__card">
        <h1 id="sign-in-title" className="flow__title">
          {stage.kind === 'mobile' ? t('signIn.title') : t('signIn.codeTitle')}
        </h1>
        {stage.kind === 'mobile' ? (
          <>
            <p>{t('signIn.intro')}</p>
            <MobileStep
              onSent={(challenge, lastDigits) => {
                setStage({ kind: 'code', challenge, lastDigits });
              }}
            />
          </>
        ) : (
          <CodeStep
            key={stage.challenge.challengeId}
            challenge={stage.challenge}
            lastDigits={stage.lastDigits}
            onSignedIn={signedIn}
            onChangeNumber={() => {
              setStage({ kind: 'mobile' });
            }}
          />
        )}
        <Notice>{t('signIn.privacy')}</Notice>
        <p className="emergency-note">{t('signIn.emergency')}</p>
      </div>
    </section>
  );
}
