import { fireEvent, render, screen } from '@testing-library/react';
import { CheckboxField } from './CheckboxField.js';
import { ChoiceGroup } from './ChoiceGroup.js';
import { Notice } from './Notice.js';
import { Progress } from './Progress.js';
import { expectNoAxeViolations } from './test/axe.js';

const choices = [
  { value: 'or', label: 'ଓଡ଼ିଆ', lang: 'or' },
  { value: 'en', label: 'English', lang: 'en' },
];

describe('Progress', () => {
  it('A11Y-02 announces the step as a progress bar', async () => {
    const { container } = render(<Progress current={2} total={3} label="Step 2 of 3" />);
    const bar = screen.getByRole('progressbar', { name: 'Step 2 of 3' });
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
    expect(container.querySelectorAll('[data-done="true"]')).toHaveLength(2);
    await expectNoAxeViolations(container);
  });
});

describe('ChoiceGroup', () => {
  it('A11Y-04 radio cards in a fieldset; the label carries its language', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <ChoiceGroup legend="Language" choices={choices} value="or" onChange={onChange} />,
    );
    expect(screen.getByRole('group', { name: 'Language' })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'ଓଡ଼ିଆ' }).checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(onChange).toHaveBeenCalledWith('en', true);
    expect(screen.getByText('English').getAttribute('lang')).toBe('en');
    await expectNoAxeViolations(container);
  });

  it('A11Y-04 several values as checkboxes, with the error announced', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <ChoiceGroup
        legend="Languages"
        choices={choices}
        value={['en']}
        multiple
        error="Choose at least one"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'English' }));
    expect(onChange).toHaveBeenCalledWith('en', false);
    expect(screen.getByRole('alert').textContent).toBe('Choose at least one');
    await expectNoAxeViolations(container);
  });
});

describe('CheckboxField', () => {
  it('A11Y-04 is labelled and describes its error', async () => {
    const { container } = render(<CheckboxField label="I am 18 or older" error="Please confirm" />);
    const box = screen.getByRole('checkbox', { name: 'I am 18 or older' });
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(box.getAttribute('aria-describedby')).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});

describe('Notice', () => {
  it('UX-04 is silent by default and a status when live', async () => {
    const { container, rerender } = render(<Notice>Encrypted</Notice>);
    expect(screen.queryByRole('status')).toBeNull();
    rerender(
      <Notice live tone="warning">
        In review
      </Notice>,
    );
    expect(screen.getByRole('status').textContent).toBe('In review');
    await expectNoAxeViolations(container);
  });
});
