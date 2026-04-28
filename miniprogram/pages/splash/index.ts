import { api } from "../../services/api";

Page({
  data: {
    loading: false
  },
  async onShow() {
    const auth = await api.getAuthState();
    if (auth.isLoggedIn) {
      if (!auth.hasCompletedOnboarding) {
        wx.redirectTo({ url: "/pages/onboarding/pet/index" });
        return;
      }
      wx.switchTab({ url: "/pages/home/index" });
    }
  },
  async handleLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    await api.loginWithWechat();
    wx.showToast({ title: "登录成功", icon: "success" });
    wx.redirectTo({ url: "/pages/onboarding/pet/index" });
  },
  openAgreement() {
    wx.showToast({ title: "协议内容后续补充", icon: "none" });
  },
  openPrivacy() {
    wx.showToast({ title: "隐私政策后续补充", icon: "none" });
  }
});
