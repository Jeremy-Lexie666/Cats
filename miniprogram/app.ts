App<IAppOption>({
  globalData: {
    useMock: true,
    cloudEnvId: "replace-with-your-cloud-env-id",
    backendBaseUrl: "http://127.0.0.1:8787/api"
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
