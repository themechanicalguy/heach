import type { PinCoverage } from '@heach/types';
import { ServiceablePins } from './ServiceablePins';
import { StoryEnvironment } from './StoryEnvironment';

const pins: PinCoverage[] = [
  {
    pin: '751001',
    district: 'Khordha',
    providers: 12,
    band: 'available',
    nextAvailable: '2026-11-10T05:00:00.000Z',
  },
  {
    pin: '751002',
    district: 'Khordha',
    providers: 2,
    band: 'limited',
    nextAvailable: null,
  },
  { pin: '751003', district: 'Khordha', providers: 0, band: 'none', nextAvailable: null },
];

export default { title: 'Site/ServiceablePins', component: ServiceablePins };
export const English = {
  render: () => (
    <StoryEnvironment>
      <ServiceablePins locale="en" service="physiotherapy" pins={pins} accounts />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <ServiceablePins locale="or" service="physiotherapy" pins={pins} accounts={false} />
    </StoryEnvironment>
  ),
};
