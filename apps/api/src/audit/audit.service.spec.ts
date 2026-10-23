import { type RequestContext, runWithContext } from '../common/request-context.js';
import { AuditService } from './audit.service.js';

const EVENT = { action: 'sample_note.reencrypt', entity: 'sample_note', entityId: 'note-1' };

/** The actor ID and role that audit.append receives in this context. */
async function actorIn(context: RequestContext): Promise<unknown[]> {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const audit = new AuditService({ query });
  await runWithContext(context, () => audit.record(EVENT));
  return (query.mock.calls[0]?.[1] as unknown[]).slice(0, 2);
}

describe('AuditService actor', () => {
  it('EN-05.7 records a system job as role system with the job as actor', async () => {
    expect(await actorIn({ correlationId: 'run-1', system: 'job:reencrypt' })).toEqual([
      'job:reencrypt',
      'system',
    ]);
  });

  it('EN-05.7 a signed-in user always wins over a system actor', async () => {
    const principal = { userId: 'user-1', role: 'patient' as const, sessionId: 'session-1' };
    expect(await actorIn({ correlationId: 'req-1', principal, system: 'job:reencrypt' })).toEqual([
      'user-1',
      'patient',
    ]);
  });

  it('SE-05.2 with neither, the entry is anonymous', async () => {
    expect(await actorIn({ correlationId: 'req-2' })).toEqual([null, 'anonymous']);
  });
});
