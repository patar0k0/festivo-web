export function festivalDeepLink(slug: string) {
  return `festivo://festival/${slug}`;
}

export function storeLinks() {
  return {
    appStore: process.env.NEXT_PUBLIC_APP_STORE_URL ?? "https://example.com/app-store",
    playStore: process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "https://example.com/play-store",
  };
}
