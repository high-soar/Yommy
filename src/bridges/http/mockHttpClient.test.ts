import { describe, it, expect, beforeEach } from "vitest";
import { MockHttpClient } from "./mockHttpClient";
import type { HttpRequestOptions } from "./types";

describe("MockHttpClient", () => {
  let client: MockHttpClient;

  beforeEach(() => {
    client = new MockHttpClient();
  });

  describe("setResponse と getHtml の正常系", () => {
    it("文字列 URL に完全一致する場合に登録したレスポンスを返却すること", async () => {
      client.setResponse("https://example.com/novel/1", {
        status: 200,
        url: "https://example.com/novel/1",
        html: "<h1>タイトル</h1>",
        headers: { "content-type": "text/html" },
      });

      const res = await client.getHtml({ url: "https://example.com/novel/1" });

      expect(res.status).toBe(200);
      expect(res.url).toBe("https://example.com/novel/1");
      expect(res.html).toBe("<h1>タイトル</h1>");
      expect(res.headers).toEqual({ "content-type": "text/html" });
    });

    it("RegExp パターンにマッチする場合に登録したレスポンスを返却すること", async () => {
      client.setResponse(/^https:\/\/example\.com\/works\/\d+$/, {
        html: "<p>作品目次</p>",
      });

      const res = await client.getHtml({
        url: "https://example.com/works/12345",
      });

      expect(res.status).toBe(200);
      expect(res.url).toBe("https://example.com/works/12345");
      expect(res.html).toBe("<p>作品目次</p>");
      expect(res.headers).toEqual({});
    });

    it("関数ハンドラーが指定された場合、リクエスト引数を参照して動的にレスポンスを生成できること", async () => {
      client.setResponse(
        "https://example.com/dynamic",
        (options: HttpRequestOptions) => {
          return {
            status: 200,
            url: options.url,
            html: `<p>Requested with ${options.headers?.["x-custom-token"]}</p>`,
            headers: { "x-response-token": "ok" },
          };
        },
      );

      const res = await client.getHtml({
        url: "https://example.com/dynamic",
        headers: { "x-custom-token": "secret123" },
      });

      expect(res.html).toBe("<p>Requested with secret123</p>");
      expect(res.headers).toEqual({ "x-response-token": "ok" });
    });

    it("非同期関数ハンドラーが指定された場合、Promise を解決してレスポンスを返却すること", async () => {
      client.setResponse("https://example.com/async", async (options) => {
        return {
          status: 200,
          url: options.url,
          html: "<span>非同期取得</span>",
          headers: {},
        };
      });

      const res = await client.getHtml({ url: "https://example.com/async" });

      expect(res.status).toBe(200);
      expect(res.html).toBe("<span>非同期取得</span>");
    });
  });

  describe("デフォルト値の補正", () => {
    it("レスポンスオブジェクトで一部プロパティが省略された場合にデフォルト値が適用されること", async () => {
      client.setResponse("https://example.com/partial", {
        html: "<p>部分指定</p>",
      });

      const res = await client.getHtml({ url: "https://example.com/partial" });

      expect(res.status).toBe(200);
      expect(res.url).toBe("https://example.com/partial");
      expect(res.html).toBe("<p>部分指定</p>");
      expect(res.headers).toEqual({});
    });

    it("レスポンスオブジェクトで html が省略された場合に空文字がデフォルト適用されること", async () => {
      client.setResponse("https://example.com/no-html", {
        status: 204,
      });

      const res = await client.getHtml({ url: "https://example.com/no-html" });

      expect(res.status).toBe(204);
      expect(res.html).toBe("");
    });

    it("カスタムステータスコードやリダイレクト後 URL が明示された場合は指定値が尊重されること", async () => {
      client.setResponse("https://example.com/redirect", {
        status: 302,
        url: "https://example.com/redirected-target",
        html: "",
      });

      const res = await client.getHtml({ url: "https://example.com/redirect" });

      expect(res.status).toBe(302);
      expect(res.url).toBe("https://example.com/redirected-target");
      expect(res.html).toBe("");
    });
  });

  describe("ハンドラー登録の上書きと複数登録", () => {
    it("同一文字列パターンで再度 setResponse を呼び出した場合にハンドラーが上書き更新されること", async () => {
      client.setResponse("https://example.com/overwrite", { html: "初版" });
      client.setResponse("https://example.com/overwrite", { html: "改訂版" });

      const res = await client.getHtml({
        url: "https://example.com/overwrite",
      });
      expect(res.html).toBe("改訂版");
    });

    it("同一 RegExp パターンで再度 setResponse を呼び出した場合にハンドラーが上書き更新されること", async () => {
      client.setResponse(/pattern-\d+/, { html: "初版" });
      client.setResponse(/pattern-\d+/, { html: "改訂版" });

      const res = await client.getHtml({
        url: "https://example.com/pattern-1",
      });
      expect(res.html).toBe("改訂版");
    });

    it("複数の異なるパターンが登録されている場合、合致したルールが適用されること", async () => {
      client.setResponse("https://example.com/first", { html: "first" });
      client.setResponse("https://example.com/second", { html: "second" });

      const res1 = await client.getHtml({ url: "https://example.com/first" });
      const res2 = await client.getHtml({ url: "https://example.com/second" });

      expect(res1.html).toBe("first");
      expect(res2.html).toBe("second");
    });
  });

  describe("エラー系とリセット機能", () => {
    it("未登録の URL を指定した場合は適切な未登録エラーを送出すること", async () => {
      await expect(
        client.getHtml({ url: "https://example.com/unregistered" }),
      ).rejects.toThrow(
        "[MockHttpClient] No mock response configured for URL: https://example.com/unregistered",
      );
    });

    it("reset を呼び出すとすべての登録ルールがクリアされ、直前までマッチしていた URL が未登録エラーになること", async () => {
      client.setResponse("https://example.com/target", { html: "active" });
      const beforeReset = await client.getHtml({
        url: "https://example.com/target",
      });
      expect(beforeReset.html).toBe("active");

      client.reset();

      await expect(
        client.getHtml({ url: "https://example.com/target" }),
      ).rejects.toThrow(
        "[MockHttpClient] No mock response configured for URL: https://example.com/target",
      );
    });

    it("呼び出し時点で signal.aborted が true の場合にリクエストが中断されること", async () => {
      client.setResponse("https://example.com/aborted", { html: "content" });
      const controller = new AbortController();
      controller.abort();

      await expect(
        client.getHtml({
          url: "https://example.com/aborted",
          signal: controller.signal,
        }),
      ).rejects.toThrow();
    });
  });
});
