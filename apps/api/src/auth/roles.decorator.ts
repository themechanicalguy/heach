import { SetMetadata } from '@nestjs/common';
import type { Role } from '../common/request-context.js';

export const ROLES_KEY = 'heach:roles';
export const PUBLIC_KEY = 'heach:public';

/** Signed-in users with one of these roles may call the route (SE-02.1). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Anyone may call the route; the reason is required so reviews see why. */
export const Public = (reason: string) => SetMetadata(PUBLIC_KEY, reason);
