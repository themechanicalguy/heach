import { RecordCard, RecordDetails } from './RecordCard';
import { StoryEnvironment } from '../site/StoryEnvironment';
import { SYNTHETIC_RECORD } from './synthetic-record';

export default { title: 'Vault/Record', component: RecordCard };
export const Card = {
  render: () => (
    <StoryEnvironment>
      <RecordCard record={SYNTHETIC_RECORD} showAccess />
    </StoryEnvironment>
  ),
};
export const Details = {
  render: () => (
    <StoryEnvironment>
      <RecordDetails record={SYNTHETIC_RECORD} />
    </StoryEnvironment>
  ),
};
