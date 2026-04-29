import { api } from "../../services/api";
import { formatPetAge } from "../../utils/pet";
import { syncTabBar } from "../../utils/tabbar";

type ReminderRow = { id: string; label: string; dueText: string };

function getHomeStatus(reminderItems: ReminderRow[]): string {
  const first = reminderItems[0];
  if (!first) {
    return "今天也要记得记录";
  }
  if (first.label.includes("驱虫")) {
    return "记得按时驱虫";
  }
  if (first.label.includes("疫苗")) {
    return "记得按时接种";
  }
  return "今天也要记得记录";
}

function getGenderBadge(gender: "male" | "female" | "unknown"): { text: string; className: string } {
  if (gender === "female") {
    return { text: "♀", className: "female" };
  }
  if (gender === "male") {
    return { text: "♂", className: "male" };
  }
  return { text: "", className: "unknown" };
}

Page({
  data: {
    currentPetId: "",
    petName: "",
    petAge: "",
    petGenderText: "",
    petGenderClass: "",
    petNote: "",
    reminderItems: [] as ReminderRow[],
    reminderCountText: "0条",
    latestWeightValue: "--",
    weightTrendText: "稳定",
    weightTrendClass: "",
    loading: true
  },
  async onShow() {
    syncTabBar(this, "home");
    const auth = await api.getAuthState();
    if (!auth.isLoggedIn) {
      wx.redirectTo({ url: "/pages/splash/index" });
      return;
    }
    if (!auth.hasCompletedOnboarding) {
      wx.redirectTo({ url: "/pages/onboarding/pet/index" });
      return;
    }
    await this.refresh();
  },
  async refresh() {
    const home = await api.getHomeData();
    if (!home.currentPet) {
      this.setData({
        currentPetId: "",
        petName: "还没有小猫",
        petAge: "先完成建档",
        petGenderText: "",
        petGenderClass: "",
        petNote: "先添加第一只小猫",
        reminderItems: [
          { id: "placeholder_vaccine", label: "疫苗接种", dueText: "待补充" },
          { id: "placeholder_deworm", label: "体内驱虫", dueText: "待补充" }
        ],
        reminderCountText: "0条",
        latestWeightValue: "--",
        weightTrendText: "稳定",
        weightTrendClass: "",
        loading: false
      });
      return;
    }

    const currentPetId = home.currentPet.id;
    const reminderItems = (home.reminderItems || []) as ReminderRow[];
    const trend = home.weightTrend || { text: "稳定", className: "" };
    const genderBadge = getGenderBadge(home.currentPet.gender);

    this.setData({
      currentPetId,
      petName: home.currentPet.name,
      petAge: formatPetAge(home.currentPet.birthday),
      petGenderText: genderBadge.text,
      petGenderClass: genderBadge.className,
      petNote: getHomeStatus(reminderItems),
      reminderItems,
      reminderCountText: `${reminderItems.length}条`,
      latestWeightValue: home.latestWeight ? home.latestWeight.weightKg.toFixed(1) : "--",
      weightTrendText: trend.text,
      weightTrendClass: trend.className,
      loading: false
    });
  },
  async ensureCurrentPet(actionText: string): Promise<boolean> {
    if (this.data.currentPetId) {
      return true;
    }

    const auth = await api.getAuthState();
    const pets = await api.listPets();
    const petId = auth.currentPetId || pets[0]?.id || "";
    const petName = pets.find((item) => item.id === petId)?.name || pets[0]?.name || "";

    if (petId) {
      this.setData({
        currentPetId: petId,
        ...(petName ? { petName } : {})
      });
      return true;
    }

    wx.showToast({ title: `请先完成猫咪建档后再${actionText}`, icon: "none" });
    return false;
  },
  async openRecords() {
    if (!(await this.ensureCurrentPet("查看记录"))) return;
    wx.navigateTo({ url: `/pages/records/index?petId=${this.data.currentPetId}` });
  },
  openPets() {
    wx.switchTab({ url: "/pages/pets/index" });
  },
  async openWeight() {
    if (!(await this.ensureCurrentPet("查看体重"))) return;
    wx.navigateTo({ url: `/pages/weights/index?petId=${this.data.currentPetId}` });
  },
  async addRecord() {
    if (!(await this.ensureCurrentPet("新增健康记录"))) return;
    wx.navigateTo({ url: `/pages/records/edit/index?petId=${this.data.currentPetId}&mode=healthOnly&type=vaccine` });
  }
});
