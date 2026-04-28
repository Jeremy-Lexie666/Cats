import type {
  AuthState,
  FamilyMember,
  PetProfile,
  PetRecord,
  ReminderSettings,
  UserProfile
} from "../types/domain";

export const demoUser: UserProfile = {
  id: "user_1",
  nickname: "Jeremy",
  avatarText: "J"
};

export const demoAuthState: AuthState = {
  isLoggedIn: false,
  currentPetId: "pet_mi",
  hasCompletedOnboarding: false,
  user: demoUser
};

export const demoPets: PetProfile[] = [
  {
    id: "pet_mi",
    familyId: "family_1",
    name: "米糕",
    birthday: "2025-08-12",
    breed: "英短银渐层",
    gender: "female",
    isNeutered: false,
    avatarText: "米",
    note: "很黏人，看到逗猫棒会立刻冲过来。"
  }
];

export const demoMembers: FamilyMember[] = [
  {
    id: "member_1",
    familyId: "family_1",
    displayName: "Jeremy",
    role: "owner",
    joinedAt: "2026-04-12"
  },
  {
    id: "member_2",
    familyId: "family_1",
    displayName: "家人",
    role: "member",
    joinedAt: "2026-04-15"
  }
];

export const demoRecords: PetRecord[] = [
  {
    id: "rec_1",
    petId: "pet_mi",
    type: "vaccine",
    vaccineName: "猫三联",
    vaccinatedAt: "2026-04-10",
    nextDueAt: "2026-05-10",
    note: "状态稳定"
  },
  {
    id: "rec_2",
    petId: "pet_mi",
    type: "deworm",
    mode: "external",
    brand: "大宠爱",
    executedAt: "2026-04-18",
    nextDueAt: "2026-05-18",
    note: "已滴完"
  },
  {
    id: "rec_3",
    petId: "pet_mi",
    type: "weight",
    weightKg: 3.25,
    recordedAt: "2026-04-25",
    note: "比上次增加 0.1kg"
  }
];

export const demoReminderSettings: ReminderSettings = {
  vaccineEnabled: true,
  dewormEnabled: true,
  leadDays: 3
};
