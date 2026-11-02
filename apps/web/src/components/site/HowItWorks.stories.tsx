import { HowItWorks } from './HowItWorks';
import { StoryEnvironment } from './StoryEnvironment';
export default { title: 'Site/How it works', component: HowItWorks };
export const English = {
  render: () => (
    <StoryEnvironment>
      <HowItWorks locale="en" />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <HowItWorks locale="or" />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <HowItWorks locale="hi" />
    </StoryEnvironment>
  ),
};
