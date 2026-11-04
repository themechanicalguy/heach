'use client';

import { Button, ChoiceGroup, Icon, Notice, Sheet, TextField } from '@heach/ui';
import type { LinkedPatient, VaultRecord, VaultUsage } from '@heach/types';
import { useEffect, useState } from 'react';
import { useCareSearch } from '../../lib/care-search';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { HealthProfile } from './HealthProfile';
import { LinkForm } from './LinkForm';
import { RECORD_TYPES } from './record-types';
import { UploadForm } from './UploadForm';
import { VaultTimeline } from './VaultTimeline';

type Task = { kind: 'upload' } | { kind: 'share'; recordIds: string[] } | undefined;

/**
 * The vault (J9; MV-01 to MV-12, MV-15), browsing first (G10): whose records, type chips and
 * search, then the timeline. Adding, sharing and editing the history open as focused tasks.
 */
export function VaultView() {
  const { t } = useI18n();
  const { filters, set, body } = useVaultFilters();
  const [task, setTask] = useState<Task>();
  const [saved, setSaved] = useState(false);
  const records = useResource<VaultRecord[]>('/vault/search', body);
  const people = useResource<LinkedPatient[]>('/me/linked-patients');
  const usage = useResource<VaultUsage>('/vault/usage');
  const linked = people.resource.state === 'ready' ? people.resource.data : [];
  const refresh = async () => {
    await records.reload();
    await usage.reload();
  };
  const close = () => {
    setTask(undefined);
  };
  const rows = records.resource.state === 'ready' ? records.resource.data : [];
  return (
    <section className="vault" aria-labelledby="vault-title">
      <header className="vault__head">
        <div>
          <h1 id="vault-title" className="flow__title">
            {t('vault.title')}
          </h1>
          <span className="vault__lock">
            <Icon name="lock" size={16} />
            {t('vault.encrypted')}
          </span>
        </div>
        <Button
          className="heach-button--compact vault__add"
          onClick={() => {
            setSaved(false);
            setTask({ kind: 'upload' });
          }}
        >
          <Icon name="plus" size={20} />
          {t('vault.add')}
        </Button>
      </header>
      <div className="vault__people vault-card">
        <ChoiceGroup
          legend={t('vault.recordsFor')}
          variant="chips"
          name="vault-person"
          value={filters.person}
          onChange={set('person')}
          choices={[
            { value: 'self', label: t('vault.myself') },
            ...linked.map((entry) => ({ value: entry.id, label: entry.fullName })),
            { value: '', label: t('vault.everyone') },
          ]}
        />
      </div>
      <div className="vault__main">
        <VaultFilters type={filters.type} q={filters.q} set={set} />
        {saved && (
          <Notice tone="success" live>
            {t('vault.saved')}
          </Notice>
        )}
        <ResourceView resource={records.resource} reload={records.reload}>
          {(found) => (
            <VaultTimeline
              records={found}
              onRefresh={refresh}
              onShare={(id) => {
                setTask({ kind: 'share', recordIds: [id] });
              }}
            />
          )}
        </ResourceView>
      </div>
      <div className="vault__side">
        <HealthProfile person={filters.person} />
        <VaultSafety usage={usage.resource.state === 'ready' ? usage.resource.data : undefined} />
      </div>
      <VaultTasks
        task={task}
        onClose={close}
        people={linked}
        person={filters.person}
        records={rows}
        onSaved={async () => {
          close();
          setSaved(true);
          await refresh();
        }}
      />
    </section>
  );
}

type Filters = Record<'person' | 'type' | 'q', string>;

/** Whose records, the type and the search; the person follows the header's picker. */
function useVaultFilters() {
  const { person, setPerson } = useCareSearch();
  const [filters, setFilters] = useState<Filters>({ person: person || 'self', type: '', q: '' });
  useEffect(() => {
    setFilters((current) => ({ ...current, person: person || 'self' }));
  }, [person]);
  const set = (key: keyof Filters) => (value: string) => {
    if (key === 'person') setPerson(value === 'self' ? '' : value);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const body = JSON.stringify(
    Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
  );
  return { filters, set, body };
}

/** Type chips and search in one compact row (G11), not stacked full-width fields. */
function VaultFilters({
  type,
  q,
  set,
}: Readonly<{ type: string; q: string; set: (key: keyof Filters) => (value: string) => void }>) {
  const { t } = useI18n();
  return (
    <div className="vault__filters">
      <ChoiceGroup
        legend={t('vault.typeFilter')}
        variant="chips"
        name="vault-type"
        value={type}
        onChange={set('type')}
        choices={[
          { value: '', label: t('vault.anyType') },
          ...RECORD_TYPES.map((entry) => ({ value: entry, label: t(`vault.types.${entry}`) })),
        ]}
      />
      <TextField
        label={t('vault.search')}
        type="search"
        value={q}
        onChange={(event) => {
          set('q')(event.currentTarget.value);
        }}
      />
    </div>
  );
}

interface TasksProps {
  task: Task;
  onClose: () => void;
  people: readonly LinkedPatient[];
  person: string;
  records: readonly VaultRecord[];
  onSaved: () => Promise<void>;
}

/** Adding a record and sharing records as focused tasks in sheets (G10, G12). */
function VaultTasks({ task, onClose, people, person, records, onSaved }: Readonly<TasksProps>) {
  const { t } = useI18n();
  return (
    <>
      <Sheet
        open={task?.kind === 'upload'}
        title={t('vault.uploadTitle')}
        closeLabel={t('ui.close')}
        onClose={onClose}
      >
        {task?.kind === 'upload' && (
          <UploadForm people={people} person={person} onSaved={onSaved} />
        )}
      </Sheet>
      <Sheet
        open={task?.kind === 'share'}
        title={t('vault.linkTitle')}
        closeLabel={t('ui.close')}
        onClose={onClose}
      >
        {task?.kind === 'share' && <LinkForm records={records} initial={task.recordIds} />}
      </Sheet>
    </>
  );
}

/** The encryption reassurance and storage use (design reference: "All records are encrypted"). */
function VaultSafety({ usage }: Readonly<{ usage: VaultUsage | undefined }>) {
  const { t } = useI18n();
  const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;
  return (
    <div className="vault-safety">
      <p className="vault-safety__note">
        <Icon name="lock" size={18} />
        {t('vault.intro')}
      </p>
      {usage && (
        <p className="flow__muted">
          {t('vault.usage', { used: mb(usage.usedBytes), quota: mb(usage.quotaBytes) })}
        </p>
      )}
      {usage?.nearlyFull && <Notice tone="warning">{t('vault.nearlyFull')}</Notice>}
    </div>
  );
}
