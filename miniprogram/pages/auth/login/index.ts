import { api } from "../../../services/api";

Page({
  async onShow() {
    const auth = await api.getAuthState();
    if (auth.isLoggedIn) {
      if (!auth.hasCompletedOnboarding) {
        wx.redirectTo({ url: "/pages/onboarding/pet/index" });
        return;
      }
      wx.switchTab({ url: "/pages/home/index" });
      return;
    }
    wx.redirectTo({ url: "/pages/splash/index" });
  }
});
