'use client';

import { Button, Notice, TextField } from '@heach/ui';
import type { LinkedPatient } from '@heach/types';
import { useState } from 'react';
import { api, UPLOAD_CONTENT_TYPE } from '../../lib/api';
import { readAsBase64 } from '../../lib/files';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { Select } from '../care/SearchView';
import { RECORD_TYPES } from './record-types';

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

/** Adding a record (MV-03), opened as a focused task from Add record (G10). */
export function UploadForm({
  people,
  person,
  onSaved,
}: Readonly<{
  people: readonly LinkedPatient[];
  /** Who the vault is showing; the new record is for them unless changed. */
  person: string;
  onSaved: () => Promise<void>;
}>) {
  const { t } = useI18n();
  const [form, setForm] = useState<UploadFields>({
    personId: person === 'self' ? '' : person,
    recordType: 'prescription',
    recordDate: '',
    title: '',
    facility: '',
    tags: '',
    notes: '',
  });
  const [file, setFile] = useState<File | undefined>();
  const { pending, error, run } = usePending();
  const field = (key: keyof typeof form, label: string, extra: Record<string, unknown> = {}) => (
    <TextField
      label={label}
      value={form[key]}
      {...extra}
      onChange={(event) => {
        const value = event.currentTarget.value;
        setForm((current) => ({ ...current, [key]: value }));
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
      setFile(undefined);
      await onSaved();
    });
  return (
    <div className="flow__form">
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
        options={RECORD_TYPES.map((type): [string, string] => [type, t(`vault.types.${type}`)])}
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
      <Button onClick={() => void save()} disabled={pending || !form.title || !form.recordDate}>
        {t('vault.save')}
      </Button>
    </div>
  );
}
