export type PetGender = "male" | "female" | "unknown";
export type MemberRole = "owner" | "member";
export type RecordType = "vaccine" | "deworm" | "weight";

export interface UserProfile {
  id: string;
  nickname: string;
  avatarText: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  currentPetId: string;
  hasCompletedOnboarding: boolean;
  user: UserProfile;
  sessionToken?: string;
  sessionExpiresAt?: string;
}

export interface PetProfile {
  id: string;
  familyId: string;
  name: string;
  birthday: string;
  breed: string;
  gender: PetGender;
  isNeutered: boolean;
  avatarText: string;
  photoUrl?: string;
  note?: string;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  displayName: string;
  role: MemberRole;
  joinedAt: string;
}

export interface VaccineRecord {
  id: string;
  petId: string;
  type: "vaccine";
  vaccineName: string;
  vaccinatedAt: string;
  nextDueAt?: string;
  note?: string;
}

export interface DewormRecord {
  id: string;
  petId: string;
  type: "deworm";
  mode: "internal" | "external";
  brand: string;
  executedAt: string;
  nextDueAt?: string;
  note?: string;
}

export interface WeightRecord {
  id: string;
  petId: string;
  type: "weight";
  weightKg: number;
  recordedAt: string;
  note?: string;
}

export type PetRecord = VaccineRecord | DewormRecord | WeightRecord;

export interface ReminderSettings {
  vaccineEnabled: boolean;
  dewormEnabled: boolean;
  leadDays: number;
}

export interface HomeReminder {
  id: string;
  petId: string;
  title: string;
  dueDate: string;
  daysLeft: number;
}

export interface HomeData {
  currentPet?: PetProfile;
  reminder?: HomeReminder;
  latestWeight?: WeightRecord;
  latestRecord?: PetRecord;
  petCount: number;
  familyMemberCount: number;
}

export interface PetDetailData {
  pet: PetProfile;
  latestWeight?: WeightRecord;
  vaccines: VaccineRecord[];
  deworms: DewormRecord[];
  weights: WeightRecord[];
}

export interface RecordDraft {
  id?: string;
  petId: string;
  type: RecordType;
  vaccineName?: string;
  vaccinatedAt?: string;
  nextDueAt?: string;
  mode?: "internal" | "external";
  brand?: string;
  executedAt?: string;
  weightKg?: number;
  recordedAt?: string;
  note?: string;
}

export interface PetDraft {
  id?: string;
  name: string;
  birthday: string;
  breed: string;
  gender: PetGender;
  isNeutered: boolean;
  avatarText: string;
  note?: string;
}
