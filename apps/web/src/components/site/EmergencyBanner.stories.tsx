import { EmergencyBanner } from './EmergencyBanner';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/EmergencyBanner', component: EmergencyBanner };
export const English = {
  render: () => (
    <StoryEnvironment>
      <EmergencyBanner locale="en" {...{}} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <EmergencyBanner locale="or" {...{}} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <EmergencyBanner locale="hi" {...{}} />
    </StoryEnvironment>
  ),
};
