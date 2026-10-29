import { Global, Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { ShareKeys } from './share-keys.js';
import {
  AdminVaultController,
  ProviderVaultController,
  SharedLinkController,
  VaultController,
} from './vault.controller.js';
import { VaultFiling } from './vault-filing.js';
import { VaultRepository } from './vault.repository.js';
import { VaultService } from './vault.service.js';

/** The e-medical record vault (Step 8: J9, MV, AD-15); filing is shared with visits and labs. */
@Global()
@Module({
  imports: [BookingsModule],
  controllers: [
    VaultController,
    ProviderVaultController,
    SharedLinkController,
    AdminVaultController,
  ],
  providers: [VaultRepository, VaultService, VaultFiling, ShareKeys],
  exports: [VaultFiling],
})
export class VaultModule {}
