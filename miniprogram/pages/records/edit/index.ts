import { api } from "../../../services/api";

function getToday() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

Page({
  data: {
    petId: "",
    selectedType: "vaccine",
    pets: [] as Array<{ id: string; name: string }>,
    petIndex: 0,
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
    const pets = await api.listPets();
    const petId = options.petId || auth.currentPetId;
    const petIndex = Math.max(
      pets.findIndex((item) => item.id === petId),
      0
    );
    this.setData({
      petId,
      selectedType: options.type || "vaccine",
      pets: pets.map((item) => ({ id: item.id, name: item.name })),
      petIndex
    });
  },
  backHome() {
    wx.switchTab({ url: "/pages/home/index" });
  },
  switchType(event: WechatMiniprogram.TouchEvent) {
    this.setData({ selectedType: event.currentTarget.dataset.type as string });
  },
  handlePetChipTap(event: WechatMiniprogram.TouchEvent) {
    const petIndex = Number(event.currentTarget.dataset.index);
    this.setData({
      petIndex,
      petId: this.data.pets[petIndex].id
    });
  },
  handlePetChange(event: WechatMiniprogram.PickerChange) {
    const petIndex = Number(event.detail.value);
    this.setData({
      petIndex,
      petId: this.data.pets[petIndex].id
    });
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

    await api.saveRecord({
      petId: this.data.petId,
      type: this.data.selectedType as "vaccine" | "deworm" | "weight",
      vaccineName: this.data.vaccineName,
      vaccinatedAt: this.data.vaccinatedAt,
      nextDueAt: this.data.nextDueAt,
      mode: this.data.modeIndex === 0 ? "internal" : "external",
      brand: this.data.brand,
      executedAt: this.data.executedAt,
      weightKg: Number(this.data.weightKg),
      recordedAt: this.data.recordedAt,
      note: this.data.note
    });
    wx.showToast({ title: "记录已保存", icon: "success" });
    setTimeout(() => wx.navigateBack({ delta: 1 }), 300);
  }
});
