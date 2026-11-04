import { SYNTHETIC_RECORD } from './synthetic-record';
import { VaultTimeline } from './VaultTimeline';
import { StoryEnvironment } from '../site/StoryEnvironment';

export default { title: 'Vault/Timeline', component: VaultTimeline };
export const Empty = {
  render: () => (
    <StoryEnvironment>
      <VaultTimeline records={[]} onShare={() => undefined} onRefresh={() => Promise.resolve()} />
    </StoryEnvironment>
  ),
};

export const Populated = {
  render: () => (
    <StoryEnvironment>
      <VaultTimeline
        records={[SYNTHETIC_RECORD]}
        onShare={() => undefined}
        onRefresh={() => Promise.resolve()}
      />
    </StoryEnvironment>
  ),
};
