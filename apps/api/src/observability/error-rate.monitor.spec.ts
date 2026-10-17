import type { AlertPublisher } from '../security/alert-publisher.js';
import { ErrorRateMonitor } from './error-rate.monitor.js';

function setup() {
  let now = 0;
  const publish = vi.fn<AlertPublisher['publish']>().mockResolvedValue(undefined);
  const monitor = new ErrorRateMonitor({ publish }, () => now);
  const advance = (minutes: number) => {
    now += minutes * 60_000;
  };
  const traffic = (total: number, errors: number) => {
    for (let i = 0; i < total; i += 1) monitor.record(i < errors ? 500 : 200);
  };
  return { monitor, publish, advance, traffic };
}

describe('ErrorRateMonitor', () => {
  it('LM-07.1 sends one alert when errors exceed 5 percent over five minutes', async () => {
    const { monitor, publish, advance, traffic } = setup();
    for (let minute = 0; minute < 5; minute += 1) {
      traffic(20, 2); // 10 percent
      advance(1);
      await monitor.evaluate();
    }
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[0]).toMatch(/error rate/);
  });

  it('LM-07.1 stays quiet at or below 5 percent and with too little traffic', async () => {
    const { monitor, publish, traffic } = setup();
    traffic(100, 5);
    await monitor.evaluate();
    const quiet = setup();
    quiet.traffic(5, 5);
    await quiet.monitor.evaluate();
    expect(publish).not.toHaveBeenCalled();
    expect(quiet.publish).not.toHaveBeenCalled();
    monitor.onModuleDestroy();
    quiet.monitor.onModuleDestroy();
  });

  it('LM-07.1 re-arms after the rate recovers', async () => {
    const { monitor, publish, advance, traffic } = setup();
    traffic(40, 10);
    await monitor.evaluate();
    advance(6);
    traffic(40, 0);
    await monitor.evaluate();
    advance(6);
    traffic(40, 10);
    await monitor.evaluate();
    expect(publish).toHaveBeenCalledTimes(2);
    monitor.onModuleDestroy();
  });
});
