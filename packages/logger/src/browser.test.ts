import { PRIVATE_ERROR_REPORTING, withoutQueryOrFragment } from './browser.js';

describe('front-end error reporting keeps personal data out (LM-03.1)', () => {
  it('cuts the query string and fragment from a URL', () => {
    expect(withoutQueryOrFragment('https://h.example/or/shared#Ab3_synthetic-token')).toBe(
      'https://h.example/or/shared',
    );
    expect(withoutQueryOrFragment('/en/book?pin=751024#x')).toBe('/en/book');
  });

  it('drops the user, cookies, headers and query string from an event', () => {
    const event = PRIVATE_ERROR_REPORTING.beforeSend({
      user: { id: 'synthetic' },
      request: {
        url: 'https://h.example/admin/users?q=98765#t',
        cookies: { session: 'x' },
        headers: { authorization: 'x' },
        query_string: 'q=98765',
      },
    });
    expect(event).toEqual({ request: { url: 'https://h.example/admin/users' } });
  });

  it('shortens the URLs a breadcrumb carries and leaves other data', () => {
    const crumb = PRIVATE_ERROR_REPORTING.beforeBreadcrumb({
      data: { from: '/a?x=1', to: '/b#t', url: '/c?y', status_code: 200 },
    });
    expect(crumb.data).toEqual({ from: '/a', to: '/b', url: '/c', status_code: 200 });
  });

  it('turns off every kind of data collection that could hold personal data', () => {
    expect(PRIVATE_ERROR_REPORTING.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
  });
});
