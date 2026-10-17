import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Principal } from '../common/request-context.js';
import { AccessTokenStore } from './access-token.store.js';
import { SessionRepository } from './session.repository.js';
import { hashToken, newToken } from './token-hash.js';

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

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

  /** Rotates the refresh token. A token used twice revokes every session of its user (SE-07.2). */
  async refresh(refreshToken: string | undefined): Promise<IssuedTokens> {
    const session = refreshToken
      ? await this.sessions.findByHash(hashToken(refreshToken))
      : undefined;
    if (!session || session.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException();
    }
    if (session.revoked_at || !(await this.sessions.revokeIfActive(session.id))) {
      await this.signOutEverywhere(session.user_id);
      throw new UnauthorizedException();
    }
    return this.issue(
      { userId: session.user_id, role: session.role, sessionId: randomUUID() },
      session.family_id,
    );
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

  async signOutEverywhere(userId: string): Promise<void> {
    await this.sessions.revokeAllForUser(userId);
    await this.accessTokens.revokeAllForUser(userId);
  }

  private async issue(principal: Principal, familyId: string): Promise<IssuedTokens> {
    const refresh = newToken();
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.sessions.create({
      id: principal.sessionId,
      userId: principal.userId,
      familyId,
      hash: refresh.hash,
      expiresAt: refreshExpiresAt,
    });
    const accessToken = await this.accessTokens.issue(principal);
    return { accessToken, refreshToken: refresh.token, refreshExpiresAt };
  }
}
