import { api } from "../../services/api";
import { formatShortDate, getRecordSummary, getRecordTitle } from "../../utils/pet";
import { syncTabBar } from "../../utils/tabbar";

Page({
  data: {
    filterType: "all",
    petName: "",
    currentPetId: "",
    typeTabs: [
      { key: "all", label: "全部" },
      { key: "vaccine", label: "疫苗" },
      { key: "deworm", label: "驱虫" },
      { key: "weight", label: "体重" }
    ],
    recordItems: [] as Array<{ id: string; title: string; desc: string; date: string; type: string }>
  },
  async onShow() {
    syncTabBar(this, "records");
    const auth = await api.getAuthState();
    const pets = await api.listPets();
    const currentPet = pets.find((item) => item.id === auth.currentPetId) || pets[0];
    this.setData({
      currentPetId: currentPet?.id || "",
      petName: currentPet?.name || ""
    });
    await this.refresh();
  },
  async refresh() {
    const records = await api.listRecords({
      petId: this.data.currentPetId || undefined,
      type: this.data.filterType
    });
    this.setData({
      recordItems: records.map((item) => ({
        id: item.id,
        type: item.type,
        title: getRecordTitle(item),
        desc: getRecordSummary(item),
        date: formatShortDate(
          item.type === "vaccine" ? item.vaccinatedAt : item.type === "deworm" ? item.executedAt : item.recordedAt
        )
      }))
    });
  },
  async switchType(event: WechatMiniprogram.TouchEvent) {
    const type = event.currentTarget.dataset.type as string;
    this.setData({ filterType: type });
    await this.refresh();
  },
  async ensureCurrentPet(): Promise<string> {
    if (this.data.currentPetId) {
      return this.data.currentPetId;
    }
    const auth = await api.getAuthState();
    const pets = await api.listPets();
    const petId = auth.currentPetId || pets[0]?.id || "";
    if (petId) {
      this.setData({
        currentPetId: petId,
        petName: pets.find((item) => item.id === petId)?.name || pets[0]?.name || ""
      });
      return petId;
    }
    return "";
  },
  async createRecord() {
    const petId = await this.ensureCurrentPet();
    if (!petId) {
      wx.showToast({ title: "请先完成猫咪建档", icon: "none" });
      return;
    }
    const type = this.data.filterType === "all" ? "vaccine" : this.data.filterType;
    const mode = type === "weight" ? "weightOnly" : type === "deworm" || type === "vaccine" ? "healthOnly" : "all";
    wx.navigateTo({ url: `/pages/records/edit/index?petId=${petId}&type=${type}&mode=${mode}` });
  },
  editRecord(event: WechatMiniprogram.TouchEvent) {
    const { id, type } = event.currentTarget.dataset as { id?: string; type?: string };
    if (!id || !type) return;
    const mode = type === "weight" ? "weightOnly" : "healthOnly";
    wx.navigateTo({ url: `/pages/records/edit/index?petId=${this.data.currentPetId}&type=${type}&mode=${mode}&recordId=${id}` });
  },
  deleteRecord(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id?: string };
    if (!id) return;

    wx.showModal({
      title: "删除记录",
      content: "确认删除这条记录吗？",
      confirmColor: "#d47c86",
      success: async (result) => {
        if (!result.confirm) return;
        await api.deleteRecord(id);
        wx.showToast({ title: "已删除", icon: "success" });
        await this.refresh();
      }
    });
  }
});
