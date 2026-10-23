import { UnauthorizedException } from '@nestjs/common';
import type { AccessTokenStore } from './access-token.store.js';
import type { SessionRepository, SessionRow } from './session.repository.js';
import { SessionService } from './session.service.js';

const USER = '00000000-0000-4000-8000-000000000001';

/** Repository and token-store doubles that record call order; the transaction can fail at COMMIT. */
function setup(session: Partial<SessionRow> | undefined, commitFails = false) {
  const log: string[] = [];
  const step = (name: string) => () => {
    log.push(name);
    return Promise.resolve();
  };
  const row: SessionRow | undefined = session && {
    id: 'session-1',
    user_id: USER,
    family_id: 'family-1',
    role: 'patient',
    expires_at: new Date(Date.now() + 60_000),
    revoked_at: null,
    ...session,
  };
  const repo = {
    transaction: vi.fn(async (work: (client: object) => Promise<unknown>) => {
      log.push('BEGIN');
      try {
        const result = await work({});
        log.push('COMMIT');
        if (commitFails) throw new Error('commit failed');
        return result;
      } catch (error) {
        log.push('ROLLBACK');
        throw error;
      }
    }),
    lockByHash: vi.fn(() => {
      log.push('lock');
      return Promise.resolve(row);
    }),
    revokeIfActive: vi.fn(step('revoke')),
    revokeAllForUser: vi.fn(step('revokeAll')),
    create: vi.fn(step('insert')),
  };
  const tokens = {
    issue: vi.fn(() => {
      log.push('issue');
      return Promise.resolve('new-access-token');
    }),
    revoke: vi.fn(step('revokeToken')),
    revokeAllForUser: vi.fn(step('revokeAllTokens')),
  };
  const service = new SessionService(
    repo as unknown as SessionRepository,
    tokens as unknown as AccessTokenStore,
  );
  return { service, repo, tokens, log };
}

describe('SessionService.refresh', () => {
  it('SE-07.14 rotates in one transaction: lock, revoke, insert, issue, then commit', async () => {
    const { service, log } = setup({});
    await expect(service.refresh('cookie-token')).resolves.toMatchObject({
      accessToken: 'new-access-token',
    });
    expect(log).toEqual(['BEGIN', 'lock', 'revoke', 'insert', 'issue', 'COMMIT']);
  });

  it('SE-07.14 a failed insert rolls back before any token is issued', async () => {
    const { service, repo, tokens, log } = setup({});
    repo.create.mockRejectedValueOnce(new Error('db down'));
    await expect(service.refresh('cookie-token')).rejects.toThrow('db down');
    expect(log).toEqual(['BEGIN', 'lock', 'revoke', 'ROLLBACK']);
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('SE-07.15 a failed commit revokes the access token it issued', async () => {
    const { service, tokens } = setup({}, true);
    await expect(service.refresh('cookie-token')).rejects.toThrow('commit failed');
    expect(tokens.revoke).toHaveBeenCalledWith('new-access-token');
  });

  it('SE-07.19 a used token commits the revocation of every session, then every access token', async () => {
    const { service, log } = setup({ revoked_at: new Date() });
    await expect(service.refresh('cookie-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(log).toEqual(['BEGIN', 'lock', 'revokeAll', 'COMMIT', 'revokeAllTokens']);
  });

  it('SE-07.16 an unknown or expired token is 401 and changes nothing', async () => {
    for (const session of [undefined, { expires_at: new Date(Date.now() - 1) }]) {
      const { service, repo, tokens } = setup(session);
      await expect(service.refresh('cookie-token')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.revokeIfActive).not.toHaveBeenCalled();
      expect(tokens.revoke).not.toHaveBeenCalled();
    }
  });
});
