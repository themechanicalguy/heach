import { EnvelopeEncryptor, InMemoryDataKeyStore, LocalKeyProvider } from '@heach/crypto';
import type { AuditService } from '../audit/audit.service.js';
import { NotesRepository } from './notes.repository.js';

const OWNER = '00000000-0000-4000-8000-000000000001';
const NOTE_ID = '11111111-1111-4111-8111-111111111111';

function setup() {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const encryptor = new EnvelopeEncryptor(new LocalKeyProvider(), new InMemoryDataKeyStore());
  const repo = new NotesRepository({ query }, encryptor, audit as unknown as AuditService);
  return { repo, audit, query };
}

/** Arguments that let each public method run against the fakes above. */
const CALLS: Record<string, (repo: NotesRepository) => Promise<unknown>> = {
  create: (repo) => repo.create(OWNER, 'synthetic'),
  findOwned: (repo) => repo.findOwned(OWNER, NOTE_ID),
  listOwned: (repo) => repo.listOwned(OWNER),
};

describe('NotesRepository', () => {
  it('SE-05.1 every public method writes an audit entry', async () => {
    const methods = Object.getOwnPropertyNames(NotesRepository.prototype).filter(
      (name) => name !== 'constructor' && name !== 'decrypt',
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

  it('EN-03.1 sends only ciphertext to the database', async () => {
    const { repo, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ created_at: new Date() }] });
    await repo.create(OWNER, 'ମୋ ଜ୍ୱର ଅଛି');
    expect(JSON.stringify(query.mock.calls[0])).not.toContain('ମୋ ଜ୍ୱର ଅଛି');
  });

  it('SE-02.3 audits a read of a note the user does not own as denied', async () => {
    const { repo, audit } = setup();
    expect(await repo.findOwned(OWNER, NOTE_ID)).toBeUndefined();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'sample_note.read.denied' }),
    );
  });
});
