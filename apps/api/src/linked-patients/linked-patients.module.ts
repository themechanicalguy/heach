import { Module } from '@nestjs/common';
import { LinkedPatientsController } from './linked-patients.controller.js';
import { LinkedPatientsRepository } from './linked-patients.repository.js';
import { LinkedPatientsService } from './linked-patients.service.js';

/** People a patient or representative books for (AC-03). */
@Module({
  controllers: [LinkedPatientsController],
  providers: [LinkedPatientsRepository, LinkedPatientsService],
  exports: [LinkedPatientsRepository],
})
export class LinkedPatientsModule {}
