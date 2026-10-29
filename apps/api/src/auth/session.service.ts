import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { appLogger } from '../common/app-logger.js';
import type { Principal, Role } from '../common/request-context.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import type { AccessTokenStore } from './access-token.store.js';
import { type SessionRealm, USER_REALM } from './session-realm.js';
import type { SessionRepository, SessionRow } from './session.repository.js';
import { hashToken, newToken } from './token-hash.js';

export const REFRESH_TOKEN_TTL_MS = USER_REALM.refreshTtlMs;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

type Rotation =
  | { kind: 'rotated'; tokens: IssuedTokens }
  | { kind: 'replay'; userId: string }
  | { kind: 'ended' };

/**
 * Sign-in, refresh-token rotation with replay detection, role switching and logout (SE-07). One
 * instance per realm (decision L-10); the caller has already authenticated the owner and decided
 * the role, which the server alone grants.
 */
export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly accessTokens: AccessTokenStore,
    readonly realm: SessionRealm = USER_REALM,
  ) {}

  async signIn(userId: string, role: Role): Promise<IssuedTokens> {
    const principal = { userId, role, sessionId: randomUUID(), realm: this.realm.name };
    return this.issue(principal, { id: randomUUID(), startedAt: new Date() });
  }

  /**
   * Makes `role` the active role of this device's session and returns a new access token for it;
   * the old token stops working. The caller has checked that the account holds the role.
   */
  async switchRole(principal: Principal, accessToken: string, role: Role): Promise<string> {
    const familyId = await this.sessions.transaction(async (client) => {
      await this.sessions.lockUser(client, principal.userId);
      if (!(await this.sessions.setActiveRole(client, principal.sessionId, role))) {
        throw new UnauthorizedException();
      }
      return this.sessions.familyOf(client, principal.sessionId);
    });
    if (!familyId) throw new UnauthorizedException();
    await this.accessTokens.revoke(accessToken);
    return this.accessTokens.issue({ ...principal, role }, familyId, this.realm.accessTtlSeconds);
  }

  /**
   * Rotates the refresh token in one transaction under the user's lock: all or nothing
   * (SE-07.14, SE-07.15). A token used twice revokes every session and access token of its user,
   * including any a concurrent first use just issued (SE-07.2, SE-07.18). A token from a family
   * already signed out is only refused: nothing is left there to steal (SE-07.22).
   */
  async refresh(refreshToken: string | undefined): Promise<IssuedTokens> {
    if (!refreshToken) {
      throw new UnauthorizedException();
    }
    let issued: string | undefined;
    try {
      const outcome = await this.sessions.transaction(async (client) => {
        const result = await this.rotate(client, hashToken(refreshToken));
        if (result.kind === 'rotated') issued = result.tokens.accessToken;
        return result;
      });
      if (outcome.kind === 'replay') {
        appLogger.warn({ event: 'refresh_replay' }, 'Refresh token replay; sessions revoked');
        await this.accessTokens.revokeAllForUser(outcome.userId);
        throw new UnauthorizedException();
      }
      if (outcome.kind === 'ended') {
        appLogger.warn({ event: 'refresh_after_sign_out' }, 'Refresh token of a signed-out device');
        throw new UnauthorizedException();
      }
      return outcome.tokens;
    } catch (error) {
      // A failed commit must not leave the access token it issued usable (SE-07.15).
      if (issued && !(error instanceof UnauthorizedException)) {
        await this.accessTokens.revoke(issued).catch(() => undefined);
      }
      throw error;
    }
  }

  /** Ends this device's session family, or every session of the user (SE-07.3, SE-07.21). */
  async signOut(principal: Principal, accessToken: string, allDevices: boolean): Promise<void> {
    if (allDevices) {
      await this.signOutEverywhere(principal.userId);
      return;
    }
    await this.accessTokens.revoke(accessToken);
    await this.signOutDevice(principal);
  }

  /**
   * Revokes every session and access token of this device's family, including those issued before
   * or by a refresh. The user's lock orders it with rotation: a refresh that committed first is
   * revoked here; one that runs after finds the family ended (SE-07.21, SE-07.22).
   */
  private async signOutDevice(principal: Principal): Promise<void> {
    const familyId = await this.sessions.transaction(async (client) => {
      await this.sessions.lockUser(client, principal.userId);
      const family = await this.sessions.familyOf(client, principal.sessionId);
      if (family) await this.sessions.revokeFamily(client, family);
      return family;
    });
    if (familyId) await this.accessTokens.revokeFamily(familyId);
  }

  /** Takes the user's lock first, so a concurrent rotation cannot outlive it (SE-07.20). */
  async signOutEverywhere(userId: string): Promise<void> {
    await this.sessions.transaction(async (client) => {
      await this.sessions.lockUser(client, userId);
      await this.sessions.revokeAllForUser(userId, client);
    });
    await this.accessTokens.revokeAllForUser(userId);
  }

  /**
   * Signs out at once every device acting in `role`, which the account no longer holds (removed
   * membership or revoked role, D-7). Devices in another role keep their session.
   */
  async signOutRole(userId: string, role: Role): Promise<void> {
    await this.signOutFamilies(userId, (client) =>
      this.sessions.liveFamiliesInRole(client, userId, role),
    );
  }

  /** Signs out every device of the user except this one (after a number change, O-3). */
  async signOutOtherDevices(principal: Principal): Promise<void> {
    await this.signOutFamilies(principal.userId, async (client) => {
      const own = await this.sessions.familyOf(client, principal.sessionId);
      return own ? this.sessions.otherLiveFamilies(client, principal.userId, own) : [];
    });
  }

  /** Under the user's lock, as sign-out of one device (SE-07.21). */
  private async signOutFamilies(
    userId: string,
    select: (client: TransactionClient) => Promise<string[]>,
  ): Promise<void> {
    const families = await this.sessions.transaction(async (client) => {
      await this.sessions.lockUser(client, userId);
      const chosen = await select(client);
      for (const family of chosen) await this.sessions.revokeFamily(client, family);
      return chosen;
    });
    for (const family of families) await this.accessTokens.revokeFamily(family);
  }

  private async rotate(client: TransactionClient, hash: string): Promise<Rotation> {
    const session = await this.sessions.lockByHash(client, hash);
    if (!session || session.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException();
    }
    if (session.revoked_at) {
      if (!(await this.sessions.familyIsLive(client, session.family_id))) {
        return { kind: 'ended' };
      }
      await this.sessions.revokeAllForUser(session.user_id, client);
      return { kind: 'replay', userId: session.user_id };
    }
    // Suspended, role removed or past the realm's absolute limit: this device signs in again.
    if (!session.role || this.pastAbsoluteLimit(session)) {
      await this.sessions.revokeFamily(client, session.family_id);
      return { kind: 'ended' };
    }
    await this.sessions.revokeIfActive(session.id, client);
    const principal = {
      userId: session.user_id,
      role: session.role,
      sessionId: randomUUID(),
      realm: this.realm.name,
    };
    const family = { id: session.family_id, startedAt: session.family_started_at };
    return { kind: 'rotated', tokens: await this.issue(principal, family, client) };
  }

  private pastAbsoluteLimit(session: SessionRow): boolean {
    const limit = this.realm.absoluteTtlMs;
    return limit !== undefined && session.family_started_at.getTime() + limit < Date.now();
  }

  /** Stores the session, then issues its access token (inside the caller's transaction, if any). */
  private async issue(
    principal: Principal,
    family: { id: string; startedAt: Date },
    client?: TransactionClient,
  ): Promise<IssuedTokens> {
    const refresh = newToken();
    const refreshExpiresAt = new Date(Date.now() + this.realm.refreshTtlMs);
    await this.sessions.create(
      {
        id: principal.sessionId,
        userId: principal.userId,
        familyId: family.id,
        familyStartedAt: family.startedAt,
        role: principal.role,
        hash: refresh.hash,
        expiresAt: refreshExpiresAt,
      },
      client,
    );
    const accessToken = await this.accessTokens.issue(
      principal,
      family.id,
      this.realm.accessTtlSeconds,
    );
    return { accessToken, refreshToken: refresh.token, refreshExpiresAt };
  }
}
