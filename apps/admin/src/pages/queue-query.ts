export interface QueueFilterValues {
  role: string;
  age: string;
}

export const NO_QUEUE_FILTERS: QueueFilterValues = { role: '', age: '' };

/** The queue route with its view and the filters that are set (AD-02); values are encoded. */
export function queuePath(view: 'open' | 'decided', filters: QueueFilterValues): string {
  const params = new URLSearchParams({ view });
  if (filters.role) params.set('role', filters.role);
  if (filters.age) params.set('age', filters.age);
  return `/applications?${params.toString()}`;
}
