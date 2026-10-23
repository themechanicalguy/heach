import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { appLogger } from '../common/app-logger.js';
import type { Principal } from '../common/request-context.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { AccessTokenStore } from './access-token.store.js';
import { SessionRepository } from './session.repository.js';
import { hashToken, newToken } from './token-hash.js';

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

type Rotation = { kind: 'rotated'; tokens: IssuedTokens } | { kind: 'replay'; userId: string };

/** Sign-in, refresh-token rotation with replay detection, and logout (SE-07). */
@Injectable()
export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly accessTokens: AccessTokenStore,
  ) {}

  async signIn(userId: string): Promise<IssuedTokens> {
    const role = await this.sessions.findUserRole(userId);
    if (!role) {
      throw new NotFoundException();
    }
    return this.issue({ userId, role, sessionId: randomUUID() }, randomUUID());
  }

  /**
   * Rotates the refresh token in one transaction under the user's lock: all or nothing
   * (SE-07.14, SE-07.15). A token used twice revokes every session and access token of its user,
   * including any a concurrent first use just issued (SE-07.2, SE-07.18).
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
      return outcome.tokens;
    } catch (error) {
      // A failed commit must not leave the access token it issued usable (SE-07.15).
      if (issued && !(error instanceof UnauthorizedException)) {
        await this.accessTokens.revoke(issued).catch(() => undefined);
      }
      throw error;
    }
  }

  /** Ends this device's session, or every session of the user (SE-07.3). */
  async signOut(principal: Principal, accessToken: string, allDevices: boolean): Promise<void> {
    if (allDevices) {
      await this.signOutEverywhere(principal.userId);
      return;
    }
    await this.sessions.revokeIfActive(principal.sessionId);
    await this.accessTokens.revoke(accessToken);
  }

  /** Takes the user's lock first, so a concurrent rotation cannot outlive it (SE-07.20). */
  async signOutEverywhere(userId: string): Promise<void> {
    await this.sessions.transaction(async (client) => {
      await this.sessions.lockUser(client, userId);
      await this.sessions.revokeAllForUser(userId, client);
    });
    await this.accessTokens.revokeAllForUser(userId);
  }

  private async rotate(client: TransactionClient, hash: string): Promise<Rotation> {
    const session = await this.sessions.lockByHash(client, hash);
    if (!session || session.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException();
    }
    if (session.revoked_at) {
      await this.sessions.revokeAllForUser(session.user_id, client);
      return { kind: 'replay', userId: session.user_id };
    }
    await this.sessions.revokeIfActive(session.id, client);
    const principal = { userId: session.user_id, role: session.role, sessionId: randomUUID() };
    return { kind: 'rotated', tokens: await this.issue(principal, session.family_id, client) };
  }

  /** Stores the session, then issues its access token (inside the caller's transaction, if any). */
  private async issue(
    principal: Principal,
    familyId: string,
    client?: TransactionClient,
  ): Promise<IssuedTokens> {
    const refresh = newToken();
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.sessions.create(
      {
        id: principal.sessionId,
        userId: principal.userId,
        familyId,
        hash: refresh.hash,
        expiresAt: refreshExpiresAt,
      },
      client,
    );
    const accessToken = await this.accessTokens.issue(principal);
    return { accessToken, refreshToken: refresh.token, refreshExpiresAt };
  }
}
