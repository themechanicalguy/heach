import { withTimeout } from './with-timeout.js';

describe('withTimeout (KY-08)', () => {
  it('KY-08 passes the result through when the work finishes in time', async () => {
    await expect(withTimeout(Promise.resolve('done'), 50)).resolves.toBe('done');
  });

  it('KY-08 rejects when the work takes too long', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200));
    await expect(withTimeout(slow, 10)).rejects.toThrow('timeout');
  });

  it('KY-08 passes a failure of the work through', async () => {
    await expect(withTimeout(Promise.reject(new Error('down')), 50)).rejects.toThrow('down');
  });
});
