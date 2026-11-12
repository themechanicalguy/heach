import { Body, Controller, Get, Header, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import { ONBOARDING_ROLES } from './checklists.js';
import {
  ProviderProfileDetailsDto,
  ProviderProfileInputDto,
  StoredFileDto,
  UploadDto,
} from './onboarding.dto.js';
import { ProfileService } from './profile.service.js';

/** The signed-in provider's public profile details and photo (PO-05). */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider/profile')
@UseGuards(requireFlag('accounts'))
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ProviderProfileDetailsDto })
  async view(@Req() request: Request): Promise<ProviderProfileDetailsDto> {
    return this.profile.own(principalOf(request));
  }

  @Put()
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ProviderProfileDetailsDto })
  async save(
    @Body() body: ProviderProfileInputDto,
    @Req() request: Request,
  ): Promise<ProviderProfileDetailsDto> {
    return this.profile.save(principalOf(request), body);
  }

  @Get('photo')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: StoredFileDto })
  async photo(@Req() request: Request): Promise<StoredFileDto> {
    const principal = principalOf(request);
    await this.profile.own(principal);
    return this.profile.photo(principal.userId, { audit: false });
  }

  /** A JPEG or PNG, sent with the upload content type. */
  @Put('photo')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ProviderProfileDetailsDto })
  async uploadPhoto(
    @Body() body: UploadDto,
    @Req() request: Request,
  ): Promise<ProviderProfileDetailsDto> {
    return this.profile.uploadPhoto(principalOf(request), body);
  }
}
