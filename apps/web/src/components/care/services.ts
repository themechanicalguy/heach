/** The four MVP services (ADR 0015), in home-screen order (SD-01). */
export const SERVICES = ['physiotherapy', 'nursing', 'attendant', 'lab'] as const;
export type Service = (typeof SERVICES)[number];

export function isService(value: string): value is Service {
  return (SERVICES as readonly string[]).includes(value);
}

export const PIN_PATTERN = /^[1-9]\d{5}$/;
