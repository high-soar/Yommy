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

export class CapacitorHttpClient implements HttpClientBridge {
  async getHtml(options: HttpRequestOptions): Promise<HttpResponse> {
    if (options.signal?.aborted) {
      throw options.signal.reason;
    }

    const httpOptions: HttpOptions = {
      url: options.url,
      responseType: "text",
    };

    if (options.headers) {
      httpOptions.headers = options.headers;
    }

    if (typeof options.timeoutMs === "number") {
      httpOptions.connectTimeout = options.timeoutMs;
      httpOptions.readTimeout = options.timeoutMs;
    }

    let removeAbortListener: (() => void) | undefined;
    const abortPromise = new Promise<never>((_, reject) => {
      if (options.signal) {
        const onAbort = () => {
          reject(options.signal?.reason);
        };
        options.signal.addEventListener("abort", onAbort, { once: true });
        removeAbortListener = () => {
          options.signal?.removeEventListener("abort", onAbort);
        };
      }
    });

    let response;
    try {
      response = await Promise.race([
        CapacitorHttp.get(httpOptions),
        abortPromise,
      ]);
    } catch (err) {
      removeAbortListener?.();
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(String(err));
    }

    removeAbortListener?.();

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
