import { namesMatch } from './name-match.js';

describe('Name match against the verified identity (KY-04)', () => {
  it.each([
    ['Synthetic Person', 'Synthetic Person'],
    ['synthetic person', 'PERSON SYNTHETIC'],
    ['Synthetic K Person', 'Synthetic Kumar Person'],
    ['Synthetic Person', 'Synthetic Kumar Person'],
    ['Dr. Synthetic Person', 'Synthetic Person'],
    ['ସିନ୍ଥେଟିକ୍ ବ୍ୟକ୍ତି', 'ସିନ୍ଥେଟିକ୍ ବ୍ୟକ୍ତି'],
  ])('KY-04 %s matches %s', (typed, verified) => {
    expect(namesMatch(typed, verified)).toBe(true);
  });

  it.each([
    ['Synthetic Person', 'Another Person'],
    ['Synthetic Person', 'Synthetic Human'],
    ['S P', 'Synthetic Person'],
    ['', 'Synthetic Person'],
    ['ସିନ୍ଥେଟିକ୍ ବ୍ୟକ୍ତି', 'Synthetic Person'],
  ])('KY-04 %s does not match %s', (typed, verified) => {
    expect(namesMatch(typed, verified)).toBe(false);
  });
});
