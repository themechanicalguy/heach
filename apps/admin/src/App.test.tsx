import { render, screen } from '@testing-library/react';
import { App } from './App';
import en from '../messages/en.json';

describe('App', () => {
  it('renders the sidebar navigation and dashboard heading from messages', () => {
    render(<App />);

    expect(screen.getByRole('navigation', { name: en.app.navLabel })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: en.dashboard.title })).toBeTruthy();
    expect(screen.getByRole('main').textContent).toContain(en.dashboard.placeholder);
  });
});
