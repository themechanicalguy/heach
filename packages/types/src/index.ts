import type { components } from './generated/api.js';

/** Generated from the apps/api OpenAPI document. Regenerate with `pnpm --filter @heach/types generate`. */
export type { components, paths } from './generated/api.js';

export type HealthStatus = components['schemas']['HealthStatusDto'];
export type Readiness = components['schemas']['ReadinessDto'];
export type AccessToken = components['schemas']['AccessTokenDto'];
export type TestLogin = components['schemas']['TestLoginDto'];
export type Logout = components['schemas']['LogoutDto'];
export type WebVital = components['schemas']['WebVitalDto'];
export type CreateNote = components['schemas']['CreateNoteDto'];
export type CreatedNote = components['schemas']['CreatedNoteDto'];
export type Note = components['schemas']['NoteDto'];
export type OtpRequest = components['schemas']['OtpRequestDto'];
export type OtpChallenge = components['schemas']['OtpChallengeDto'];
export type OtpVerify = components['schemas']['OtpVerifyDto'];
export type Me = components['schemas']['MeDto'];
export type RoleGrant = components['schemas']['RoleGrantDto'];
export type SetupDraft = components['schemas']['SetupDraftDto'];
export type SetupPatch = components['schemas']['SetupPatchDto'];
export type Consent = components['schemas']['ConsentDto'];
export type AddRole = components['schemas']['AddRoleDto'];
export type AdminPasswordAccepted = components['schemas']['AdminPasswordAcceptedDto'];
export type AdminMe = components['schemas']['AdminMeDto'];
export type UserSummary = components['schemas']['UserSummaryDto'];
export type UserDetail = components['schemas']['UserDetailDto'];
export type UserPage = components['schemas']['UserPageDto'];
export type LinkedPatient = components['schemas']['LinkedPatientDto'];
export type LinkedPatientInput = components['schemas']['LinkedPatientInputDto'];
export type ProfileCorrection = components['schemas']['ProfileCorrectionDto'];
export type AccountExport = components['schemas']['AccountExportDto'];
export type Organisation = components['schemas']['OrganisationDto'];
export type Member = components['schemas']['MemberDto'];
export type Invitation = components['schemas']['InvitationDto'];
export type Membership = components['schemas']['MembershipDto'];
export type AdminSummary = components['schemas']['AdminSummaryDto'];
export type CreatedAdmin = components['schemas']['CreatedAdminDto'];
export type TemporaryPassword = components['schemas']['TemporaryPasswordDto'];
export type Application = components['schemas']['ApplicationDto'];
export type ChecklistEntry = components['schemas']['ChecklistEntryDto'];
export type ProviderDocument = components['schemas']['DocumentDto'];
export type DocumentUpload = components['schemas']['DocumentUploadDto'];
export type PayoutDetails = components['schemas']['PayoutDetailsDto'];
export type IdentityRedirect = components['schemas']['IdentityRedirectDto'];
export type ApplicationSummary = components['schemas']['ApplicationSummaryDto'];
export type ApplicationReview = components['schemas']['ApplicationReviewDto'];
export type Decision = components['schemas']['DecisionDto'];
export type DocumentReview = components['schemas']['DocumentReviewDto'];
export type StoredFile = components['schemas']['StoredFileDto'];
export type CatalogueItem = components['schemas']['CatalogueItemDto'];
export type PinCode = components['schemas']['PinCodeDto'];
export type ProviderListings = components['schemas']['ProviderListingsDto'];
export type ListableItem = components['schemas']['ListableItemDto'];
export type ListingInput = components['schemas']['ListingInputDto'];
export type Availability = components['schemas']['AvailabilityDto'];
export type WeeklyRule = components['schemas']['WeeklyRuleDto'];
export type SearchResult = components['schemas']['SearchResultDto'];
export type ProviderProfile = components['schemas']['ProviderProfileDto'];
export type ProfileListing = components['schemas']['ProfileListingDto'];
export type Slots = components['schemas']['SlotsDto'];

/** The stable reason code in an API error body; the client translates it (never personal data). */
export interface ApiErrorBody {
  statusCode: number;
  code?: string;
}
