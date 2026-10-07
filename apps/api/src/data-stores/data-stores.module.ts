import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import pg from 'pg';
import { EnvVars } from '../config/env.schema.js';
import { PG_POOL, REDIS_CLIENT } from './data-stores.tokens.js';

const CONNECT_TIMEOUT_MS = 1_000;

function createPool(env: EnvVars): pg.Pool {
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  });
  // Idle-client errors would otherwise crash the process. Log the type only, never the URL.
  pool.on('error', (error) => {
    new Logger('Postgres').warn(`Idle client error: ${error.name}`);
  });
  return pool;
}

function createRedis(env: EnvVars): Redis {
  const redis = new Redis(env.REDIS_URL, {
    connectTimeout: CONNECT_TIMEOUT_MS,
    // Commands wait for the connection; callers bound the wait (readiness uses 1 s).
    maxRetriesPerRequest: 1,
  });
  redis.on('error', (error: Error) => {
    new Logger('Redis').warn(`Connection error: ${error.name}`);
  });
  return redis;
}

/** Shared PostgreSQL pool and Redis client, closed when the app shuts down. */
@Global()
@Module({
  providers: [
    { provide: PG_POOL, inject: [EnvVars], useFactory: createPool },
    { provide: REDIS_CLIENT, inject: [EnvVars], useFactory: createRedis },
  ],
  exports: [PG_POOL, REDIS_CLIENT],
})
export class DataStoresModule implements OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    this.redis.disconnect();
    await this.pool.end();
  }
}
