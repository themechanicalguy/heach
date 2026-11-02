import { NearbyProviders } from './NearbyProviders';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/NearbyProviders', component: NearbyProviders };
export const English = {
  render: () => (
    <StoryEnvironment>
      <NearbyProviders {...{}} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <NearbyProviders {...{}} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <NearbyProviders {...{}} />
    </StoryEnvironment>
  ),
};
