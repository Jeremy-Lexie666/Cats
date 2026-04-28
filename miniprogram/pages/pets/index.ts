import { api } from "../../services/api";
import { formatPetAge } from "../../utils/pet";
import { syncTabBar } from "../../utils/tabbar";

Page({
  data: {
    petId: "",
    petName: "",
    breed: "",
    age: "",
    avatarText: ""
  },
  async onShow() {
    syncTabBar(this, "pets");
    const pets = await api.listPets();
    const pet = pets[0];
    if (!pet) return;
    this.setData({
      petId: pet.id,
      petName: pet.name,
      breed: pet.breed,
      age: formatPetAge(pet.birthday),
      avatarText: pet.avatarText
    });
  },
  openDetail() {
    wx.navigateTo({ url: `/pages/pets/detail/index?id=${this.data.petId}` });
  },
  openEdit() {
    wx.navigateTo({ url: `/pages/pets/edit/index?id=${this.data.petId}` });
  }
});
