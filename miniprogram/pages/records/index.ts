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
    recordItems: [] as Array<{ id: string; title: string; desc: string; date: string }>
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
  createRecord() {
    wx.navigateTo({ url: `/pages/records/edit/index?petId=${this.data.currentPetId}` });
  }
});
