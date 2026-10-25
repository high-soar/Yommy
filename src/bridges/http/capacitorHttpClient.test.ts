import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CapacitorHttp,
  type HttpResponse as CapHttpResponse,
} from "@capacitor/core";
import { CapacitorHttpClient, HttpError } from "./capacitorHttpClient";

vi.mock("@capacitor/core", () => ({
  CapacitorHttp: {
    get: vi.fn(),
  },
}));

describe("CapacitorHttpClient", () => {
  let client: CapacitorHttpClient;

  beforeEach(() => {
    client = new CapacitorHttpClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系リクエストの送信とレスポンス解決", () => {
    it("指定されたオプション（URL、カスタムヘッダー、タイムアウト）を CapacitorHttp.get に正しく伝播すること", async () => {
      const getSpy = vi.spyOn(CapacitorHttp, "get").mockResolvedValueOnce({
        status: 200,
        url: "https://example.com/novel/1",
        data: "<html><body><h1>テスト小説</h1></body></html>",
        headers: { "content-type": "text/html; charset=utf-8" },
      });

      const res = await client.getHtml({
        url: "https://example.com/novel/1",
        headers: { "User-Agent": "Yommy/0.1.0" },
        timeoutMs: 5000,
      });

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith({
        url: "https://example.com/novel/1",
        headers: { "User-Agent": "Yommy/0.1.0" },
        connectTimeout: 5000,
        readTimeout: 5000,
        responseType: "text",
      });

      expect(res.status).toBe(200);
      expect(res.url).toBe("https://example.com/novel/1");
      expect(res.html).toBe("<html><body><h1>テスト小説</h1></body></html>");
      expect(res.headers).toEqual({
        "content-type": "text/html; charset=utf-8",
      });
    });

    it("ヘッダーやタイムアウトが未指定の場合に余計なプロパティを設定せずに通信すること", async () => {
      const getSpy = vi.spyOn(CapacitorHttp, "get").mockResolvedValueOnce({
        status: 200,
        url: "https://example.com/simple",
        data: "<p>シンプル</p>",
        headers: {},
      });

      const res = await client.getHtml({
        url: "https://example.com/simple",
      });

      expect(getSpy).toHaveBeenCalledWith({
        url: "https://example.com/simple",
        responseType: "text",
      });
      expect(res.status).toBe(200);
      expect(res.url).toBe("https://example.com/simple");
      expect(res.html).toBe("<p>シンプル</p>");
      expect(res.headers).toEqual({});
    });

    it("リダイレクト後の最終 URL が返された場合はその URL を採用すること", async () => {
      vi.spyOn(CapacitorHttp, "get").mockResolvedValueOnce({
        status: 200,
        url: "https://example.com/final-redirected-page",
        data: "<p>リダイレクト先</p>",
        headers: {},
      });

      const res = await client.getHtml({
        url: "https://example.com/initial-redirect",
      });

      expect(res.url).toBe("https://example.com/final-redirected-page");
    });

    it("レスポンスの url が空や未定義の場合はリクエスト URL をフォールバック利用すること", async () => {
      vi.spyOn(CapacitorHttp, "get").mockResolvedValueOnce({
        status: 200,
        url: "",
        data: "<p>URL未定義</p>",
        headers: {},
      });

      const res = await client.getHtml({
        url: "https://example.com/fallback-check",
      });

      expect(res.url).toBe("https://example.com/fallback-check");
    });

    it("レスポンスの headers が未定義の場合は空オブジェクトをフォールバック利用すること", async () => {
      vi.spyOn(CapacitorHttp, "get").mockResolvedValueOnce({
        status: 200,
        url: "https://example.com/no-headers",
        data: "<p>ヘッダーなし</p>",
      } as unknown as CapHttpResponse);

      const res = await client.getHtml({
        url: "https://example.com/no-headers",
      });

      expect(res.headers).toEqual({});
    });
  });

  describe("レスポンスデータのシリアライズ", () => {
    it("data が文字列の場合はそのまま html として返却すること", async () => {
      vi.spyOn(CapacitorHttp, "get").mockResolvedValueOnce({
        status: 200,
        url: "https://example.com/text",
        data: "plain string data",
        headers: {},
      });

      const res = await client.getHtml({ url: "https://example.com/text" });
      expect(res.html).toBe("plain string data");
    });

    it("data がオブジェクト（JSON解析済み等）の場合は JSON 文字列化して返却すること", async () => {
      vi.spyOn(CapacitorHttp, "get").mockResolvedValueOnce({
        status: 200,
        url: "https://example.com/json",
        data: { title: "小説", id: 123 },
        headers: { "content-type": "application/json" },
      });

      const res = await client.getHtml({ url: "https://example.com/json" });
      expect(res.html).toBe(JSON.stringify({ title: "小説", id: 123 }));
    });

    it("data が null または undefined の場合は空文字列を返却すること", async () => {
      vi.spyOn(CapacitorHttp, "get").mockResolvedValueOnce({
        status: 200,
        url: "https://example.com/null",
        data: null,
        headers: {},
      });

      const resNull = await client.getHtml({ url: "https://example.com/null" });
      expect(resNull.html).toBe("");

      vi.spyOn(CapacitorHttp, "get").mockResolvedValueOnce({
        status: 200,
        url: "https://example.com/undefined",
        data: undefined,
        headers: {},
      });

      const resUndefined = await client.getHtml({
        url: "https://example.com/undefined",
      });
      expect(resUndefined.html).toBe("");
    });

    it("data が数値や真偽値などのプリミティブの場合は文字列化して返却すること", async () => {
      vi.spyOn(CapacitorHttp, "get").mockResolvedValueOnce({
        status: 200,
        url: "https://example.com/primitive",
        data: 12345,
        headers: {},
      });

      const res = await client.getHtml({
        url: "https://example.com/primitive",
      });
      expect(res.html).toBe("12345");
    });
  });

  describe("AbortSignal によるキャンセル制御", () => {
    it("呼び出し時点で signal.aborted が true の場合、CapacitorHttp.get を呼ばずに中断エラーを送出すること", async () => {
      const getSpy = vi.spyOn(CapacitorHttp, "get");
      const controller = new AbortController();
      controller.abort(new DOMException("事前中断", "AbortError"));

      await expect(
        client.getHtml({
          url: "https://example.com/already-aborted",
          signal: controller.signal,
        }),
      ).rejects.toThrow("事前中断");

      expect(getSpy).not.toHaveBeenCalled();
    });

    it("通信待機中に signal が abort された場合、即座に処理が中断されること", async () => {
      const controller = new AbortController();

      vi.spyOn(CapacitorHttp, "get").mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              status: 200,
              url: "https://example.com/slow",
              data: "late",
              headers: {},
            });
          }, 100);
        });
      });

      const fetchPromise = client.getHtml({
        url: "https://example.com/slow",
        signal: controller.signal,
      });

      // 通信の最中に abort を発火
      setTimeout(() => {
        controller.abort(new DOMException("通信中中断", "AbortError"));
      }, 10);

      await expect(fetchPromise).rejects.toThrow("通信中中断");
    });

    it("正常完了時に abort イベントリスナーが適切に解除されること", async () => {
      const controller = new AbortController();
      const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

      vi.spyOn(CapacitorHttp, "get").mockResolvedValueOnce({
        status: 200,
        url: "https://example.com/clean",
        data: "ok",
        headers: {},
      });

      await client.getHtml({
        url: "https://example.com/clean",
        signal: controller.signal,
      });

      expect(removeSpy).toHaveBeenCalled();
    });
  });

  describe("HTTP エラーとネットワーク例外のハンドリング", () => {
    it("ステータスコードが 400 以上の場合は HttpError を送出すること", async () => {
      vi.spyOn(CapacitorHttp, "get").mockResolvedValue({
        status: 404,
        url: "https://example.com/not-found",
        data: "Not Found",
        headers: { "x-error": "true" },
      });

      await expect(
        client.getHtml({ url: "https://example.com/not-found" }),
      ).rejects.toThrow(HttpError);

      try {
        await client.getHtml({ url: "https://example.com/not-found" });
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        const httpError = err as HttpError;
        expect(httpError.status).toBe(404);
        expect(httpError.url).toBe("https://example.com/not-found");
        expect(httpError.response?.status).toBe(404);
        expect(httpError.response?.html).toBe("Not Found");
        expect(httpError.response?.headers).toEqual({ "x-error": "true" });
      }
    });

    it("CapacitorHttp.get が Error を reject した場合にそのエラーを再送出すること", async () => {
      vi.spyOn(CapacitorHttp, "get").mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      await expect(
        client.getHtml({ url: "https://example.com/network-error" }),
      ).rejects.toThrow("Connection refused");
    });

    it("CapacitorHttp.get が非 Error オブジェクトを reject した場合に Error にラップして再送出すること", async () => {
      vi.spyOn(CapacitorHttp, "get").mockRejectedValueOnce(
        "String error message",
      );

      await expect(
        client.getHtml({ url: "https://example.com/string-error" }),
      ).rejects.toThrow("String error message");
    });
  });
});
