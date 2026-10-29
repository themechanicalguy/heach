'use client';

import { Button, Card, EmptyState, Notice, TextField } from '@heach/ui';
import type {
  HistoryEntry,
  LinkCreated,
  LinkedPatient,
  VaultRecord,
  VaultUsage,
} from '@heach/types';
import { useState } from 'react';
import { api, UPLOAD_CONTENT_TYPE } from '../../lib/api';
import { readAsBase64 } from '../../lib/files';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { Select } from '../care/SearchView';
import { RecordCard } from './RecordCard';

const TYPES = [
  'prescription',
  'lab_report',
  'scan',
  'discharge_summary',
  'vaccination',
  'visit_note',
  'other',
] as const;
const KINDS = [
  'allergy',
  'condition',
  'medicine',
  'surgery',
  'blood_group',
  'vaccination',
  'family_history',
] as const;

/** The vault (J9; MV-01 to MV-12, MV-15): timeline with filters, uploads, history, external links. */
export function VaultView() {
  const { t } = useI18n();
  const [filters, setFilters] = useState({ person: '', type: '', q: '' });
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  ).toString();
  const records = useResource<VaultRecord[]>(query ? `/vault?${query}` : '/vault');
  const people = useResource<LinkedPatient[]>('/me/linked-patients');
  const usage = useResource<VaultUsage>('/vault/usage');
  const linked = people.resource.state === 'ready' ? people.resource.data : [];
  const set = (key: keyof typeof filters) => (value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const refresh = async () => {
    await records.reload();
    await usage.reload();
  };
  return (
    <section className="flow" aria-labelledby="vault-title">
      <div className="flow__card">
        <h1 id="vault-title" className="flow__title">
          {t('vault.title')}
        </h1>
        <p>{t('vault.intro')}</p>
        {usage.resource.state === 'ready' && <Usage usage={usage.resource.data} />}
        <Select
          label={t('vault.person')}
          value={filters.person}
          onChange={set('person')}
          options={[
            ['', t('vault.everyone')],
            ['self', t('vault.myself')],
            ...linked.map((person): [string, string] => [person.id, person.fullName]),
          ]}
        />
        <Select
          label={t('vault.type')}
          value={filters.type}
          onChange={set('type')}
          options={[
            ['', t('vault.anyType')],
            ...TYPES.map((type): [string, string] => [type, t(`vault.types.${type}`)]),
          ]}
        />
        <TextField
          label={t('vault.search')}
          value={filters.q}
          onChange={(event) => {
            set('q')(event.currentTarget.value);
          }}
        />
        <ResourceView resource={records.resource} reload={records.reload}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState message={t('vault.empty')} />
            ) : (
              <ul className="role-list">
                {rows.map((record) => (
                  <li key={record.id}>
                    <RecordCard
                      record={record}
                      showAccess
                      onDelete={async () => {
                        await api(`/vault/records/${record.id}`, { method: 'DELETE' });
                        await refresh();
                      }}
                    />
                  </li>
                ))}
              </ul>
            )
          }
        </ResourceView>
        <UploadForm people={linked} onSaved={refresh} />
        <HistorySection />
        {records.resource.state === 'ready' && <LinkForm records={records.resource.data} />}
      </div>
    </section>
  );
}

function Usage({ usage }: Readonly<{ usage: VaultUsage }>) {
  const { t } = useI18n();
  const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;
  return (
    <>
      <p className="flow__muted">
        {t('vault.usage', { used: mb(usage.usedBytes), quota: mb(usage.quotaBytes) })}
      </p>
      {usage.nearlyFull && <Notice tone="warning">{t('vault.nearlyFull')}</Notice>}
    </>
  );
}

type UploadFields = Record<
  'personId' | 'recordType' | 'recordDate' | 'title' | 'facility' | 'tags' | 'notes',
  string
>;

