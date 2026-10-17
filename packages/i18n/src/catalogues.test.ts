import { CATALOGUES } from './catalogue.js';
import { findCatalogueProblems } from './catalogues.js';

describe('Catalogues', () => {
  it('I18N-07.1 every locale has every key, valid ICU and the same arguments', () => {
    expect(
      findCatalogueProblems({ en: CATALOGUES.en, or: CATALOGUES.or, hi: CATALOGUES.hi }),
    ).toEqual([]);
  });

  it('I18N-07.1 fixture: a missing key, bad ICU, wrong arguments and extras are reported', () => {
    const en = { a: 'A', b: '{n, plural, one {#} other {#}}', c: 'Hi {name}' };
    const hi = { b: '{n, plural, one {#}}', c: 'Hi {nom}', d: 'extra' };
    expect(findCatalogueProblems({ en, hi })).toEqual([
      { locale: 'hi', key: 'a', problem: 'missing' },
      { locale: 'hi', key: 'b', problem: 'invalid ICU' },
      { locale: 'hi', key: 'c', problem: 'arguments differ' },
      { locale: 'hi', key: 'd', problem: 'extra' },
    ]);
  });
});
