import { PatientHome } from './PatientHome';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/PatientHome', component: PatientHome };
export const English = {
  render: () => (
    <StoryEnvironment>
      <PatientHome locale="en" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <PatientHome locale="or" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <PatientHome locale="hi" {...{ config: {} }} />
    </StoryEnvironment>
  ),
};
