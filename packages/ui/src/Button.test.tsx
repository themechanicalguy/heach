import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from './Button.js';
import { expectNoAxeViolations } from './test/axe.js';

describe('Button', () => {
  it('renders its label and defaults to type="button"', () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toBe('heach-button');
  });

  it('calls onClick and keeps caller classes', () => {
    const onClick = vi.fn();
    render(
      <Button className="wide" onClick={onClick}>
        Go
      </Button>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button').className).toBe('heach-button wide');
  });

  it('UX-01.2 has no axe violations', async () => {
    const { container } = render(<Button>Save</Button>);
    await expectNoAxeViolations(container);
  });
});
