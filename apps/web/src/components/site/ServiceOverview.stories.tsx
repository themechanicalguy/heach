import { ServiceOverview } from './ServiceOverview';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/ServiceOverview', component: ServiceOverview };
export const English = {
  render: () => (
    <StoryEnvironment>
      <ServiceOverview locale="en" {...{ service: 'physiotherapy', accounts: true }} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <ServiceOverview locale="or" {...{ service: 'physiotherapy', accounts: true }} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <ServiceOverview locale="hi" {...{ service: 'physiotherapy', accounts: true }} />
    </StoryEnvironment>
  ),
};
