export function syncTabBar(page: WechatMiniprogram.Page.Instance<any, any>, selected: string) {
  const tabBar = page.getTabBar?.() as { setData?: (data: Record<string, unknown>) => void } | undefined;
  tabBar?.setData?.({ selected });
}
