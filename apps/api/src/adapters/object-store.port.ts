/** S3-compatible object storage for uploads (EN-07). Callers store ciphertext only. */
export interface ObjectStore {
  put(key: string, body: string): Promise<void>;
  get(key: string): Promise<string | undefined>;
  delete(key: string): Promise<void>;
}
export const OBJECT_STORE = Symbol('OBJECT_STORE');
