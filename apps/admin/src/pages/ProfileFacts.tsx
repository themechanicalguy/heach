import type { ApplicationReview } from '@heach/types';
import { t } from '../i18n';
import { StoredFileButton } from './StoredFileButton';

interface Props {
  accountId: string;
  profile: ApplicationReview['profile'];
}

/** What the provider will publish (PO-05), for the verifier to read before approving. */
export function ProfileFacts({ accountId, profile }: Readonly<Props>) {
  const photo = profile.photoVerified ? t('verification.photoVerified') : '';
  return (
    <>
      <h3>{t('verification.profile')}</h3>
      <dl className="admin-facts">
        <dt>{t('verification.qualifications')}</dt>
        <dd>{profile.qualifications ?? t('verification.notGiven')}</dd>
        <dt>{t('verification.experience')}</dt>
        <dd>{profile.experienceYears ?? t('verification.notGiven')}</dd>
        <dt>{t('verification.photo')}</dt>
        <dd>
          {profile.hasPhoto ? (
            <>
              {photo} <StoredFileButton path={`/applications/${accountId}/photo`} />
            </>
          ) : (
            t('verification.noPhoto')
          )}
        </dd>
      </dl>
    </>
  );
}
