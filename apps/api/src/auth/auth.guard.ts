import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { currentContext, type Principal, type Role } from '../common/request-context.js';
import { RoleAvailability } from '../flags/role-availability.js';
import { AuthzFailureMonitor } from '../security/authz-failure.monitor.js';
import { AccessTokenStore } from './access-token.store.js';
import { PUBLIC_KEY, ROLES_KEY } from './roles.decorator.js';

type AuthedRequest = Request & { principal?: Principal };

export function bearerToken(request: Request): string | undefined {
  return /^Bearer ([\w-]{20,})$/.exec(request.header('authorization') ?? '')?.[1];
}

export function principalOf(request: Request): Principal {
  const principal = (request as AuthedRequest).principal;
  if (!principal) {
    throw new UnauthorizedException();
  }
  return principal;
}

/**
 * Global guard: every route must declare @Roles or @Public, or it is refused (SE-02.1). Signed-in
 * roles come from the access token; a wrong role is 403, audited and counted (SO-08.3). A token
 * issued in a role that is no longer offered (ADR 0015) is revoked and answers 401, so the device
 * refreshes, finds its session ended and signs in again in a role that is.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokenStore,
    private readonly audit: AuditService,
    private readonly failures: AuthzFailureMonitor,
    private readonly availability: RoleAvailability,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (this.reflector.getAllAndOverride<string | undefined>(PUBLIC_KEY, targets)) {
      return true;
    }
    if (!roles) {
      throw new ForbiddenException();
    }
    const token = bearerToken(request);
    const principal = token ? await this.tokens.resolve(token) : undefined;
    if (!principal || !token) {
      throw new UnauthorizedException();
    }
    if (principal.realm === 'user' && !this.availability.isOffered(principal.role)) {
      await this.tokens.revoke(token);
      throw new UnauthorizedException();
    }
    request.principal = principal;
    const ctx = currentContext();
    if (ctx) {
      ctx.principal = principal;
    }
    if (!roles.includes(principal.role)) {
      await this.deny(principal, (request.route as { path?: string } | undefined)?.path);
    }
    return true;
  }

  private async deny(principal: Principal, route: string | undefined): Promise<never> {
    await this.audit.record({
      action: 'access.denied.role',
      entity: route ?? 'route',
      entityId: null,
    });
    await this.failures.record(principal.userId);
    throw new ForbiddenException();
  }
}
