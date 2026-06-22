export type PostToPageInput = {
  /** Caption text shown above the link preview card. */
  message: string;
  /** Canonical festival URL — Facebook renders the OG preview from it. */
  link: string;
};

export type PostToPageDeps = {
  fetchImpl?: typeof fetch;
};

export type PostToPageResult = {
  postId: string;
};

/**
 * Publish a link post to the Festivo Facebook Page via the Graph API.
 * Mirrors the env-based token approach used by the festivo-workers
 * weekend-post publisher, but for a /feed link post (no image upload).
 */
export async function postFestivalLinkToPage(
  { message, link }: PostToPageInput,
  deps: PostToPageDeps = {},
): Promise<PostToPageResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const version = process.env.FB_GRAPH_VERSION?.trim() || "v21.0";
  const pageId = process.env.FB_PAGE_ID?.trim();
  const token = process.env.FB_PAGE_ACCESS_TOKEN?.trim();

  if (!pageId || !token) {
    throw new Error("FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN not configured");
  }

  const endpoint = `https://graph.facebook.com/${version}/${pageId}/feed`;
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, link, access_token: token }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`facebook publish failed: ${msg}`);
  }

  return { postId: json.id ?? "" };
}
