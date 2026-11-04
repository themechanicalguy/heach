import { LanguageSwitch } from '../LanguageSwitch';
import { HeaderCare } from './HeaderCare';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/HeaderCare', component: HeaderCare };
export const English = {
  render: () => (
    <StoryEnvironment>
      <HeaderCare language={<LanguageSwitch />} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <HeaderCare language={<LanguageSwitch />} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <HeaderCare language={<LanguageSwitch />} />
    </StoryEnvironment>
  ),
};
