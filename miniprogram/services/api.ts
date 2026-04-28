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

function getAppConfig() {
  const app = getApp<IAppOption>();
  return app.globalData;
}

function isMockMode(): boolean {
  return getAppConfig().useMock;
}

function getBackendBaseUrl(): string {
  return getAppConfig().backendBaseUrl.replace(/\/$/, "");
}

function request<T>(
  method: "GET" | "POST",
  path: string,
  data?: Record<string, unknown> | RecordDraft | PetDraft | ReminderSettings
): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getBackendBaseUrl()}${path}`,
      method,
      data,
      header: {
        "content-type": "application/json"
      },
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T);
          return;
        }
        const message =
          typeof response.data === "object" && response.data && "message" in response.data
            ? String((response.data as { message?: string }).message || "请求失败")
            : "请求失败";
        reject(new Error(message));
      },
      fail: (error) => {
        reject(new Error(error.errMsg || "网络请求失败"));
      }
    });
  });
}

export const api = {
  async getAuthState(): Promise<AuthState> {
    if (isMockMode()) return Promise.resolve(store.getAuthState());
    return request<AuthState>("GET", "/auth/state");
  },
  async loginWithWechat(code?: string): Promise<AuthState> {
    if (isMockMode()) return Promise.resolve(store.loginWithWechat());
    return request<AuthState>("POST", "/auth/login/wechat", {
      code: code || "",
      source: "miniprogram"
    });
  },
  async logout(): Promise<AuthState> {
    if (isMockMode()) return Promise.resolve(store.logout());
    return request<AuthState>("POST", "/auth/logout");
  },
  async completeOnboarding(): Promise<AuthState> {
    if (isMockMode()) return Promise.resolve(store.completeOnboarding());
    return request<AuthState>("POST", "/auth/complete-onboarding");
  },
  async getHomeData(): Promise<HomeData> {
    if (isMockMode()) return Promise.resolve(store.getHomeData());
    return request<HomeData>("GET", "/home");
  },
  async listPets(): Promise<PetProfile[]> {
    if (isMockMode()) return Promise.resolve(store.listPets());
    return request<PetProfile[]>("GET", "/pets");
  },
  async setCurrentPet(petId: string): Promise<void> {
    if (isMockMode()) {
      store.setCurrentPet(petId);
      return Promise.resolve();
    }
    return request<void>("POST", "/pets/current", { petId });
  },
  async getPetDetail(petId: string): Promise<PetDetailData> {
    if (isMockMode()) return Promise.resolve(store.getPetDetail(petId));
    return request<PetDetailData>("GET", `/pets/${petId}`);
  },
  async savePet(draft: PetDraft): Promise<PetProfile> {
    if (isMockMode()) return Promise.resolve(store.savePet(draft));
    return request<PetProfile>("POST", "/pets", draft);
  },
  async listRecords(filter?: { petId?: string; type?: string }): Promise<PetRecord[]> {
    if (isMockMode()) return Promise.resolve(store.listRecords(filter));
    return request<PetRecord[]>("GET", "/records", filter || {});
  },
  async getRecord(recordId: string): Promise<PetRecord | undefined> {
    if (isMockMode()) return Promise.resolve(store.getRecord(recordId));
    return request<PetRecord | undefined>("GET", `/records/${recordId}`);
  },
  async saveRecord(draft: RecordDraft): Promise<PetRecord> {
    if (isMockMode()) return Promise.resolve(store.saveRecord(draft));
    return request<PetRecord>("POST", "/records", draft);
  },
  async updateRecord(recordId: string, draft: RecordDraft): Promise<PetRecord> {
    if (isMockMode()) return Promise.resolve(store.saveRecord({ ...draft, id: recordId }));
    return request<PetRecord>("POST", `/records/${recordId}`, draft);
  },
  async deleteRecord(recordId: string): Promise<void> {
    if (isMockMode()) {
      store.deleteRecord(recordId);
      return Promise.resolve();
    }
    return request<void>("POST", `/records/${recordId}/delete`);
  },
  async listFamilyMembers(): Promise<FamilyMember[]> {
    if (isMockMode()) return Promise.resolve(store.listFamilyMembers());
    return request<FamilyMember[]>("GET", "/family-members");
  },
  async getReminderSettings(): Promise<ReminderSettings> {
    if (isMockMode()) return Promise.resolve(store.getReminderSettings());
    return request<ReminderSettings>("GET", "/reminder-settings");
  },
  async saveReminderSettings(next: ReminderSettings): Promise<ReminderSettings> {
    if (isMockMode()) return Promise.resolve(store.saveReminderSettings(next));
    return request<ReminderSettings>("POST", "/reminder-settings", next);
  },
  async getInviteData(): Promise<{
    familyName: string;
    inviteCode: string;
    expiresHint: string;
    memberCount: number;
  }> {
    if (isMockMode()) return Promise.resolve(store.getInviteData());
    return request<{
      familyName: string;
      inviteCode: string;
      expiresHint: string;
      memberCount: number;
    }>("GET", "/invite");
  },
  async joinFamilyInvite(code: string, displayName: string): Promise<{
    ok: boolean;
    memberId: string;
    memberCount: number;
  }> {
    if (isMockMode()) {
      return Promise.resolve({
        ok: true,
        memberId: `mock_${Date.now()}`,
        memberCount: store.listFamilyMembers().length
      });
    }
    return request<{
      ok: boolean;
      memberId: string;
      memberCount: number;
    }>("POST", "/invite/join", { code, displayName });
  }
};
