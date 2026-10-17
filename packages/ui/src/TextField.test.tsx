import { render, screen } from '@testing-library/react';
import { expectNoAxeViolations } from './test/axe.js';
import { TextField } from './TextField.js';

describe('TextField', () => {
  it('labels the input and links hint and error', () => {
    render(<TextField label="Name" hint="As on your ID" error="Required" defaultValue="Asha" />);
    const input = screen.getByLabelText('Name');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect((input as HTMLInputElement).value).toBe('Asha');
  });

  it('renders a textarea when multiline', () => {
    render(<TextField multiline label="Note" maxLength={2000} />);
    expect(screen.getByLabelText('Note').tagName).toBe('TEXTAREA');
  });

  it('UX-01.2 has no axe violations', async () => {
    const { container } = render(
      <>
        <TextField label="Name" hint="Hint" />
        <TextField multiline label="Note" error="Too long" />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});
