Component({
  data: {
    selected: "home",
    tabs: [
      {
        key: "home",
        label: "首页",
        path: "/pages/home/index",
        activeIcon: "/assets/icons/tab-home-active.svg",
        inactiveIcon: "/assets/icons/tab-home.svg"
      },
      {
        key: "pets",
        label: "猫猫档案",
        path: "/pages/pets/index",
        activeIcon: "/assets/icons/tab-heart-active.svg",
        inactiveIcon: "/assets/icons/tab-heart.svg"
      },
      {
        key: "mine",
        label: "我的",
        path: "/pages/mine/index",
        activeIcon: "/assets/icons/tab-user-active.svg",
        inactiveIcon: "/assets/icons/tab-user.svg"
      }
    ]
  },
  methods: {
    switchTab(event: WechatMiniprogram.TouchEvent) {
      const { key, path } = event.currentTarget.dataset as { key: string; path: string };
      if (!path || this.data.selected === key) {
        return;
      }
      wx.switchTab({ url: path });
    }
  }
});
