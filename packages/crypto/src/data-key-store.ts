import type { DataDomain } from './types.js';

/** A stored data key; `wrappedKey` is encrypted by the domain's master key (Confidential). */
export interface DataKeyRecord {
  readonly domain: DataDomain;
  readonly version: number;
  readonly wrappedKey: Buffer;
  readonly createdAt: Date;
  readonly retiredAt: Date | null;
}

/** Persistence for wrapped data keys; the API implements it on the `data_key` table. */
export interface DataKeyStore {
  current(domain: DataDomain): Promise<DataKeyRecord | undefined>;
  get(domain: DataDomain, version: number): Promise<DataKeyRecord | undefined>;
  /** Stores `record` as the domain's current version and retires the previous one. */
  add(record: DataKeyRecord): Promise<void>;
}

export class InMemoryDataKeyStore implements DataKeyStore {
  private readonly records: DataKeyRecord[] = [];

  current(domain: DataDomain): Promise<DataKeyRecord | undefined> {
    return Promise.resolve(this.records.find((r) => r.domain === domain && r.retiredAt === null));
  }

  get(domain: DataDomain, version: number): Promise<DataKeyRecord | undefined> {
    return Promise.resolve(this.records.find((r) => r.domain === domain && r.version === version));
  }

  add(record: DataKeyRecord): Promise<void> {
    const index = this.records.findIndex((r) => r.domain === record.domain && r.retiredAt === null);
    const previous = this.records[index];
    if (previous) {
      this.records[index] = { ...previous, retiredAt: record.createdAt };
    }
    this.records.push(record);
    return Promise.resolve();
  }
}
