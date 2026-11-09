import { Module } from '@nestjs/common';
import { CoveragePinsCache } from './coverage-pins.cache.js';

/** The serviceable-PIN cache, on its own so the modules that change coverage can clear it. */
@Module({ providers: [CoveragePinsCache], exports: [CoveragePinsCache] })
export class CoverageCacheModule {}
