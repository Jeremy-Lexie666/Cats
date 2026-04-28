import { api } from "../../../services/api";

Page({
  data: {
    vaccineEnabled: true,
    dewormEnabled: true,
    leadDays: 3,
    leadDayOptions: [1, 3, 7]
  },
  async onShow() {
    const settings = await api.getReminderSettings();
    this.setData(settings);
  },
  async handleSwitch(event: WechatMiniprogram.SwitchChange) {
    const field = event.currentTarget.dataset.field as string;
    const next = { ...this.data, [field]: event.detail.value };
    await api.saveReminderSettings({
      vaccineEnabled: next.vaccineEnabled,
      dewormEnabled: next.dewormEnabled,
      leadDays: next.leadDays
    });
    this.setData({ [field]: event.detail.value });
  },
  async selectLeadDay(event: WechatMiniprogram.TouchEvent) {
    const leadDays = Number(event.currentTarget.dataset.days);
    await api.saveReminderSettings({
      vaccineEnabled: this.data.vaccineEnabled,
      dewormEnabled: this.data.dewormEnabled,
      leadDays
    });
    this.setData({ leadDays });
  }
});
