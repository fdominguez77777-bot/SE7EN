import { BidderProfile } from './bidder-profile.entity';
import { Education } from './education.entity';
import { WorkExperience } from './work-experience.entity';

const SENSITIVE_KEYS = [
  'dateOfBirth',
  'streetAddress',
  'raceEthnicity',
  'veteranStatus',
  'disabilityStatus',
] as const;

export function toExperienceDto(row: WorkExperience) {
  return {
    id: row.id,
    candidateProfileId: row.candidateProfileId,
    companyName: row.companyName,
    industry: row.industry,
    city: row.city,
    state: row.state,
    startDate: row.startDate,
    endDate: row.endDate,
    currentlyWorksHere: row.currentlyWorksHere,
    sortOrder: row.sortOrder,
  };
}

export function toEducationDto(row: Education) {
  return {
    id: row.id,
    candidateProfileId: row.candidateProfileId,
    institutionName: row.institutionName,
    degree: row.degree,
    fromDate: row.fromDate,
    toDate: row.toDate,
    sortOrder: row.sortOrder,
  };
}

export function toCandidateDto(
  profile: BidderProfile,
  options: {
    includeSensitive: boolean;
    assignedUser?: { id: number; name: string; email: string } | null;
  },
) {
  const dto: Record<string, unknown> = {
    id: profile.id,
    profileName: profile.name,
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    email: profile.email,
    phoneNumber: profile.phoneNumber ?? profile.phone,
    gender: profile.gender,
    city: profile.city,
    stateRegion: profile.stateRegion,
    zipPostalCode: profile.zipPostalCode,
    linkedinUrl: profile.linkedinUrl,
    githubUrl: profile.githubUrl,
    portfolioUrl: profile.portfolioUrl,
    status: profile.status,
    assignedUser: options.assignedUser ?? null,
    experiences: (profile.experiences ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map(toExperienceDto),
    educations: (profile.educations ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map(toEducationDto),
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };

  if (options.includeSensitive) {
    dto.dateOfBirth = profile.dateOfBirth;
    dto.streetAddress = profile.streetAddress;
    dto.raceEthnicity = profile.raceEthnicity;
    dto.veteranStatus = profile.veteranStatus;
    dto.disabilityStatus = profile.disabilityStatus;
  } else {
    for (const key of SENSITIVE_KEYS) {
      dto[key] = null;
    }
  }

  return dto;
}
