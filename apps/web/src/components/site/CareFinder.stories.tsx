import { CareFinder } from './CareFinder';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/CareFinder', component: CareFinder };
export const English = {
  render: () => (
    <StoryEnvironment>
      <CareFinder {...{}} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <CareFinder {...{}} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <CareFinder {...{}} />
    </StoryEnvironment>
  ),
};
