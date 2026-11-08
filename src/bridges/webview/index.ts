export type {
  CapturedDomResult,
  OpenWebViewOptions,
  WebViewDomBridge,
} from "./types";
export {
  CapacitorWebViewDomBridge,
  WebViewDomNative,
  type WebViewDomNativePlugin,
} from "./capacitorWebViewDomBridge";
export { MockWebViewDomBridge } from "./mockWebViewDomBridge";
export { isValidHttpUrl, createUnsafeSchemeError } from "./urlUtils";
