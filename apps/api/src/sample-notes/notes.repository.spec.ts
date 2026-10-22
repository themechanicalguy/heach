import { EnvelopeEncryptor, InMemoryDataKeyStore, LocalKeyProvider } from '@heach/crypto';
import type pg from 'pg';
import type { AuditService } from '../audit/audit.service.js';
import { NotesRepository } from './notes.repository.js';

const OWNER = '00000000-0000-4000-8000-000000000001';
const NOTE_ID = '11111111-1111-4111-8111-111111111111';

/** One fake connection serves both the pool and transactions; `log` records the order of events. */
function setup() {
  const log: string[] = [];
  const query = vi.fn((sql: string) => {
    log.push(sql.split(' ')[0] ?? sql);
    return Promise.resolve({ rows: [] });
  });
  const release = vi.fn();
  const pool = { query, connect: vi.fn().mockResolvedValue({ query, release }) };
  const audit = {
    record: vi.fn(() => {
      log.push('audit');
      return Promise.resolve();
    }),
  };
  const encryptor = new EnvelopeEncryptor(new LocalKeyProvider(), new InMemoryDataKeyStore());
  const encrypt = encryptor.encrypt.bind(encryptor);
  vi.spyOn(encryptor, 'encrypt').mockImplementation(async (...args) => {
    log.push('encrypt');
    return encrypt(...args);
  });
  const repo = new NotesRepository(
    pool as unknown as Pick<pg.Pool, 'query' | 'connect'>,
    encryptor,
    audit as unknown as AuditService,
  );
  return { repo, audit, query, log, release };
}

/** Arguments that let each public method run against the fakes above. */
const CALLS: Record<string, (repo: NotesRepository) => Promise<unknown>> = {
  create: (repo) => repo.create(OWNER, 'synthetic'),
  findOwned: (repo) => repo.findOwned(OWNER, NOTE_ID),
  listOwned: (repo) => repo.listOwned(OWNER),
};
const PRIVATE = new Set(['constructor', 'decrypt', 'auditedRead']);

describe('NotesRepository', () => {
  it('SE-05.1 every public method writes an audit entry', async () => {
    const methods = Object.getOwnPropertyNames(NotesRepository.prototype).filter(
      (name) => !PRIVATE.has(name),
    );
    expect(Object.keys(CALLS).toSorted((a, b) => a.localeCompare(b))).toEqual(
      methods.toSorted((a, b) => a.localeCompare(b)),
    );
    for (const method of methods) {
      const { repo, audit } = setup();
      await CALLS[method]?.(repo);
      expect(audit.record, method).toHaveBeenCalledTimes(1);
    }
  });

  it('SE-05.5 encrypts before the transaction and audits last inside it', async () => {
    const { repo, log, audit, release } = setup();
    await repo.create(OWNER, 'synthetic');
    expect(log).toEqual(['encrypt', 'BEGIN', 'INSERT', 'audit', 'COMMIT']);
    // The entry is written on the transaction's connection, not the pool.
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'sample_note.create' }),
      expect.objectContaining({ release }),
    );
  });

  it('SE-05.6 a failed insert writes no create entry and rolls back', async () => {
    const { repo, audit, query, log } = setup();
    query.mockImplementation((sql: string) => {
      log.push(sql.split(' ')[0] ?? sql);
      return sql.startsWith('INSERT')
        ? Promise.reject(new Error('insert failed'))
        : Promise.resolve({ rows: [] });
    });
    await expect(repo.create(OWNER, 'synthetic')).rejects.toThrow('insert failed');
    expect(audit.record).not.toHaveBeenCalled();
    expect(log).toEqual(['encrypt', 'BEGIN', 'INSERT', 'ROLLBACK']);
  });

  it('EN-03.1 sends only ciphertext to the database', async () => {
    const { repo, query } = setup();
    await repo.create(OWNER, 'ମୋ ଜ୍ୱର ଅଛି');
    expect(JSON.stringify(query.mock.calls)).not.toContain('ମୋ ଜ୍ୱର ଅଛି');
  });

  it('SE-02.3 audits a read of a note the user does not own as denied', async () => {
    const { repo, audit } = setup();
    expect(await repo.findOwned(OWNER, NOTE_ID)).toBeUndefined();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'sample_note.read.denied' }),
    );
  });
});
