import { SiteFooter } from './SiteFooter';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/SiteFooter', component: SiteFooter };
export const English = {
  render: () => (
    <StoryEnvironment>
      <SiteFooter locale="en" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <SiteFooter locale="or" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <SiteFooter locale="hi" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