/** The upload's JSON body: only the fields the patient filled in, and the file as base64. */
async function uploadBody(form: UploadFields, file: File | undefined) {
  const tags = form.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return {
    recordType: form.recordType,
    recordDate: form.recordDate,
    title: form.title,
    ...(form.personId ? { personId: form.personId } : {}),
    ...(form.facility ? { facility: form.facility } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(form.notes ? { notes: form.notes } : {}),
    ...(file ? { file: { contentType: file.type, contentBase64: await readAsBase64(file) } } : {}),
  };
}

function UploadForm({
  people,
  onSaved,
}: Readonly<{ people: readonly LinkedPatient[]; onSaved: () => Promise<void> }>) {
  const { t } = useI18n();
  const [form, setForm] = useState<UploadFields>({
    personId: '',
    recordType: 'prescription',
    recordDate: '',
    title: '',
    facility: '',
    tags: '',
    notes: '',
  });
  const [file, setFile] = useState<File | undefined>();
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = usePending();
  const field = (key: keyof typeof form, label: string, extra: Record<string, unknown> = {}) => (
    <TextField
      label={label}
      value={form[key]}
      {...extra}
      onChange={(event) => {
        const value = event.currentTarget.value;
        setForm((current) => ({ ...current, [key]: value }));
        setSaved(false);
      }}
    />
  );
  const save = () =>
    run(async () => {
      const body = await uploadBody(form, file);
      await api('/vault/records', {
        method: 'POST',
        headers: { 'content-type': UPLOAD_CONTENT_TYPE },
        body: JSON.stringify(body),
      });
      setSaved(true);
      setFile(undefined);
      await onSaved();
    });
  return (
    <Card title={t('vault.uploadTitle')}>
      <Select
        label={t('vault.person')}
        value={form.personId}
        onChange={(value) => {
          setForm((current) => ({ ...current, personId: value }));
        }}
        options={[
          ['', t('vault.myself')],
          ...people.map((person): [string, string] => [person.id, person.fullName]),
        ]}
      />
      <Select
        label={t('vault.type')}
        value={form.recordType}
        onChange={(value) => {
          setForm((current) => ({ ...current, recordType: value }));
        }}
        options={TYPES.map((type): [string, string] => [type, t(`vault.types.${type}`)])}
      />
      {field('title', t('vault.recordTitle'))}
      {field('recordDate', t('vault.recordDate'), { type: 'date' })}
      {field('facility', t('vault.facility'))}
      {field('tags', t('vault.tags'))}
      {field('notes', t('vault.notes'))}
      <TextField
        label={t('vault.file')}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        capture="environment"
        onChange={(event) => {
          setFile(event.currentTarget.files?.[0]);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {saved && (
        <Notice tone="success" live>
          {t('vault.saved')}
        </Notice>
      )}
      <Button onClick={() => void save()} disabled={pending || !form.title || !form.recordDate}>
        {t('vault.save')}
      </Button>
    </Card>
  );
}

function HistorySection() {
  const { t } = useI18n();
  const { resource, reload } = useResource<HistoryEntry[]>('/vault/history');
  const [kind, setKind] = useState<string>('allergy');
  const [text, setText] = useState('');
  const { pending, error, run } = usePending();
  const entries = resource.state === 'ready' ? resource.data : [];
  return (
    <Card title={t('vault.historyTitle')}>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <strong>{t(keyFor('vault.kinds', entry.kind, 'vault.historyTitle'))}</strong>:{' '}
            {entry.text}{' '}
            <Button
              className="heach-button--secondary"
              disabled={pending}
              onClick={() =>
                void run(async () => {
                  await api(`/vault/history/${entry.id}`, { method: 'DELETE' });
                  await reload();
                })
              }
            >
              {t('vault.remove')}
            </Button>
          </li>
        ))}
      </ul>
      <Select
        label={t('vault.historyKind')}
        value={kind}
        onChange={setKind}
        options={KINDS.map((value): [string, string] => [value, t(`vault.kinds.${value}`)])}
      />
      <TextField
        label={t('vault.historyText')}
        value={text}
        onChange={(event) => {
          setText(event.currentTarget.value);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button
        disabled={pending || !text}
        onClick={() =>
          void run(async () => {
            await api('/vault/history', { method: 'POST', body: JSON.stringify({ kind, text }) });
            setText('');
            await reload();
          })
        }
      >
        {t('vault.addHistory')}
      </Button>
    </Card>
  );
}

/** A link for a doctor outside HEACH (MV-09): the link and code are shown once. */
function LinkForm({ records }: Readonly<{ records: readonly VaultRecord[] }>) {
  const { locale, t } = useI18n();
  const [chosen, setChosen] = useState<string[]>([]);
  const [hours, setHours] = useState('24');
  const [created, setCreated] = useState<LinkCreated | undefined>();
  const { pending, error, run } = usePending();
  if (records.length === 0) return null;
  return (
    <Card title={t('vault.linkTitle')}>
      <RecordPicker records={records} chosen={chosen} onChange={setChosen} />
      <TextField
        label={t('vault.linkHours')}
        type="number"
        min={1}
        max={72}
        value={hours}
        onChange={(event) => {
          setHours(event.currentTarget.value);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {created ? (
        <Notice tone="success" live>
          {t('vault.linkCreated')} {`${window.location.origin}/${locale}/shared/${created.token}`} ·{' '}
          {t('vault.linkCode', { code: created.code })}
        </Notice>
      ) : (
        <Button
          disabled={pending || chosen.length === 0}
          onClick={() =>
            void run(async () => {
              setCreated(
                await api<LinkCreated>('/vault/links', {
                  method: 'POST',
                  body: JSON.stringify({ recordIds: chosen, hours: Number(hours) }),
                }),
              );
            })
          }
        >
          {t('vault.createLink')}
        </Button>
      )}
    </Card>
  );
}

export function RecordPicker({
  records,
  chosen,
  onChange,
}: Readonly<{
  records: readonly VaultRecord[];
  chosen: readonly string[];
  onChange: (ids: string[]) => void;
}>) {
  return (
    <fieldset>
      {records.map((record) => (
        <label key={record.id} className="heach-checkbox">
          <input
            type="checkbox"
            checked={chosen.includes(record.id)}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              onChange(checked ? [...chosen, record.id] : chosen.filter((id) => id !== record.id));
            }}
          />
          <span>{record.title}</span>
        </label>
      ))}
    </fieldset>
  );
}
