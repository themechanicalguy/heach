import { UnauthorizedException } from '@nestjs/common';
import type { AccessTokenStore } from './access-token.store.js';
import type { SessionRepository, SessionRow } from './session.repository.js';
import { SessionService } from './session.service.js';

const USER = '00000000-0000-4000-8000-000000000001';

/** Repository and token-store doubles that record call order; the transaction can fail at COMMIT. */
function setup(session: Partial<SessionRow> | undefined, commitFails = false, familyLive = true) {
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
    lockUser: vi.fn(step('lockUser')),
    familyOf: vi.fn(() => {
      log.push('familyOf');
      return Promise.resolve('family-1');
    }),
    revokeFamily: vi.fn(step('revokeFamily')),
    familyIsLive: vi.fn(() => {
      log.push('familyIsLive');
      return Promise.resolve(familyLive);
    }),
  };
  const tokens = {
    issue: vi.fn(() => {
      log.push('issue');
      return Promise.resolve('new-access-token');
    }),
    revoke: vi.fn(step('revokeToken')),
    revokeAllForUser: vi.fn(step('revokeAllTokens')),
    revokeFamily: vi.fn(step('revokeFamilyTokens')),
  };
  const service = new SessionService(
    repo as unknown as SessionRepository,
    tokens as unknown as AccessTokenStore,
  );
  return { service, repo, tokens, log };
}

describe('SessionService.refresh', () => {
  it('SE-07.14 rotates in one transaction: lock, revoke, insert, issue, then commit', async () => {
    const { service, log, tokens } = setup({});
    await expect(service.refresh('cookie-token')).resolves.toMatchObject({
      accessToken: 'new-access-token',
    });
    expect(log).toEqual(['BEGIN', 'lock', 'revoke', 'insert', 'issue', 'COMMIT']);
    // The new access token joins the device's family, so a device sign-out reaches it (SE-07.21).
    expect(tokens.issue).toHaveBeenCalledWith(expect.anything(), 'family-1');
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
    expect(log).toEqual([
      'BEGIN',
      'lock',
      'familyIsLive',
      'revokeAll',
      'COMMIT',
      'revokeAllTokens',
    ]);
  });

  it('SE-07.22 a used token of a signed-out family is refused without revoking other devices', async () => {
    const { service, repo, tokens, log } = setup({ revoked_at: new Date() }, false, false);
    await expect(service.refresh('cookie-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(log).toEqual(['BEGIN', 'lock', 'familyIsLive', 'COMMIT']);
    expect(repo.revokeAllForUser).not.toHaveBeenCalled();
    expect(tokens.revokeAllForUser).not.toHaveBeenCalled();
    expect(tokens.issue).not.toHaveBeenCalled();
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

describe('SessionService.signOut', () => {
  const principal = { userId: USER, role: 'patient' as const, sessionId: 'session-3' };

  it('SE-07.21 one device: revokes its whole family under the user lock, then its tokens', async () => {
    const { service, repo, tokens, log } = setup({});
    await service.signOut(principal, 'presented-token', false);
    expect(log).toEqual([
      'revokeToken',
      'BEGIN',
      'lockUser',
      'familyOf',
      'revokeFamily',
      'COMMIT',
      'revokeFamilyTokens',
    ]);
    expect(repo.familyOf).toHaveBeenCalledWith(expect.anything(), 'session-3');
    expect(tokens.revokeFamily).toHaveBeenCalledWith('family-1');
    expect(repo.revokeAllForUser).not.toHaveBeenCalled();
    expect(tokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('SE-07.3 every device: revokes every session, then every access token', async () => {
    const { service, tokens, log } = setup({});
    await service.signOut(principal, 'presented-token', true);
    expect(log).toEqual(['BEGIN', 'lockUser', 'revokeAll', 'COMMIT', 'revokeAllTokens']);
    expect(tokens.revokeFamily).not.toHaveBeenCalled();
  });
});
