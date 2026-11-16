import { fitWithin, shrinkPhoto } from './photo';

describe('fitWithin (MA-06)', () => {
  it('scales the long edge down to the limit and keeps the shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 });
  });

  it('never enlarges a small photo', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

it('shrinkPhoto returns the photo unchanged where it cannot be redrawn', async () => {
  const photo = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  expect(await shrinkPhoto(photo)).toBe(photo);
});
