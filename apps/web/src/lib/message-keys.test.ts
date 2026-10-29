import { describe, expect, it } from 'vitest';
import { keyFor } from './message-keys';

describe('keyFor', () => {
  it('I18N-01 returns the catalogue key when it exists, the fallback otherwise', () => {
    expect(keyFor('application.items', 'police_verification', 'state.loading')).toBe(
      'application.items.police_verification',
    );
    expect(keyFor('roles', 'nurse', 'state.loading', '.label')).toBe('roles.nurse.label');
    expect(keyFor('application.items', 'unknown', 'state.loading')).toBe('state.loading');
    expect(keyFor('application', 'items', 'state.loading')).toBe('state.loading');
  });
});
