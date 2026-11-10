package com.yommy.app;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONTokener;

/**
 * 内蔵 WebView DOM キャプチャ・閲覧用 Capacitor ネイティブプラグイン（Issue #269 / AC-WV-03）
 */
@CapacitorPlugin(name = "WebViewDom")
public class WebViewDomPlugin extends Plugin {
    private Dialog dialog;
    private WebView webView;
    private String lastCapturedHtml = "";
    private String lastCapturedUrl = "";
    private String lastCapturedTitle = "";

    @Override
    public void load() {
        super.load();
        lastCapturedHtml = "";
        lastCapturedUrl = "";
        lastCapturedTitle = "";
    }

    @Override
    protected void handleOnDestroy() {
        dismissAndDestroyDialog();
        lastCapturedHtml = "";
        lastCapturedUrl = "";
        lastCapturedTitle = "";
        super.handleOnDestroy();
    }

    private void dismissDialogOnly() {
        if (dialog != null) {
            try {
                if (dialog.isShowing()) {
                    dialog.dismiss();
                }
            } catch (Exception ignored) {}
            dialog = null;
        }
    }

    private void dismissAndDestroyDialog() {
        dismissDialogOnly();
        if (webView != null) {
            try {
                webView.stopLoading();
                webView.clearHistory();
                webView.loadUrl("about:blank");
                webView.onPause();
                webView.removeAllViews();
                webView.destroy();
            } catch (Exception ignored) {}
            webView = null;
        }
        lastCapturedHtml = "";
        lastCapturedUrl = "";
        lastCapturedTitle = "";
    }

    private boolean isAllowedScheme(String scheme) {
        return "https".equalsIgnoreCase(scheme);
    }

    /**
     * 内蔵 WebView ダイアログを開き、指定 URL をロードする。
     */
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        String initialTitle = call.getString("title", "");

        Uri parsedUri = url != null ? Uri.parse(url) : null;
        String scheme = parsedUri != null ? parsedUri.getScheme() : null;
        if (url == null || scheme == null || !isAllowedScheme(scheme)) {
            call.reject("Invalid or unsafe URL scheme: " + url + " (only https is allowed)");
            return;
        }

        getActivity().runOnUiThread(() -> {
            dismissAndDestroyDialog();

            Context context = getContext();
            dialog = new Dialog(context, android.R.style.Theme_Black_NoTitleBar_Fullscreen);

            LinearLayout rootLayout = new LinearLayout(context);
            rootLayout.setOrientation(LinearLayout.VERTICAL);
            rootLayout.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ));
            rootLayout.setBackgroundColor(Color.parseColor("#0F172A")); // slate-900

