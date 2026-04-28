import { api } from "../../services/api";

Page({
  data: {
    familyName: "",
    inviteCode: "",
    expiresHint: "",
    memberCount: 0,
    inviteMode: "host",
    joinDisplayName: "",
    joinLoading: false
  },
  async onLoad(options: Record<string, string>) {
    const inviteMode = options.code ? "guest" : "host";
    this.setData({
      inviteMode,
      inviteCode: options.code || ""
    });
  },
  async onShow() {
    const invite = await api.getInviteData();
    this.setData({
      familyName: invite.familyName,
      expiresHint: invite.expiresHint,
      memberCount: invite.memberCount,
      inviteCode: this.data.inviteCode || invite.inviteCode
    });
  },
  handleNameInput(event: WechatMiniprogram.Input) {
    this.setData({ joinDisplayName: event.detail.value });
  },
  copyCode() {
    wx.setClipboardData({
      data: this.data.inviteCode
    });
  },
  async joinFamily() {
    if (this.data.joinLoading) return;
    this.setData({ joinLoading: true });
    try {
      await api.joinFamilyInvite(this.data.inviteCode, this.data.joinDisplayName.trim());
      wx.showToast({ title: "加入成功", icon: "success" });
      setTimeout(() => {
        wx.redirectTo({ url: "/pages/family/index" });
      }, 280);
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "加入失败",
        icon: "none"
      });
    } finally {
      this.setData({ joinLoading: false });
    }
  },
  onShareAppMessage() {
    return {
      title: `邀请你加入 ${this.data.familyName}`,
      path: `/pages/invite/index?code=${this.data.inviteCode}`
    };
  }
});
