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
    try {
      const loginResult = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        });
      });

      await api.loginWithWechat(loginResult.code);
      wx.showToast({ title: "登录成功", icon: "success" });
      wx.redirectTo({ url: "/pages/onboarding/pet/index" });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "微信登录失败",
        icon: "none"
      });
    } finally {
      this.setData({ loading: false });
    }
  },
  openAgreement() {
    wx.showToast({ title: "协议内容后续补充", icon: "none" });
  },
  openPrivacy() {
    wx.showToast({ title: "隐私政策后续补充", icon: "none" });
  }
});
