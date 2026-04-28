import { api } from "../../../services/api";
import type { PetGender } from "../../../types/domain";

const genderOptions: Array<{ label: string; value: PetGender }> = [
  { label: "母猫", value: "female" },
  { label: "公猫", value: "male" },
  { label: "暂不填写", value: "unknown" }
];

Page({
  data: {
    petId: "",
    isEdit: false,
    name: "",
    birthday: "",
    breed: "",
    note: "",
    avatarText: "",
    genderIndex: 0,
    neuteredIndex: 1,
    genderOptions: genderOptions.map((item) => item.label),
    neuteredOptions: ["已绝育", "未绝育"]
  },
  async onLoad(options: Record<string, string>) {
    const petId = options.id || "";
    if (!petId) return;
    const detail = await api.getPetDetail(petId);
    this.setData({
      petId,
      isEdit: true,
      name: detail.pet.name,
      birthday: detail.pet.birthday,
      breed: detail.pet.breed,
      note: detail.pet.note || "",
      avatarText: detail.pet.avatarText,
      genderIndex: Math.max(
        genderOptions.findIndex((item) => item.value === detail.pet.gender),
        0
      ),
      neuteredIndex: detail.pet.isNeutered ? 0 : 1
    });
  },
  handleInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field as string;
    this.setData({ [field]: event.detail.value });
  },
  handleGenderChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ genderIndex: Number(event.detail.value) });
  },
  handleNeuteredChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ neuteredIndex: Number(event.detail.value) });
  },
  async savePet() {
    if (!this.data.name || !this.data.birthday || !this.data.breed) {
      wx.showToast({ title: "请先补齐基础信息", icon: "none" });
      return;
    }
    await api.savePet({
      id: this.data.petId || undefined,
      name: this.data.name,
      birthday: this.data.birthday,
      breed: this.data.breed,
      note: this.data.note,
      avatarText: this.data.avatarText || this.data.name.slice(0, 1),
      gender: genderOptions[this.data.genderIndex].value,
      isNeutered: this.data.neuteredIndex === 0
    });
    wx.showToast({ title: "已保存", icon: "success" });
    setTimeout(() => wx.navigateBack({ delta: 1 }), 300);
  }
});
