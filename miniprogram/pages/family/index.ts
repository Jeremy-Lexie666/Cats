import { api } from "../../services/api";

Page({
  data: {
    members: [] as Array<{ id: string; name: string; role: string; joinedAt: string }>
  },
  async onShow() {
    const members = await api.listFamilyMembers();
    this.setData({
      members: members.map((item) => ({
        id: item.id,
        name: item.displayName,
        avatarText: item.displayName.slice(0, 1),
        role: item.role === "owner" ? "管理员" : "成员",
        joinedAt: item.joinedAt
      }))
    });
  },
  openInvite() {
    wx.navigateTo({ url: "/pages/invite/index" });
  }
});
