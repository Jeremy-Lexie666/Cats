import { api } from "../../services/api";
import type { PetRecord } from "../../types/domain";
import { formatPetAge, getDaysLeft } from "../../utils/pet";
import { syncTabBar } from "../../utils/tabbar";

type ReminderRow = { id: string; label: string; dueText: string };
type WeightTrendView = { text: string; className: string };

function buildReminderRows(records: PetRecord[]): ReminderRow[] {
  const rows = records
    .filter((item): item is Extract<PetRecord, { type: "vaccine" | "deworm" }> => item.type === "vaccine" || item.type === "deworm")
    .filter((item) => Boolean(item.nextDueAt))
    .map((item) => {
      const daysLeft = getDaysLeft(item.nextDueAt);
      return {
        id: item.id,
        label: item.type === "vaccine" ? "疫苗接种" : `${item.mode === "internal" ? "体内" : "体外"}驱虫`,
        dueText: daysLeft <= 0 ? "今天" : `${daysLeft}天后`,
        daysLeft
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 2);

  if (rows.length >= 2) {
    return rows.map(({ id, label, dueText }) => ({ id, label, dueText }));
  }

  return [
    ...rows.map(({ id, label, dueText }) => ({ id, label, dueText })),
    { id: "placeholder_vaccine", label: "疫苗接种", dueText: "待补充" },
    { id: "placeholder_deworm", label: "体内驱虫", dueText: "待补充" }
  ].slice(0, 2);
}

function getWeightTrend(records: PetRecord[]): WeightTrendView {
  const weights = records
    .filter((item): item is Extract<PetRecord, { type: "weight" }> => item.type === "weight")
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  if (weights.length >= 2) {
    const delta = Number((weights[0].weightKg - weights[1].weightKg).toFixed(1));
    if (delta === 0) {
      return { text: "持平", className: "" };
    }
    return {
      text: `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(1)} kg`,
      className: delta > 0 ? "up" : "down"
    };
  }

  const note = weights[0]?.note || "";
  const matched = note.match(/([+-]?\d+(?:\.\d+)?)kg/i);
  if (matched) {
    const value = Number(matched[1]);
    return {
      text: `${value >= 0 ? "↑" : "↓"} ${Math.abs(value).toFixed(1)} kg`,
      className: value >= 0 ? "up" : "down"
    };
  }

  return { text: "稳定", className: "" };
}

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

Page({
  data: {
    currentPetId: "",
    petName: "",
    petAge: "",
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
    const currentPetRecords = await api.listRecords({ petId: currentPetId });
    const reminderItems = buildReminderRows(currentPetRecords);
    const trend = getWeightTrend(currentPetRecords);

    this.setData({
      currentPetId,
      petName: home.currentPet.name,
      petAge: formatPetAge(home.currentPet.birthday),
      petNote: getHomeStatus(reminderItems),
      reminderItems,
      reminderCountText: `${reminderItems.length}条`,
      latestWeightValue: home.latestWeight ? home.latestWeight.weightKg.toFixed(1) : "--",
      weightTrendText: trend.text,
      weightTrendClass: trend.className,
      loading: false
    });
  },
  openRecords() {
    if (!this.data.currentPetId) return;
    wx.navigateTo({ url: `/pages/records/index?petId=${this.data.currentPetId}` });
  },
  openPets() {
    wx.switchTab({ url: "/pages/pets/index" });
  },
  openWeight() {
    if (!this.data.currentPetId) return;
    wx.navigateTo({ url: `/pages/weights/index?petId=${this.data.currentPetId}` });
  },
  addRecord() {
    if (!this.data.currentPetId) return;
    wx.navigateTo({ url: `/pages/records/edit/index?petId=${this.data.currentPetId}&mode=healthOnly&type=vaccine` });
  }
});
