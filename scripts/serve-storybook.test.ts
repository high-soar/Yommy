import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createStorybookServer } from "./serve-storybook.mjs";

describe("serve-storybook (R1-39, R1-15)", () => {
  let tempDir: string;
  let siblingSecretDir: string;
  let server: http.Server;
  let serverPort: number;

  beforeAll(async () => {
    // 一時ディレクトリにダミーの Storybook 静的ファイルを配置
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "storybook-static-test-"));
    fs.writeFileSync(
      path.join(tempDir, "index.html"),
      "<html>Storybook</html>",
    );
    fs.writeFileSync(path.join(tempDir, "test.js"), "console.log('test');");
    fs.mkdirSync(path.join(tempDir, "sub"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "sub", "nested.js"),
      "console.log('nested');",
    );

    // baseDir と前方一致する隣接接頭辞ディレクトリを作成（R1-15 検証用）
    siblingSecretDir = `${tempDir}-secret`;
    fs.mkdirSync(siblingSecretDir, { recursive: true });
    fs.writeFileSync(
      path.join(siblingSecretDir, "secret.txt"),
      "TOP_SECRET_DATA",
    );

    server = createStorybookServer({ baseDir: tempDir, port: 0 });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr !== null) {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(siblingSecretDir, { recursive: true, force: true });
  });

  const request = (
    urlPath: string,
  ): Promise<{
    statusCode: number;
    data: string;
    headers: http.IncomingHttpHeaders;
  }> => {
    return new Promise((resolve, reject) => {
      // クライアント側 URL 正規化による ".." 事前折り畳みを防ぎ、生のパスを送信する
      const req = http.get(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: urlPath,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 500,
              data,
              headers: res.headers,
            });
          });
        },
      );
      req.on("error", reject);
    });
  };

  it("ルートパス '/' への GET リクエストで index.html が返されること", async () => {
    const res = await request("/");
    expect(res.statusCode).toBe(200);
    expect(res.data).toBe("<html>Storybook</html>");
    expect(res.headers["content-type"]).toBe("text/html; charset=utf-8");
  });

  it("静的アセットへの GET リクエストで該当ファイルと適切な MIME タイプが返されること", async () => {
    const res = await request("/test.js");
    expect(res.statusCode).toBe(200);
    expect(res.data).toBe("console.log('test');");
    expect(res.headers["content-type"]).toBe(
      "application/javascript; charset=utf-8",
    );
  });

  it("正常なサブパス（./test.js, sub/nested.js, sub/../test.js, 先頭バックスラッシュ, クエリ付き）が正しく配信されること (R1-15)", async () => {
    const dotRes = await request("/./test.js");
    expect(dotRes.statusCode).toBe(200);
    expect(dotRes.data).toBe("console.log('test');");

    const nestedRes = await request("/sub/nested.js");
    expect(nestedRes.statusCode).toBe(200);
    expect(nestedRes.data).toBe("console.log('nested');");

    const parentWithinBaseRes = await request("/sub/../test.js");
    expect(parentWithinBaseRes.statusCode).toBe(200);
    expect(parentWithinBaseRes.data).toBe("console.log('test');");

    const leadingBackslashRes = await request("/%5ctest.js");
    expect(leadingBackslashRes.statusCode).toBe(200);
    expect(leadingBackslashRes.data).toBe("console.log('test');");

    const queryRootRes = await request("/?story=default");
    expect(queryRootRes.statusCode).toBe(200);
    expect(queryRootRes.data).toBe("<html>Storybook</html>");
  });

  it("存在しないファイルへのリクエストで 404 が返されること", async () => {
    const res = await request("/non-existent.html");
    expect(res.statusCode).toBe(404);
    expect(res.data).toBe("Not Found");
  });

  it("不正な URI エンコード（%E0%A4%A 等）で 400 Bad Request が返されサーバーが落ちないこと (R1-39)", async () => {
    const res = await request("/%E0%A4%A");
    expect(res.statusCode).toBe(400);
    expect(res.data).toBe("Bad Request");
  });

  it("パストラバーサル（../）を含むリクエストで 403 Forbidden が返され安全に遮断されること (R1-15)", async () => {
    const res = await request("/../../etc/passwd");
    expect(res.statusCode).toBe(403);
    expect(res.data).toBe("Forbidden");

    const deepRes = await request("/sub/../../etc/passwd");
    expect(deepRes.statusCode).toBe(403);
    expect(deepRes.data).toBe("Forbidden");
  });

  it("baseDir 自体（/. や /sub/..）へ解決されるリクエストは 403 Forbidden が返されること (R1-15)", async () => {
    const dotRes = await request("/.");
    expect(dotRes.statusCode).toBe(403);
    expect(dotRes.data).toBe("Forbidden");

    const subParentRes = await request("/sub/..");
    expect(subParentRes.statusCode).toBe(403);
    expect(subParentRes.data).toBe("Forbidden");
  });

  it("隣接接頭辞ディレクトリ（baseDir + '-secret'）への突破リクエスト（生パス・URLエンコード双方）が 403 Forbidden で遮断されること (R1-15)", async () => {
    const siblingName = path.basename(siblingSecretDir);

    const rawRes = await request(`/../${siblingName}/secret.txt`);
    expect(rawRes.statusCode).toBe(403);
    expect(rawRes.data).toBe("Forbidden");

    const encodedRes = await request(`/%2e%2e/${siblingName}/secret.txt`);
    expect(encodedRes.statusCode).toBe(403);
    expect(encodedRes.data).toBe("Forbidden");
  });
});
