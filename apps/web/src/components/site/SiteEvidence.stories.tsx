import { SiteEvidence } from './SiteEvidence';
import { StoryEnvironment } from './StoryEnvironment';

export default {
  title: 'Site/Evidence (synthetic Storybook examples only)',
  component: SiteEvidence,
};
const config = {
  metrics: { providers: 3, visits: 4, cities: 1, asOf: '2026-10-01' },
  reviews: Array.from({ length: 3 }, () => ({
    firstName: 'Synthetic',
    service: 'nursing' as const,
    text: 'Synthetic review of clear prices.',
    locale: 'en' as const,
  })),
};
export const English = {
  render: () => (
    <StoryEnvironment>
      <SiteEvidence locale="en" config={config} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <SiteEvidence locale="or" config={config} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <SiteEvidence locale="hi" config={config} />
    </StoryEnvironment>
  ),
};
export const Hidden = {
  render: () => (
    <StoryEnvironment>
      <SiteEvidence locale="en" config={{}} />
    </StoryEnvironment>
  ),
};
