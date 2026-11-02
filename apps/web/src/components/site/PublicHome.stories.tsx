import { PublicHome } from './PublicHome';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/PublicHome', component: PublicHome };
export const English = {
  render: () => (
    <StoryEnvironment>
      <PublicHome locale="en" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <PublicHome locale="or" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <PublicHome locale="hi" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
