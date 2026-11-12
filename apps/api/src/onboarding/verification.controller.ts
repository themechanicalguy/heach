import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import {
  ApplicationQueryDto,
  ApplicationReviewDto,
  ApplicationSummaryDto,
  DecisionDto,
  DocumentReviewDto,
  IdentityReviewDto,
  StoredFileDto,
} from './onboarding.dto.js';
import { VerificationService } from './verification.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/** The verification queue (AD-02): verifiers and super admins only. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/applications')
@UseGuards(requireFlag('accounts'))
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'verifier')
  @ApiOkResponse({ type: [ApplicationSummaryDto] })
  async queue(@Query() query: ApplicationQueryDto): Promise<ApplicationSummaryDto[]> {
    return this.verification.queue(query.view);
  }

  @Get(':accountId')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'verifier')
  @ApiOkResponse({ type: ApplicationReviewDto })
  async review(
    @Param('accountId', uuid) accountId: string,
    @Req() request: Request,
  ): Promise<ApplicationReviewDto> {
    return this.verification.review(principalOf(request), accountId);
  }

  @Get(':accountId/documents/:documentId')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'verifier')
  @ApiOkResponse({ type: StoredFileDto })
  async document(
    @Param('accountId', uuid) accountId: string,
    @Param('documentId', uuid) documentId: string,
  ): Promise<StoredFileDto> {
    return this.verification.document(accountId, documentId);
  }

  @Post(':accountId/documents')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'verifier')
  @ApiNoContentResponse()
  async reviewDocument(
    @Param('accountId', uuid) accountId: string,
    @Body() body: DocumentReviewDto,
  ): Promise<void> {
    await this.verification.reviewDocument(accountId, body);
  }

  @Get(':accountId/photo')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'verifier')
  @ApiOkResponse({ type: StoredFileDto })
  async photo(@Param('accountId', uuid) accountId: string): Promise<StoredFileDto> {
    return this.verification.photo(accountId);
  }

  @Get(':accountId/identity-document')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'verifier')
  @ApiOkResponse({ type: StoredFileDto })
  async identityDocument(@Param('accountId', uuid) accountId: string): Promise<StoredFileDto> {
    return this.verification.identityDocument(accountId);
  }

  @Post(':accountId/identity')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'verifier')
  @ApiNoContentResponse()
  async reviewIdentity(
    @Param('accountId', uuid) accountId: string,
    @Body() body: IdentityReviewDto,
  ): Promise<void> {
    await this.verification.reviewIdentity(accountId, body);
  }

  @Post(':accountId/decision')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'verifier')
  @ApiNoContentResponse()
  async decide(
    @Param('accountId', uuid) accountId: string,
    @Body() body: DecisionDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.verification.decide(principalOf(request), accountId, body);
  }
}
