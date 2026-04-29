App<IAppOption>({
  globalData: {
    useMock: false,
    cloudEnvId: "replace-with-your-cloud-env-id",
    backendBaseUrl: "https://cat.4567l.com/api"
  },
  onLaunch() {
    const { cloudEnvId, useMock } = this.globalData;
    const shouldInitCloud = !useMock && Boolean(cloudEnvId) && cloudEnvId !== "replace-with-your-cloud-env-id";

    if (wx.cloud && shouldInitCloud) {
      wx.cloud.init({
        env: cloudEnvId,
        traceUser: true
      });
    }
  }
});
