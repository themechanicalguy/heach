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

it('opens a path without a language in the language last used, as the provider app starts', () => {
  const start = (cookie: string) =>
    proxy(
      new NextRequest('https://example.test/provider', {
        headers: {
          cookie,
          'accept-language': 'en-IN',
          'user-agent': 'Chrome/140 HeachApp/provider',
        },
      }),
    ).headers.get('location');
  expect(start('heach_lang=or')).toBe('https://example.test/or/provider');
  expect(start('')).toBe('https://example.test/en/provider');
});

describe('Android apps serve one side each (MA-08)', () => {
  const from = (path: string, app: string) =>
    proxy(
      new NextRequest(`https://example.test${path}`, {
        headers: { 'user-agent': `Mozilla/5.0 Chrome/140 HeachApp/${app}` },
      }),
    );

  it('sends patient pages opened in the provider app to the provider area', () => {
    expect(from('/en', 'provider').headers.get('location')).toBe(
      'https://example.test/en/provider',
    );
    expect(from('/or/bookings', 'provider').headers.get('location')).toBe(
      'https://example.test/or/provider',
    );
  });

  it('sends provider pages opened in the patient app to the home page', () => {
    expect(from('/hi/provider/requests', 'patient').headers.get('location')).toBe(
      'https://example.test/hi',
    );
    expect(from('/en/providers/join', 'patient').headers.get('location')).toBe(
      'https://example.test/en',
    );
  });

  it('leaves each app its own pages and shared pages', () => {
    expect(from('/en/provider', 'provider').headers.get('location')).toBeNull();
    expect(from('/en/bookings', 'patient').headers.get('location')).toBeNull();
    expect(from('/en/account', 'provider').headers.get('location')).toBeNull();
  });
});
