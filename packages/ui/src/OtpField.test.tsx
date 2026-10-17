import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { OtpField } from './OtpField.js';
import { expectNoAxeViolations } from './test/axe.js';

function Harness() {
  const [value, setValue] = useState('');
  return (
    <OtpField
      label="Code"
      value={value}
      error={value.length === 6 ? 'Wrong code' : undefined}
      onChange={(event) => {
        setValue(event.target.value);
      }}
    />
  );
}

describe('OtpField', () => {
  it('UX-05.1 uses the numeric keypad and SMS autofill', () => {
    render(<OtpField label="Code" />);
    const input = screen.getByLabelText('Code');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('maxlength')).toBe('6');
  });

  it('UX-05.1 keeps the input when an error is shown', () => {
    render(<Harness />);
    const input = screen.getByLabelText<HTMLInputElement>('Code');
    fireEvent.change(input, { target: { value: '123456' } });
    expect(screen.getByRole('alert').textContent).toBe('Wrong code');
    expect(input.value).toBe('123456');
  });

  it('UX-01.2 has no axe violations', async () => {
    const { container } = render(<OtpField label="Code" error="Wrong code" defaultValue="12" />);
    await expectNoAxeViolations(container);
  });
});
