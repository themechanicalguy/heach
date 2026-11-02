import { RecordActions } from './RecordActions';
import { StoryEnvironment } from '../site/StoryEnvironment';
import { SYNTHETIC_RECORD } from './synthetic-record';

export default { title: 'Vault/Record actions', component: RecordActions };
export const Default = {
  render: () => (
    <StoryEnvironment>
      <RecordActions record={SYNTHETIC_RECORD} showAccess />
    </StoryEnvironment>
  ),
};
