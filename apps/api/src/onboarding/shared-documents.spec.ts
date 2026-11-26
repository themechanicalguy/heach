import { CHECKLISTS } from './checklists.js';
import { checklistItemFor } from './shared-documents.js';

describe('Documents shared from DigiLocker (KY-02)', () => {
  const registration = {
    type: 'registration_certificate' as const,
    reference: 'SYN-REG-1',
    expiresOn: '2030-01-01',
  };

  it('KY-02 a degree fills the qualification item; a registration fills the role one', () => {
    expect(checklistItemFor({ type: 'degree_certificate' }, CHECKLISTS.nurse)?.key).toBe(
      'qualification_certificate',
    );
    expect(checklistItemFor(registration, CHECKLISTS.nurse)?.key).toBe('nursing_registration');
    expect(checklistItemFor(registration, CHECKLISTS.physiotherapist)?.key).toBe(
      'council_registration',
    );
    expect(checklistItemFor(registration, CHECKLISTS.lab)?.key).toBe('establishment_registration');
  });

  it('KY-02 a document the role does not need is not kept', () => {
    expect(checklistItemFor({ type: 'pan_card' }, CHECKLISTS.nurse)).toBeUndefined();
    expect(checklistItemFor({ type: 'driving_licence' }, CHECKLISTS.attendant)).toBeUndefined();
    expect(checklistItemFor(registration, CHECKLISTS.attendant)).toBeUndefined();
  });

  it('KY-02 a registration without its number or expiry date is not kept', () => {
    const bare = { type: 'registration_certificate' as const };
    expect(checklistItemFor(bare, CHECKLISTS.nurse)).toBeUndefined();
    expect(checklistItemFor({ ...bare, reference: 'SYN-REG-1' }, CHECKLISTS.nurse)).toBeUndefined();
  });
});
