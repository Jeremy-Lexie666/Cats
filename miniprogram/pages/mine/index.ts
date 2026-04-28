import { api } from "../../services/api";
import { syncTabBar } from "../../utils/tabbar";

Page({
  data: {
    nickname: "",
    avatarText: "",
    petCount: 0,
    memberCount: 0,
    logoutLoading: false
  },
  async onShow() {
    syncTabBar(this, "mine");
    const [auth, pets, members] = await Promise.all([api.getAuthState(), api.listPets(), api.listFamilyMembers()]);
    this.setData({
      nickname: auth.user.nickname,
      avatarText: auth.user.avatarText,
      petCount: pets.length,
      memberCount: members.length
    });
  },
  openFamily() {
    wx.navigateTo({ url: "/pages/family/index" });
  },
  openReminders() {
    wx.navigateTo({ url: "/pages/settings/reminders/index" });
  },
  openInvite() {
    wx.navigateTo({ url: "/pages/invite/index" });
  },
  async handleLogout() {
    if (this.data.logoutLoading) return;
    this.setData({ logoutLoading: true });
    await api.logout();
    wx.showToast({ title: "已退出登录", icon: "success" });
    wx.reLaunch({ url: "/pages/splash/index" });
  }
});
