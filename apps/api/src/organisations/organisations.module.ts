import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { MembershipRepository } from './membership.repository.js';
import { OrganisationsController } from './organisations.controller.js';
import { OrganisationsService } from './organisations.service.js';

/** Labs, clinics and their staff memberships (owner decision O-1, brought forward from Step 7). */
@Module({
  controllers: [OrganisationsController, InvitationsController],
  providers: [MembershipRepository, OrganisationsService, InvitationsService],
  exports: [InvitationsService],
})
export class OrganisationsModule {}
