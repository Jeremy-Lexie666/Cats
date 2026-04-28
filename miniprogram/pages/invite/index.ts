import { api } from "../../services/api";

Page({
  data: {
    familyName: "",
    inviteCode: "",
    expiresHint: "",
    memberCount: 0
  },
  async onShow() {
    const invite = await api.getInviteData();
    this.setData(invite);
  },
  copyCode() {
    wx.setClipboardData({
      data: this.data.inviteCode
    });
  },
  onShareAppMessage() {
    return {
      title: `邀请你加入 ${this.data.familyName}`,
      path: `/pages/invite/index?code=${this.data.inviteCode}`
    };
  }
});
