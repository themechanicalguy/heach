import { Module } from '@nestjs/common';
import { AdminAccountRepository } from './admin-account.repository.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminManagementController } from './admin-management.controller.js';
import { AdminManagementService } from './admin-management.service.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersRepository } from './admin-users.repository.js';
import { AdminUsersService } from './admin-users.service.js';

/**
 * The admin realm: sign-in with mandatory MFA, admin account management and recovery, and user
 * management (AD-01, AD-03).
 */
@Module({
  controllers: [AdminAuthController, AdminManagementController, AdminUsersController],
  providers: [
    AdminAccountRepository,
    AdminAuthService,
    AdminManagementService,
    AdminUsersRepository,
    AdminUsersService,
  ],
})
export class AdminModule {}
