import { BookAny } from './BookPages';
import { StoryEnvironment } from '../site/StoryEnvironment';

export default { title: 'Booking/Location after reload', component: BookAny };
export const NeedsPin = {
  render: () => (
    <StoryEnvironment>
      <BookAny itemCode="physio_assessment" />
    </StoryEnvironment>
  ),
};
