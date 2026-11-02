import { ProviderCard } from './ProviderCard';
import { StoryEnvironment } from '../site/StoryEnvironment';

export default { title: 'Care/Provider card', component: ProviderCard };
export const Approved = {
  render: () => (
    <StoryEnvironment>
      <ProviderCard
        result={{
          providerId: '00000000-0000-4000-8000-000000000011',
          listingId: '00000000-0000-4000-8000-000000000012',
          name: 'Synthetic Provider',
          role: 'nurse',
          gender: 'female',
          languages: ['or', 'en'],
          itemCode: 'nursing_injection',
          itemName: 'Synthetic nursing visit',
          kind: 'visit',
          prescriptionRequired: true,
          feePaise: 30000,
          travelSurchargePaise: 0,
          durationMinutes: 30,
          earliestSlot: null,
          rating: null,
          ratingCount: 0,
        }}
      />
    </StoryEnvironment>
  ),
};
