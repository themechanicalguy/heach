import { NextBooking } from './NextBooking';
import { StoryEnvironment } from './StoryEnvironment';

export default { title: 'Site/NextBooking', component: NextBooking };
export const English = {
  render: () => (
    <StoryEnvironment>
      <NextBooking {...{}} />
    </StoryEnvironment>
  ),
};
export const Odia = {
  render: () => (
    <StoryEnvironment locale="or">
      <NextBooking {...{}} />
    </StoryEnvironment>
  ),
};
export const Hindi = {
  render: () => (
    <StoryEnvironment locale="hi">
      <NextBooking {...{}} />
    </StoryEnvironment>
  ),
};
