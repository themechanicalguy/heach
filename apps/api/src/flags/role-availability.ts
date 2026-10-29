import { FeatureFlags } from '@heach/flags';
import { Injectable } from '@nestjs/common';
import { DEFERRED_ROLES } from '../common/request-context.js';

/**
 * Whether a role may act now (ADR 0015). Every role does, except those deferred beyond the MVP
 * while the `doctor-and-clinic` flag is off; that flag is never on in staging or production.
 * A grant of a deferred role is kept, but it is not offered, granted, signed in or switched to.
 */
@Injectable()
export class RoleAvailability {
  constructor(private readonly flags: FeatureFlags) {}

  isOffered(role: string): boolean {
    const deferred = (DEFERRED_ROLES as readonly string[]).includes(role);
    return !deferred || this.flags.isOn('doctor-and-clinic');
  }

  /** Grants as their holder and admins see them: each one kept, marked whether it may act. */
  held<T extends { role: string }>(grants: readonly T[]): (T & { available: boolean })[] {
    return grants.map((grant) => ({ ...grant, available: this.isOffered(grant.role) }));
  }
}
