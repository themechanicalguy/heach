import { ProviderJoin } from './ProviderJoin';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/ProviderJoin', component: ProviderJoin };
export const English = {
  render: () => (
    <StoryEnvironment>
      <ProviderJoin locale="en" {...{ accounts: true }} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <ProviderJoin locale="or" {...{ accounts: true }} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <ProviderJoin locale="hi" {...{ accounts: true }} />
    </StoryEnvironment>
  ),
};
