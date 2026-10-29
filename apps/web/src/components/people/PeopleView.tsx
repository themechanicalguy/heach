'use client';

import { Button, Card, EmptyState, Notice } from '@heach/ui';
import type { LinkedPatient, LinkedPatientInput } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { LinkedPatientForm } from './LinkedPatientForm';

type Editing = { kind: 'none' } | { kind: 'new' } | { kind: 'edit'; person: LinkedPatient };

/**
 * The people this account books for (AC-03): family members with a profile here but no sign-in
 * of their own (default D-1). Only this account can see or change them.
 */
export function PeopleView() {
  const { t } = useI18n();
  const { resource, reload } = useResource<LinkedPatient[]>('/me/linked-patients');
  const [editing, setEditing] = useState<Editing>({ kind: 'none' });
  const close = () => {
    setEditing({ kind: 'none' });
  };
  const save = async (body: LinkedPatientInput) => {
    const json = JSON.stringify(body);
    if (editing.kind === 'edit') {
      await api(`/me/linked-patients/${editing.person.id}`, { method: 'PUT', body: json });
    } else {
      await api('/me/linked-patients', { method: 'POST', body: json });
    }
    await reload();
    close();
  };

  return (
    <section className="flow" aria-labelledby="people-title">
      <div className="flow__card">
        <h1 id="people-title" className="flow__title">
          {t('people.title')}
        </h1>
        <p>{t('people.intro')}</p>
        {editing.kind === 'none' ? (
          <ResourceView resource={resource} reload={reload}>
            {(people) => (
              <PeopleList
                people={people}
                onEdit={(person) => {
                  setEditing({ kind: 'edit', person });
                }}
                onRemoved={reload}
              />
            )}
          </ResourceView>
        ) : (
          <LinkedPatientForm
            person={editing.kind === 'edit' ? editing.person : undefined}
            onSave={save}
            onCancel={close}
          />
        )}
        {editing.kind === 'none' && (
          <Button
            onClick={() => {
              setEditing({ kind: 'new' });
            }}
          >
            {t('people.add')}
          </Button>
        )}
      </div>
    </section>
  );
}

interface ListProps {
  people: LinkedPatient[];
  onEdit: (person: LinkedPatient) => void;
  onRemoved: () => Promise<void>;
}

function PeopleList({ people, onEdit, onRemoved }: Readonly<ListProps>) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState<string | undefined>();
  const { pending, error, run } = usePending();
  if (people.length === 0) return <EmptyState message={t('people.empty')} />;
  const remove = (id: string) =>
    run(async () => {
      await api(`/me/linked-patients/${id}`, { method: 'DELETE' });
      setConfirming(undefined);
      await onRemoved();
    });

  return (
    <>
      <ul className="role-list">
        {people.map((person) => (
          <li key={person.id}>
            <Card title={person.fullName}>
              <p className="flow__muted">
                {t('people.summary', {
                  relationship: t(`people.relationships.${person.relationship}`),
                  year: String(person.birthYear),
                })}
              </p>
              <Button
                className="heach-button--secondary"
                onClick={() => {
                  onEdit(person);
                }}
                disabled={pending}
              >
                {t('people.edit')}
              </Button>
              {confirming === person.id ? (
                <Button
                  className="heach-button--danger"
                  onClick={() => void remove(person.id)}
                  disabled={pending}
                >
                  {t('people.confirmRemove', { name: person.fullName })}
                </Button>
              ) : (
                <Button
                  className="heach-button--link"
                  onClick={() => {
                    setConfirming(person.id);
                  }}
                  disabled={pending}
                >
                  {t('people.remove')}
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
    </>
  );
}
