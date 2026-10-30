import { Module } from '@nestjs/common';
import { AdminContentController, PagesController } from './content.controller.js';
import { ContentService } from './content.service.js';

/** Notification templates and static pages edited without a deployment (Step 9: AD-09). */
@Module({
  controllers: [PagesController, AdminContentController],
  providers: [ContentService],
})
export class ContentModule {}
