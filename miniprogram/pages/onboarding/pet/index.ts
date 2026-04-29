import { api } from "../../../services/api";
import { formatPetAge } from "../../../utils/pet";

Page({
  data: {
    step: 0,
    petId: "",
    name: "",
    birthday: "",
    breed: "",
    ageText: "年龄待补充",
    finishLoading: false,
    statusBarHeight: 28,
    topHeaderGap: 18
  },
  async onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 28,
      topHeaderGap: 18
    });

    const auth = await api.getAuthState();
    if (!auth.isLoggedIn) {
      wx.redirectTo({ url: "/pages/splash/index" });
      return;
    }
    this.setData({
      petId: auth.currentPetId || "",
      name: "",
      birthday: "",
      breed: "",
      ageText: "年龄待补充"
    });
  },
  handleInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field as "name" | "breed";
    const value = event.detail.value;
    this.setData({ [field]: value });
  },
  handleBirthdayChange(event: WechatMiniprogram.PickerChange) {
    const birthday = String(event.detail.value || "");
    this.setData({
      birthday,
      ageText: birthday ? formatPetAge(birthday) : "年龄待补充"
    });
  },
  nextStep() {
    if (this.data.step === 0 && !this.data.name.trim()) {
      wx.showToast({ title: "先给 ta 起个名字吧", icon: "none" });
      return;
    }
    if (this.data.step === 1 && !this.data.birthday) {
      wx.showToast({ title: "请先填写生日", icon: "none" });
      return;
    }
    this.setData({ step: Math.min(this.data.step + 1, 2) });
  },
  prevStep() {
    this.setData({ step: Math.max(this.data.step - 1, 0) });
  },
  async skipFlow() {
    await api.completeOnboarding();
    wx.switchTab({ url: "/pages/home/index" });
  },
  uploadPhoto() {
    wx.showToast({ title: "上传能力后续接入", icon: "none" });
  },
  generateAvatar() {
    wx.showToast({ title: "AI 形象能力即将开放", icon: "none" });
  },
  async finishFlow() {
    if (this.data.finishLoading) return;
    if (!this.data.birthday) {
      wx.showToast({ title: "请先填写生日", icon: "none" });
      return;
    }
    this.setData({ finishLoading: true });
    try {
      await api.savePet({
        id: this.data.petId || undefined,
        name: this.data.name.trim(),
        birthday: this.data.birthday,
        breed: this.data.breed.trim() || "品种待补充",
        note: "先从记录陪伴开始吧",
        avatarText: this.data.name.trim().slice(0, 1),
        gender: "unknown",
        isNeutered: false
      });
      wx.showToast({ title: "已完成", icon: "success" });
      setTimeout(() => {
        wx.switchTab({ url: "/pages/home/index" });
      }, 250);
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "提交失败，请重试",
        icon: "none"
      });
    } finally {
      this.setData({ finishLoading: false });
    }
  }
});
