import { Global, Module } from '@nestjs/common';
import { JobRunner } from './job-runner.js';

/** The durable job runner every module schedules its timers on (D-QUEUE). */
@Global()
@Module({ providers: [JobRunner], exports: [JobRunner] })
export class JobsModule {}
