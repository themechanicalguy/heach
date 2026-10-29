import { Module } from '@nestjs/common';
import { ConsoleController } from './console.controller.js';

/** Admin settings, dashboard and security console (Step 9: AD-08, AD-10, AD-17). */
@Module({ controllers: [ConsoleController] })
export class ConsoleModule {}
