import { demoAuthState, demoMembers, demoPets, demoRecords, demoReminderSettings } from "../data/mock";
import type {
  AuthState,
  FamilyMember,
  HomeData,
  PetDetailData,
  PetDraft,
  PetProfile,
  PetRecord,
  RecordDraft,
  ReminderSettings
} from "../types/domain";
import { getLatestRecord, getLatestWeight, getUpcomingReminder } from "../utils/pet";

const state: {
  auth: AuthState;
  pets: PetProfile[];
  members: FamilyMember[];
  records: PetRecord[];
  reminderSettings: ReminderSettings;
} = {
  auth: { ...demoAuthState, user: { ...demoAuthState.user } },
  pets: demoPets.map((item) => ({ ...item })),
  members: demoMembers.map((item) => ({ ...item })),
  records: demoRecords.map((item) => ({ ...item })),
  reminderSettings: { ...demoReminderSettings }
};

function getCurrentPet(): PetProfile {
  return state.pets.find((item) => item.id === state.auth.currentPetId) || state.pets[0];
}

function sortRecords(records: PetRecord[]): PetRecord[] {
  return [...records].sort((a, b) => {
    const dateA =
      a.type === "vaccine" ? a.vaccinatedAt : a.type === "deworm" ? a.executedAt : a.recordedAt;
    const dateB =
      b.type === "vaccine" ? b.vaccinatedAt : b.type === "deworm" ? b.executedAt : b.recordedAt;
    return dateA < dateB ? 1 : -1;
  });
}

export function getAuthState(): AuthState {
  return { ...state.auth, user: { ...state.auth.user } };
}

export function loginWithWechat(): AuthState {
  state.auth.isLoggedIn = true;
  return getAuthState();
}

export function logout(): AuthState {
  state.auth.isLoggedIn = false;
  state.auth.hasCompletedOnboarding = false;
  return getAuthState();
}

export function completeOnboarding(): AuthState {
  state.auth.hasCompletedOnboarding = true;
  return getAuthState();
}

export function getHomeData(): HomeData {
  const currentPet = getCurrentPet();
  const petRecords = state.records.filter((item) => item.petId === currentPet.id);
  return {
    currentPet,
    reminder: getUpcomingReminder(currentPet, petRecords),
    latestWeight: getLatestWeight(petRecords),
    latestRecord: getLatestRecord(petRecords),
    petCount: state.pets.length,
    familyMemberCount: state.members.length
  };
}

export function listPets(): PetProfile[] {
  return state.pets.map((item) => ({ ...item }));
}

export function setCurrentPet(petId: string): void {
  if (state.pets.some((item) => item.id === petId)) {
    state.auth.currentPetId = petId;
  }
}

export function getPetDetail(petId: string): PetDetailData {
  const pet = state.pets.find((item) => item.id === petId) || getCurrentPet();
  const petRecords = sortRecords(state.records.filter((item) => item.petId === pet.id));
  return {
    pet,
    latestWeight: getLatestWeight(petRecords),
    vaccines: petRecords.filter((item) => item.type === "vaccine"),
    deworms: petRecords.filter((item) => item.type === "deworm"),
    weights: petRecords.filter((item) => item.type === "weight")
  };
}

export function savePet(draft: PetDraft): PetProfile {
  if (draft.id) {
    state.pets = state.pets.map((item) => (item.id === draft.id ? { ...item, ...draft } : item));
    return state.pets.find((item) => item.id === draft.id) || state.pets[0];
  }

  const pet: PetProfile = {
    id: `pet_${Date.now()}`,
    familyId: "family_1",
    ...draft
  };
  state.pets.unshift(pet);
  state.auth.currentPetId = pet.id;
  return pet;
}

export function listRecords(filter?: { petId?: string; type?: string }): PetRecord[] {
  const filtered = state.records.filter((item) => {
    const petMatch = filter?.petId ? item.petId === filter.petId : true;
    const typeMatch = filter?.type && filter.type !== "all" ? item.type === filter.type : true;
    return petMatch && typeMatch;
  });
  return sortRecords(filtered);
}

export function saveRecord(draft: RecordDraft): PetRecord {
  const baseId = `rec_${Date.now()}`;
  let record: PetRecord;

  if (draft.type === "vaccine") {
    record = {
      id: baseId,
      petId: draft.petId,
      type: "vaccine",
      vaccineName: draft.vaccineName || "疫苗",
      vaccinatedAt: draft.vaccinatedAt || "",
      nextDueAt: draft.nextDueAt,
      note: draft.note
    };
  } else if (draft.type === "deworm") {
    record = {
      id: baseId,
      petId: draft.petId,
      type: "deworm",
      mode: draft.mode || "internal",
      brand: draft.brand || "",
      executedAt: draft.executedAt || "",
      nextDueAt: draft.nextDueAt,
      note: draft.note
    };
  } else {
    record = {
      id: baseId,
      petId: draft.petId,
      type: "weight",
      weightKg: Number(draft.weightKg || 0),
      recordedAt: draft.recordedAt || "",
      note: draft.note
    };
  }

  state.records.unshift(record);
  return record;
}

export function listFamilyMembers(): FamilyMember[] {
  return state.members.map((item) => ({ ...item }));
}

export function getReminderSettings(): ReminderSettings {
  return { ...state.reminderSettings };
}

export function saveReminderSettings(next: ReminderSettings): ReminderSettings {
  state.reminderSettings = { ...next };
  return getReminderSettings();
}

export function getInviteData() {
  return {
    familyName: `${getCurrentPet().name} 的家庭`,
    inviteCode: "CAT-2026",
    expiresHint: "24 小时内有效",
    memberCount: state.members.length
  };
}
