import { api } from "../../../services/api";

function getToday() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

Page({
  data: {
    recordId: "",
    petId: "",
    selectedType: "vaccine",
    pageMode: "all",
    typeTabs: [
      { key: "vaccine", label: "疫苗" },
      { key: "deworm", label: "驱虫" },
      { key: "weight", label: "体重" }
    ],
    vaccineName: "",
    vaccinatedAt: getToday(),
    nextDueAt: "",
    modeIndex: 0,
    brand: "",
    executedAt: getToday(),
    weightKg: "",
    recordedAt: getToday(),
    note: ""
  },
  async onLoad(options: Record<string, string>) {
    const auth = await api.getAuthState();
    const petId = options.petId || auth.currentPetId;
    const pageMode = options.mode || "all";
    const recordId = options.recordId || "";
    const selectedType =
      pageMode === "weightOnly" ? "weight" : options.type === "deworm" ? "deworm" : "vaccine";
    this.setData({
      recordId,
      petId,
      selectedType,
      pageMode
    });

    wx.setNavigationBarTitle({
      title: recordId ? "编辑记录" : "新增记录"
    });

    if (recordId) {
      const record = await api.getRecord(recordId);
      if (!record) {
        wx.showToast({ title: "记录不存在", icon: "none" });
        setTimeout(() => wx.navigateBack({ delta: 1 }), 300);
        return;
      }

      if (record.type === "vaccine") {
        this.setData({
          selectedType: "vaccine",
          vaccineName: record.vaccineName,
          vaccinatedAt: record.vaccinatedAt,
          nextDueAt: record.nextDueAt || "",
          note: record.note || ""
        });
      } else if (record.type === "deworm") {
        this.setData({
          selectedType: "deworm",
          modeIndex: record.mode === "internal" ? 0 : 1,
          brand: record.brand,
          executedAt: record.executedAt,
          nextDueAt: record.nextDueAt || "",
          note: record.note || ""
        });
      } else {
        this.setData({
          selectedType: "weight",
          weightKg: `${record.weightKg}`,
          recordedAt: record.recordedAt,
          note: record.note || ""
        });
      }
    }
  },
  switchType(event: WechatMiniprogram.TouchEvent) {
    this.setData({ selectedType: event.currentTarget.dataset.type as string });
  },
  handleInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field as string;
    this.setData({ [field]: event.detail.value });
  },
  handleModeChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ modeIndex: Number(event.detail.value) });
  },
  async saveRecord() {
    if (!this.data.petId) {
      wx.showToast({ title: "请先选择猫咪", icon: "none" });
      return;
    }

    if (this.data.selectedType === "vaccine" && !this.data.vaccineName) {
      wx.showToast({ title: "请填写疫苗名称", icon: "none" });
      return;
    }

    if (this.data.selectedType === "weight" && !this.data.weightKg) {
      wx.showToast({ title: "请填写体重", icon: "none" });
      return;
    }

    const draft = {
      id: this.data.recordId || undefined,
      petId: this.data.petId,
      type: this.data.selectedType as "vaccine" | "deworm" | "weight",
      vaccineName: this.data.vaccineName,
      vaccinatedAt: this.data.vaccinatedAt,
      nextDueAt: this.data.nextDueAt,
      mode: (this.data.modeIndex === 0 ? "internal" : "external") as "internal" | "external",
      brand: this.data.brand,
      executedAt: this.data.executedAt,
      weightKg: Number(this.data.weightKg),
      recordedAt: this.data.recordedAt,
      note: this.data.note
    };

    if (this.data.recordId) {
      await api.updateRecord(this.data.recordId, draft);
    } else {
      await api.saveRecord(draft);
    }

    wx.showToast({ title: this.data.recordId ? "记录已更新" : "记录已保存", icon: "success" });
    setTimeout(() => wx.navigateBack({ delta: 1 }), 300);
  }
});
