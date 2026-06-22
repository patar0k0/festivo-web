import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { postFestivalLinkToPage } from "./postToPage";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  process.env.FB_PAGE_ID = "12345";
  process.env.FB_PAGE_ACCESS_TOKEN = "TOKEN";
  delete process.env.FB_GRAPH_VERSION;
});

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("postFestivalLinkToPage", () => {
  it("POSTs message+link+token to /{pageId}/feed and returns the post id", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ id: "12345_67890" }) } as Response;
    };

    const out = await postFestivalLinkToPage(
      { message: "Здравей", link: "https://festivo.bg/festivals/test" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(out.postId).toBe("12345_67890");
    expect(calls[0].url).toBe("https://graph.facebook.com/v21.0/12345/feed");
    expect(calls[0].body).toEqual({
      message: "Здравей",
      link: "https://festivo.bg/festivals/test",
      access_token: "TOKEN",
    });
  });

  it("honours FB_GRAPH_VERSION override", async () => {
    process.env.FB_GRAPH_VERSION = "v20.0";
    let seenUrl = "";
    const fetchImpl = async (url: string) => {
      seenUrl = url;
      return { ok: true, status: 200, json: async () => ({ id: "x" }) } as Response;
    };
    await postFestivalLinkToPage(
      { message: "m", link: "https://festivo.bg/festivals/x" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(seenUrl).toBe("https://graph.facebook.com/v20.0/12345/feed");
  });

  it("throws with the Graph error message on a non-OK response", async () => {
    const fetchImpl = async () =>
      ({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "Invalid token" } }),
      }) as Response;

    await expect(
      postFestivalLinkToPage(
        { message: "m", link: "https://festivo.bg/festivals/x" },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).rejects.toThrow(/Invalid token/);
  });

  it("throws when env is not configured", async () => {
    delete process.env.FB_PAGE_ID;
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response;
    await expect(
      postFestivalLinkToPage(
        { message: "m", link: "https://festivo.bg/festivals/x" },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).rejects.toThrow(/FB_PAGE_ID/);
  });
});
