import * as store from "../store/mock-store";
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

function isMockMode(): boolean {
  const app = getApp<IAppOption>();
  return app.globalData.useMock;
}

export const api = {
  async getAuthState(): Promise<AuthState> {
    if (isMockMode()) return Promise.resolve(store.getAuthState());
    return Promise.resolve(store.getAuthState());
  },
  async loginWithWechat(): Promise<AuthState> {
    if (isMockMode()) return Promise.resolve(store.loginWithWechat());
    return Promise.resolve(store.loginWithWechat());
  },
  async logout(): Promise<AuthState> {
    if (isMockMode()) return Promise.resolve(store.logout());
    return Promise.resolve(store.logout());
  },
  async completeOnboarding(): Promise<AuthState> {
    if (isMockMode()) return Promise.resolve(store.completeOnboarding());
    return Promise.resolve(store.completeOnboarding());
  },
  async getHomeData(): Promise<HomeData> {
    if (isMockMode()) return Promise.resolve(store.getHomeData());
    return Promise.resolve(store.getHomeData());
  },
  async listPets(): Promise<PetProfile[]> {
    if (isMockMode()) return Promise.resolve(store.listPets());
    return Promise.resolve(store.listPets());
  },
  async setCurrentPet(petId: string): Promise<void> {
    store.setCurrentPet(petId);
    return Promise.resolve();
  },
  async getPetDetail(petId: string): Promise<PetDetailData> {
    if (isMockMode()) return Promise.resolve(store.getPetDetail(petId));
    return Promise.resolve(store.getPetDetail(petId));
  },
  async savePet(draft: PetDraft): Promise<PetProfile> {
    if (isMockMode()) return Promise.resolve(store.savePet(draft));
    return Promise.resolve(store.savePet(draft));
  },
  async listRecords(filter?: { petId?: string; type?: string }): Promise<PetRecord[]> {
    if (isMockMode()) return Promise.resolve(store.listRecords(filter));
    return Promise.resolve(store.listRecords(filter));
  },
  async saveRecord(draft: RecordDraft): Promise<PetRecord> {
    if (isMockMode()) return Promise.resolve(store.saveRecord(draft));
    return Promise.resolve(store.saveRecord(draft));
  },
  async listFamilyMembers(): Promise<FamilyMember[]> {
    if (isMockMode()) return Promise.resolve(store.listFamilyMembers());
    return Promise.resolve(store.listFamilyMembers());
  },
  async getReminderSettings(): Promise<ReminderSettings> {
    if (isMockMode()) return Promise.resolve(store.getReminderSettings());
    return Promise.resolve(store.getReminderSettings());
  },
  async saveReminderSettings(next: ReminderSettings): Promise<ReminderSettings> {
    if (isMockMode()) return Promise.resolve(store.saveReminderSettings(next));
    return Promise.resolve(store.saveReminderSettings(next));
  },
  async getInviteData(): Promise<{
    familyName: string;
    inviteCode: string;
    expiresHint: string;
    memberCount: number;
  }> {
    if (isMockMode()) return Promise.resolve(store.getInviteData());
    return Promise.resolve(store.getInviteData());
  }
};
