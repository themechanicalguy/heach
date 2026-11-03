// @vitest-environment node
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

vi.mock('./lib/flags', () => ({ serverFlags: () => ({ isOn: () => false }) }));

it('loads home messages for trailing-slash locale paths and remembers language with accounts off', () => {
  const response = proxy(new NextRequest('https://example.test/hi/'));
  expect(response.headers.get('x-middleware-request-x-heach-page')).toBe('home');
  expect(response.cookies.get('heach_lang')?.value).toBe('hi');
  expect(response.cookies.get('heach_lang')?.secure).toBe(true);
  const redirected = proxy(
    new NextRequest('https://example.test/', {
      headers: { cookie: 'heach_lang=hi' },
    }),
  );
  expect(redirected.headers.get('location')).toBe('https://example.test/hi');
});

it('does not remember the welcome suggestion until a language is chosen', () => {
  expect(
    proxy(new NextRequest('https://example.test/or/welcome')).cookies.get('heach_lang'),
  ).toBeUndefined();
});
