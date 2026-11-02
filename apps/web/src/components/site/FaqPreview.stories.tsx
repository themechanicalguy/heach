import { FaqPreview } from './FaqPreview';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/FaqPreview', component: FaqPreview };
export const English = {
  render: () => (
    <StoryEnvironment>
      <FaqPreview locale="en" {...{}} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <FaqPreview locale="or" {...{}} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <FaqPreview locale="hi" {...{}} />
    </StoryEnvironment>
  ),
};
