import { ContactPage } from './ContactPage';
import { SYNTHETIC_CONTACT } from './contact-fixture';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/ContactPage', component: ContactPage };
export const Confirmed = {
  render: () => (
    <StoryEnvironment>
      <ContactPage locale="en" config={SYNTHETIC_CONTACT} />
    </StoryEnvironment>
  ),
};
export const Pending = {
  render: () => (
    <StoryEnvironment>
      <ContactPage locale="en" config={{}} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <ContactPage locale="or" config={SYNTHETIC_CONTACT} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <ContactPage locale="hi" config={SYNTHETIC_CONTACT} />
    </StoryEnvironment>
  ),
};