            // ツールバー（上部操作バー）
            LinearLayout toolBar = new LinearLayout(context);
            toolBar.setOrientation(LinearLayout.HORIZONTAL);
            toolBar.setGravity(Gravity.CENTER_VERTICAL);
            toolBar.setPadding(dpToPx(context, 8), dpToPx(context, 6), dpToPx(context, 8), dpToPx(context, 6));
            toolBar.setBackgroundColor(Color.parseColor("#1E293B")); // slate-800
            toolBar.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ));

            Button btnBack = createToolButton(context, "◀");
            Button btnForward = createToolButton(context, "▶");
            Button btnReload = createToolButton(context, "⟳");

            TextView tvTitleUrl = new TextView(context);
            LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                0,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                1.0f
            );
            titleParams.setMargins(dpToPx(context, 6), 0, dpToPx(context, 6), 0);
            tvTitleUrl.setLayoutParams(titleParams);
            tvTitleUrl.setTextColor(Color.WHITE);
            tvTitleUrl.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            tvTitleUrl.setSingleLine(true);
            tvTitleUrl.setEllipsize(TextUtils.TruncateAt.END);
            tvTitleUrl.setText(initialTitle.isEmpty() ? url : initialTitle);

            Button btnCapture = createToolButton(context, "取込");
            btnCapture.setTextColor(Color.parseColor("#38BDF8")); // sky-400
            btnCapture.setTypeface(null, Typeface.BOLD);

            Button btnClose = createToolButton(context, "✕");
            btnClose.setTextColor(Color.parseColor("#F87171")); // red-400

            toolBar.addView(btnBack);
            toolBar.addView(btnForward);
            toolBar.addView(btnReload);
            toolBar.addView(tvTitleUrl);
            toolBar.addView(btnCapture);
            toolBar.addView(btnClose);

            // WebView
            webView = new WebView(context);
            LinearLayout.LayoutParams webViewParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1.0f
            );
            webView.setLayoutParams(webViewParams);

            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setAllowFileAccess(false);
            settings.setAllowContentAccess(false);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
            settings.setSupportZoom(true);
            settings.setBuiltInZoomControls(true);
            settings.setDisplayZoomControls(false);

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    if (request == null || request.getUrl() == null) {
                        return true;
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        Uri requestUri = request.getUrl();
                        String scheme = requestUri.getScheme();
                        if (scheme == null || !isAllowedScheme(scheme)) {
                            return true; // 危険・平文スキーム（http:, javascript:, data:, file:, intent: 等）を即時遮断 (R2-08)
                        }
                    }
                    return false;
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String requestUrl) {
                    if (requestUrl == null) {
                        return true;
                    }
                    Uri parsed = Uri.parse(requestUrl);
                    String s = parsed != null ? parsed.getScheme() : null;
                    if (s == null || !isAllowedScheme(s)) {
                        return true; // 危険・平文スキーム遮断 (R2-08)
                    }
                    return false;
                }

                @Override
                public void onPageFinished(WebView view, String loadedUrl) {
                    super.onPageFinished(view, loadedUrl);
                    String pageTitle = view.getTitle();
                    if (pageTitle != null && !pageTitle.isEmpty()) {
                        tvTitleUrl.setText(pageTitle);
                    } else {
                        tvTitleUrl.setText(loadedUrl);
                    }
                    btnBack.setEnabled(view.canGoBack());
                    btnForward.setEnabled(view.canGoForward());

                    lastCapturedUrl = loadedUrl != null ? loadedUrl : "";
                    lastCapturedTitle = pageTitle != null ? pageTitle : "";

                    // 直近ロード済みページの DOM キャッシュを更新
                    if (webView != null) {
                        webView.evaluateJavascript("(function(){return document.documentElement.outerHTML;})()", value -> {
                            if (webView == null) {
                                return;
                            }
                            String html = decodeJsString(value);
                            if (!TextUtils.isEmpty(html)) {
                                lastCapturedHtml = html;
                            }
                        });
                    }
                }
            });

            btnBack.setOnClickListener(v -> {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                }
            });

            btnForward.setOnClickListener(v -> {
                if (webView != null && webView.canGoForward()) {
                    webView.goForward();
                }
            });

            btnReload.setOnClickListener(v -> {
                if (webView != null) {
                    webView.reload();
                }
            });

            // ✕ ボタン押下時は WebView を破棄せずダイアログのみ非表示化し、直近キャッシュまたは DOM を維持 (R1-41)
            btnClose.setOnClickListener(v -> dismissDialogOnly());

            btnCapture.setOnClickListener(v -> {
                if (webView != null) {
                    webView.evaluateJavascript("(function(){return document.documentElement.outerHTML;})()", value -> {
                        if (webView == null) {
                            return;
                        }
                        String html = decodeJsString(value);
                        String currentUrl = webView.getUrl() != null ? webView.getUrl() : "";
                        String currentTitle = webView.getTitle() != null ? webView.getTitle() : "";

                        lastCapturedHtml = html;
                        lastCapturedUrl = currentUrl;
                        lastCapturedTitle = currentTitle;

                        JSObject data = new JSObject();
                        data.put("html", html);
                        data.put("url", currentUrl);
                        data.put("title", currentTitle);
                        notifyListeners("domCaptured", data);
                        dismissDialogOnly();
                    });
                }
            });

            rootLayout.addView(toolBar);
            rootLayout.addView(webView);

            dialog.setContentView(rootLayout);
            dialog.setOnDismissListener(d -> dismissDialogOnly());
            dialog.show();

            webView.loadUrl(url);
            call.resolve();
        });
    }

    /**
     * 内蔵 WebView ダイアログを閉じる。
     * WebView 本体および直近 DOM キャッシュを確実に破棄する (R2-18)。
     */
    @PluginMethod
    public void close(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            dismissAndDestroyDialog();
            call.resolve();
        });
    }

    /**
     * 現在表示中ページの DOM (outerHTML), 最終 URL, タイトルをキャプチャする。
     */
    @PluginMethod
    public void captureDom(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript("(function(){return document.documentElement.outerHTML;})()", value -> {
                    if (webView == null) {
                        if (!TextUtils.isEmpty(lastCapturedHtml)) {
                            JSObject ret = new JSObject();
                            ret.put("html", lastCapturedHtml);
                            ret.put("url", lastCapturedUrl);
                            ret.put("title", lastCapturedTitle);
                            call.resolve(ret);
                            return;
                        }
                        call.reject("WebView was destroyed during capture");
                        return;
                    }
                    String html = decodeJsString(value);
                    String currentUrl = webView.getUrl() != null ? webView.getUrl() : "";
                    String currentTitle = webView.getTitle() != null ? webView.getTitle() : "";

                    lastCapturedHtml = html;
                    lastCapturedUrl = currentUrl;
                    lastCapturedTitle = currentTitle;

                    JSObject ret = new JSObject();
                    ret.put("html", html);
                    ret.put("url", currentUrl);
                    ret.put("title", currentTitle);
                    call.resolve(ret);
                });
            } else if (!TextUtils.isEmpty(lastCapturedHtml)) {
                JSObject ret = new JSObject();
                ret.put("html", lastCapturedHtml);
                ret.put("url", lastCapturedUrl);
                ret.put("title", lastCapturedTitle);
                call.resolve(ret);
            } else {
                call.reject("WebView is not opened");
            }
        });
    }

    private static String decodeJsString(String value) {
        if (value == null || value.equals("null")) {
            return "";
        }
        try {
            JSONTokener tokener = new JSONTokener(value);
            Object nextVal = tokener.nextValue();
            if (nextVal instanceof String) {
                return (String) nextVal;
            }
        } catch (Exception ignored) {}
        return value;
    }

    private static Button createToolButton(Context context, String text) {
        Button btn = new Button(context);
        btn.setText(text);
        btn.setTextColor(Color.WHITE);
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        btn.setBackgroundColor(Color.TRANSPARENT);
        btn.setPadding(dpToPx(context, 8), dpToPx(context, 4), dpToPx(context, 8), dpToPx(context, 4));
        btn.setMinWidth(dpToPx(context, 36));
        btn.setMinHeight(dpToPx(context, 36));
        return btn;
    }

    private static int dpToPx(Context context, int dp) {
        float density = context.getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }
}
