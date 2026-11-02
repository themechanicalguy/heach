import { PublicHome } from './PublicHome';
import { PatientHome } from './PatientHome';
import { HomeView } from './HomeView';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/HomeView', component: HomeView };
export const English = {
  render: () => (
    <StoryEnvironment>
      <HomeView
        publicHome={<PublicHome config={{}} locale="en" />}
        patientHome={<PatientHome config={{}} locale="en" />}
      />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <HomeView
        publicHome={<PublicHome config={{}} locale="or" />}
        patientHome={<PatientHome config={{}} locale="or" />}
      />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <HomeView
        publicHome={<PublicHome config={{}} locale="hi" />}
        patientHome={<PatientHome config={{}} locale="hi" />}
      />
    </StoryEnvironment>
  ),
};
