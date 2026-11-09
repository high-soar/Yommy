import { CapacitorHttp, type HttpOptions } from "@capacitor/core";
import type {
  HttpClientBridge,
  HttpRequestOptions,
  HttpResponse,
} from "./types";

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly response?: HttpResponse;

  constructor(
    message: string,
    status: number,
    url: string,
    response?: HttpResponse,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.response = response;
  }
}

function serializeData(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (data === null || data === undefined) {
    return "";
  }
  if (typeof data === "object") {
    return JSON.stringify(data);
  }
  return String(data);
}

export const DEFAULT_HTTP_TIMEOUT_MS = 15000;
export const DEFAULT_USER_AGENT = "Yommy/1.0 (Android; WebNovelReader)";

function buildHttpOptions(options: HttpRequestOptions): HttpOptions {
  const timeoutMs =
    typeof options.timeoutMs === "number"
      ? options.timeoutMs
      : DEFAULT_HTTP_TIMEOUT_MS;

  const headers: Record<string, string> = { ...(options.headers || {}) };
  const hasUserAgent = Object.keys(headers).some(
    (key) => key.toLowerCase() === "user-agent",
  );
  if (!hasUserAgent) {
    headers["User-Agent"] = DEFAULT_USER_AGENT;
  }

  const httpOptions: HttpOptions = {
    url: options.url,
    responseType: "text",
    headers,
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
  };

  return httpOptions;
}

function createAbortSignalPromise(signal?: AbortSignal): {
  abortPromise: Promise<never>;
  cleanup: () => void;
} {
  let cleanup = () => {};

  const abortPromise = new Promise<never>((_, reject) => {
    if (signal) {
      const onAbort = () => {
        reject(signal.reason);
      };
      signal.addEventListener("abort", onAbort, { once: true });
      cleanup = () => {
        signal.removeEventListener("abort", onAbort);
      };
    }
  });

  return { abortPromise, cleanup };
}

export class CapacitorHttpClient implements HttpClientBridge {
  async getHtml(options: HttpRequestOptions): Promise<HttpResponse> {
    if (options.signal?.aborted) {
      throw options.signal.reason;
    }

    const httpOptions = buildHttpOptions(options);
    const { abortPromise, cleanup } = createAbortSignalPromise(options.signal);

    let response;
    try {
      response = await Promise.race([
        CapacitorHttp.get(httpOptions),
        abortPromise,
      ]);
    } catch (err) {
      cleanup();
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(String(err));
    }

    cleanup();

    const status = response.status;
    const finalUrl = response.url || options.url;
    const headers = (response.headers as Record<string, string>) || {};
    const html = serializeData(response.data);

    const httpResponse: HttpResponse = {
      status,
      url: finalUrl,
      html,
      headers,
    };

    if (status >= 400) {
      throw new HttpError(
        `HTTP request failed with status ${status}: ${finalUrl}`,
        status,
        finalUrl,
        httpResponse,
      );
    }

    return httpResponse;
  }
}
