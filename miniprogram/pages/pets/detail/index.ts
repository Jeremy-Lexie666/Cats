import { api } from "../../../services/api";
import { formatPetAge, formatShortDate } from "../../../utils/pet";

Page({
  data: {
    petId: "",
    petName: "",
    petBreed: "",
    petAge: "",
    petAvatarText: "",
    petNote: "",
    latestWeight: "暂无",
    nextVaccine: "未设置",
    nextDeworm: "未设置",
    vaccines: [] as Array<{ title: string; desc: string }>,
    deworms: [] as Array<{ title: string; desc: string }>,
    weights: [] as Array<{ title: string; desc: string }>
  },
  onLoad(options: Record<string, string>) {
    this.setData({ petId: options.id || "" });
  },
  async onShow() {
    await this.refresh();
  },
  async refresh() {
    const detail = await api.getPetDetail(this.data.petId);
    const vaccines = detail.vaccines.slice(0, 3).map((item) => ({
      title: `${item.vaccineName} · ${formatShortDate(item.vaccinatedAt)}`,
      desc: item.nextDueAt ? `下次 ${formatShortDate(item.nextDueAt)}` : "未设置提醒"
    }));
    const deworms = detail.deworms.slice(0, 3).map((item) => ({
      title: `${item.mode === "internal" ? "体内" : "体外"}驱虫 · ${formatShortDate(item.executedAt)}`,
      desc: item.brand || "品牌待补充"
    }));
    const weights = detail.weights.slice(0, 3).map((item) => ({
      title: `${item.weightKg} kg`,
      desc: formatShortDate(item.recordedAt)
    }));

    this.setData({
      petName: detail.pet.name,
      petBreed: detail.pet.breed,
      petAge: formatPetAge(detail.pet.birthday),
      petAvatarText: detail.pet.avatarText,
      petNote: detail.pet.note || "这里会展示这只猫的基本信息和健康摘要。",
      latestWeight: detail.latestWeight ? `${detail.latestWeight.weightKg} kg` : "暂无",
      nextVaccine: detail.vaccines[0]?.nextDueAt ? formatShortDate(detail.vaccines[0].nextDueAt!) : "未设置",
      nextDeworm: detail.deworms[0]?.nextDueAt ? formatShortDate(detail.deworms[0].nextDueAt!) : "未设置",
      vaccines,
      deworms,
      weights
    });
  },
  editPet() {
    wx.navigateTo({ url: `/pages/pets/edit/index?id=${this.data.petId}` });
  },
  addRecord(event: WechatMiniprogram.TouchEvent) {
    const type = event.currentTarget.dataset.type as string;
    wx.navigateTo({ url: `/pages/records/edit/index?petId=${this.data.petId}&type=${type}` });
  }
});
