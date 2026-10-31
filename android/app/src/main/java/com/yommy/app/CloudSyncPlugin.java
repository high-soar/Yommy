package com.yommy.app;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Google Drive appDataFolder クラウド同期用 Capacitor ネイティブプラグイン
 */
@CapacitorPlugin(name = "CloudSyncPlugin")
public class CloudSyncPlugin extends Plugin {
    private static final String TAG = "CloudSyncPlugin";
    private static final String DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    private static final String SYNC_FILE_NAME = "yommy-sync-state.json";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private String currentAccessToken = null;
    private String currentUserEmail = null;

    @PluginMethod
    public void getAuthState(PluginCall call) {
        JSObject ret = new JSObject();
        if (currentAccessToken != null && !currentAccessToken.isEmpty()) {
            ret.put("status", "connected");
            ret.put("email", currentUserEmail != null ? currentUserEmail : "");
        } else {
            ret.put("status", "unlinked");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        try {
            AuthorizationRequest request = AuthorizationRequest.builder()
                .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_APPDATA_SCOPE)))
                .build();

            AuthorizationClient client = Identity.getAuthorizationClient(getActivity());
            client.authorize(request)
                .addOnSuccessListener(result -> {
                    if (result.hasResolution()) {
                        startActivityForResult(call, result.getPendingIntent().getIntentSender(), "handleAuthResolution");
                    } else {
                        currentAccessToken = result.getAccessToken();
                        JSObject ret = new JSObject();
                        ret.put("status", "connected");
                        ret.put("email", currentUserEmail != null ? currentUserEmail : "");
                        call.resolve(ret);
                    }
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Authorization failed", e);
                    JSObject ret = new JSObject();
                    ret.put("status", "error");
                    ret.put("message", e.getMessage() != null ? e.getMessage() : "Authorization failed");
                    call.resolve(ret);
                });
        } catch (Exception e) {
            Log.e(TAG, "signIn exception", e);
            JSObject ret = new JSObject();
            ret.put("status", "error");
            ret.put("message", e.getMessage() != null ? e.getMessage() : "signIn failed");
            call.resolve(ret);
        }
    }

    @ActivityCallback
    private void handleAuthResolution(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent data = result.getData();
            try {
                AuthorizationResult authResult = Identity.getAuthorizationClient(getActivity())
                    .getAuthorizationResultFromIntent(data);
                currentAccessToken = authResult.getAccessToken();
                JSObject ret = new JSObject();
                ret.put("status", "connected");
                ret.put("email", currentUserEmail != null ? currentUserEmail : "");
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Error getting auth result from intent", e);
                JSObject ret = new JSObject();
                ret.put("status", "error");
                ret.put("message", e.getMessage() != null ? e.getMessage() : "Failed to resolve auth");
                call.resolve(ret);
            }
        } else {
            JSObject ret = new JSObject();
            ret.put("status", "unlinked");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        executor.execute(() -> {
            String token = currentAccessToken;
            currentAccessToken = null;
            currentUserEmail = null;

            if (token != null && !token.isEmpty()) {
                try {
                    // Revoke token on Google OAuth server
                    URL url = new URL("https://oauth2.googleapis.com/revoke?token=" + token);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);
                    conn.getResponseCode();
                    conn.disconnect();
                } catch (Exception e) {
                    Log.w(TAG, "Failed to revoke token on server", e);
                }
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void pullFile(PluginCall call) {
        if (currentAccessToken == null || currentAccessToken.isEmpty()) {
            call.reject("401 Unauthorized: Not authenticated");
            return;
        }

        executor.execute(() -> {
            try {
                String fileId = findSyncFileId(currentAccessToken);
                if (fileId == null) {
                    JSObject ret = new JSObject();
                    ret.put("content", null);
                    call.resolve(ret);
                    return;
                }

                URL downloadUrl = new URL("https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media");
                HttpURLConnection conn = (HttpURLConnection) downloadUrl.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Authorization", "Bearer " + currentAccessToken);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                int responseCode = conn.getResponseCode();
                if (responseCode == 401) {
                    currentAccessToken = null;
                    conn.disconnect();
                    call.reject("401 Unauthorized");
                    return;
                }
                if (responseCode < 200 || responseCode >= 300) {
                    conn.disconnect();
                    call.reject("Failed to download sync file: HTTP " + responseCode);
                    return;
                }

                String content = readStream(conn.getInputStream());
                conn.disconnect();

                JSObject ret = new JSObject();
                ret.put("content", content);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "pullFile failed", e);
                String msg = e.getMessage() != null ? e.getMessage() : e.toString();
                if (msg.contains("401")) {
                    currentAccessToken = null;
                    call.reject("401 Unauthorized");
                } else {
                    call.reject("pullFile error: " + msg);
                }
            }
        });
    }

    @PluginMethod
    public void pushFile(PluginCall call) {
        if (currentAccessToken == null || currentAccessToken.isEmpty()) {
            call.reject("401 Unauthorized: Not authenticated");
            return;
        }

        String content = call.getString("content");
        if (content == null) {
            call.reject("pushFile requires content");
            return;
        }

        executor.execute(() -> {
            try {
                String fileId = findSyncFileId(currentAccessToken);
                int responseCode;

                if (fileId != null) {
                    // Update existing file content
                    URL patchUrl = new URL("https://www.googleapis.com/upload/drive/v3/files/" + fileId + "?uploadType=media");
                    HttpURLConnection conn = (HttpURLConnection) patchUrl.openConnection();
                    conn.setRequestMethod("PATCH");
                    conn.setRequestProperty("Authorization", "Bearer " + currentAccessToken);
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(10000);

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(content.getBytes(StandardCharsets.UTF_8));
                    }
                    responseCode = conn.getResponseCode();
                    conn.disconnect();
                } else {
                    // Create new metadata in appDataFolder
                    URL createUrl = new URL("https://www.googleapis.com/drive/v3/files");
                    HttpURLConnection metaConn = (HttpURLConnection) createUrl.openConnection();
                    metaConn.setRequestMethod("POST");
                    metaConn.setRequestProperty("Authorization", "Bearer " + currentAccessToken);
                    metaConn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    metaConn.setDoOutput(true);
                    metaConn.setConnectTimeout(10000);
                    metaConn.setReadTimeout(10000);

                    JSONObject metaJson = new JSONObject();
                    metaJson.put("name", SYNC_FILE_NAME);
                    metaJson.put("parents", new JSONArray(Collections.singletonList("appDataFolder")));

                    try (OutputStream os = metaConn.getOutputStream()) {
                        os.write(metaJson.toString().getBytes(StandardCharsets.UTF_8));
                    }

                    int metaResponseCode = metaConn.getResponseCode();
                    if (metaResponseCode == 401) {
                        currentAccessToken = null;
                        metaConn.disconnect();
                        call.reject("401 Unauthorized");
                        return;
                    }
                    if (metaResponseCode < 200 || metaResponseCode >= 300) {
                        metaConn.disconnect();
                        call.reject("Failed to create file metadata: HTTP " + metaResponseCode);
                        return;
                    }

                    String metaResStr = readStream(metaConn.getInputStream());
                    metaConn.disconnect();
                    JSONObject createdObj = new JSONObject(metaResStr);
                    String newFileId = createdObj.getString("id");

                    // Upload content
                    URL patchUrl = new URL("https://www.googleapis.com/upload/drive/v3/files/" + newFileId + "?uploadType=media");
                    HttpURLConnection uploadConn = (HttpURLConnection) patchUrl.openConnection();
                    uploadConn.setRequestMethod("PATCH");
                    uploadConn.setRequestProperty("Authorization", "Bearer " + currentAccessToken);
                    uploadConn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    uploadConn.setDoOutput(true);
                    uploadConn.setConnectTimeout(10000);
                    uploadConn.setReadTimeout(10000);

                    try (OutputStream os = uploadConn.getOutputStream()) {
                        os.write(content.getBytes(StandardCharsets.UTF_8));
                    }
                    responseCode = uploadConn.getResponseCode();
                    uploadConn.disconnect();
                }

                if (responseCode == 401) {
                    currentAccessToken = null;
                    call.reject("401 Unauthorized");
                    return;
                }
                if (responseCode < 200 || responseCode >= 300) {
                    call.reject("Failed to upload content: HTTP " + responseCode);
                    return;
                }

                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "pushFile failed", e);
                String msg = e.getMessage() != null ? e.getMessage() : e.toString();
                if (msg.contains("401")) {
                    currentAccessToken = null;
                    call.reject("401 Unauthorized");
                } else {
                    call.reject("pushFile error: " + msg);
                }
            }
        });
    }

    private String findSyncFileId(String token) throws Exception {
        String queryUrlStr = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='" 
            + SYNC_FILE_NAME + "'%20and%20trashed=false&fields=files(id,name)";
        URL url = new URL(queryUrlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Authorization", "Bearer " + token);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);

        int responseCode = conn.getResponseCode();
        if (responseCode == 401) {
            currentAccessToken = null;
            conn.disconnect();
            throw new Exception("401 Unauthorized");
        }
        if (responseCode < 200 || responseCode >= 300) {
            conn.disconnect();
            throw new Exception("HTTP " + responseCode);
        }

        String resStr = readStream(conn.getInputStream());
        conn.disconnect();

        JSONObject json = new JSONObject(resStr);
        JSONArray files = json.optJSONArray("files");
        if (files != null && files.length() > 0) {
            return files.getJSONObject(0).getString("id");
        }
        return null;
    }

    private String readStream(InputStream in) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line).append("\n");
        }
        return sb.toString();
    }
}
