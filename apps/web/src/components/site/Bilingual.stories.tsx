import { Bilingual } from './Bilingual';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/Bilingual', component: Bilingual };
export const English = {
  render: () => (
    <StoryEnvironment>
      <Bilingual locale="en" {...{ message: 'site.need' }} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <Bilingual locale="or" {...{ message: 'site.need' }} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <Bilingual locale="hi" {...{ message: 'site.need' }} />
    </StoryEnvironment>
  ),
};
