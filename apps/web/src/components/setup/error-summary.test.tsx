import { CATALOGUES } from '@heach/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../../lib/i18n-context';
import { LinkedPatientForm } from '../people/LinkedPatientForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn() }));

const show = () =>
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      <LinkedPatientForm onSave={vi.fn()} onCancel={vi.fn()} />
    </I18nProvider>,
  );

it('A11Y-04 a failed submit moves focus to the summary once; typing then stays in the field', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: CATALOGUES.en.people.save }));
  expect(document.activeElement?.getAttribute('role')).toBe('alert');
  const name = screen.getByLabelText(CATALOGUES.en.people.fullName);
  name.focus();
  fireEvent.change(name, { target: { value: 'A' } });
  fireEvent.change(name, { target: { value: 'As' } });
  expect(document.activeElement).toBe(name);
});
