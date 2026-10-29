'use client';

import { Notice } from '@heach/ui';
import type { Organisation } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { ClinicName } from './ClinicName';
import { InviteForm } from './InviteForm';
import { MemberList } from './MemberList';

/**
 * A lab's or clinic's staff, run by its owner (owner decision O-1): invite by mobile number,
 * revoke an invitation, remove a member. Staff can sign in at once; lab or clinic work opens only
 * once the organisation is approved.
 */
export function TeamView() {
  const { t } = useI18n();
  const { resource, reload } = useResource<Organisation>('/organisation');
  return (
    <section className="flow" aria-labelledby="team-title">
      <div className="flow__card">
        <h1 id="team-title" className="flow__title">
          {t('team.title')}
        </h1>
        <ResourceView resource={resource} reload={reload}>
          {(organisation) => (
            <>
              {organisation.kind === 'clinic' && (
                <ClinicName name={organisation.name} onSaved={reload} />
              )}
              {organisation.name && (
                <>
                  <p className="flow__muted">{organisation.name}</p>
                  <Notice tone={organisation.approved ? 'success' : 'info'}>
                    {t(organisation.approved ? 'team.approved' : 'team.notApproved')}
                  </Notice>
                  <InviteForm staffRole={organisation.staffRole} onInvited={reload} />
                  <MemberList members={organisation.members} onChanged={reload} />
                </>
              )}
            </>
          )}
        </ResourceView>
      </div>
    </section>
  );
}
