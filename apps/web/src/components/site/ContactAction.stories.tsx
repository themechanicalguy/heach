import { ContactAction } from './ContactAction';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/ContactAction', component: ContactAction };
export const English = {
  render: () => (
    <StoryEnvironment>
      <ContactAction locale="en" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <ContactAction locale="or" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <ContactAction locale="hi" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
