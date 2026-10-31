package com.yommy.app;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
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
    private static final String REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke?token=";
    private static final String DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
    private static final String DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files/";

    private static final int HTTP_CONNECT_TIMEOUT_MS = 10000;
    private static final int HTTP_READ_TIMEOUT_MS = 10000;
    private static final int REVOKE_TIMEOUT_MS = 5000;

    private static final String STATUS_CONNECTED = "connected";
    private static final String STATUS_UNLINKED = "unlinked";
    private static final String STATUS_ERROR = "error";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private String currentAccessToken = null;
    private String currentUserEmail = null;
    private ActivityResultLauncher<IntentSenderRequest> authLauncher;
    private PluginCall pendingSignInCall;

    @Override
    public void load() {
        super.load();
        authLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            this::handleAuthActivityResult
        );
    }

    @PluginMethod
    public void getAuthState(PluginCall call) {
        JSObject ret = new JSObject();
        if (currentAccessToken != null && !currentAccessToken.isEmpty()) {
            ret.put("status", STATUS_CONNECTED);
            if (currentUserEmail != null && !currentUserEmail.isEmpty()) {
                ret.put("email", currentUserEmail);
            }
        } else {
            ret.put("status", STATUS_UNLINKED);
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
                        if (authLauncher != null) {
                            pendingSignInCall = call;
                            IntentSenderRequest intentSenderRequest = new IntentSenderRequest.Builder(result.getPendingIntent()).build();
                            authLauncher.launch(intentSenderRequest);
                        } else {
                            Log.e(TAG, "authLauncher is not initialized");
                            JSObject ret = new JSObject();
                            ret.put("status", STATUS_ERROR);
                            ret.put("message", "Activity result launcher not initialized");
                            call.resolve(ret);
                        }
                    } else {
                        currentAccessToken = result.getAccessToken();
                        extractEmailFromAuthResult(result);
                        JSObject ret = new JSObject();
                        ret.put("status", STATUS_CONNECTED);
                        if (currentUserEmail != null && !currentUserEmail.isEmpty()) {
                            ret.put("email", currentUserEmail);
                        }
                        call.resolve(ret);
                    }
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Authorization failed", e);
                    JSObject ret = new JSObject();
                    ret.put("status", STATUS_ERROR);
                    ret.put("message", e.getMessage() != null ? e.getMessage() : "Authorization failed");
                    call.resolve(ret);
                });
        } catch (Exception e) {
            Log.e(TAG, "signIn exception", e);
            JSObject ret = new JSObject();
            ret.put("status", STATUS_ERROR);
            ret.put("message", e.getMessage() != null ? e.getMessage() : "signIn failed");
            call.resolve(ret);
        }
    }

    private void extractEmailFromAuthResult(AuthorizationResult result) {
        try {
            GoogleSignInAccount account = result.toGoogleSignInAccount();
            if (account != null && account.getEmail() != null && !account.getEmail().isEmpty()) {
                currentUserEmail = account.getEmail();
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not extract email from AuthorizationResult", e);
        }
    }

    private void handleAuthActivityResult(ActivityResult result) {
        PluginCall call = pendingSignInCall;
        pendingSignInCall = null;
        if (call == null) {
            return;
        }

        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent data = result.getData();
            try {
                AuthorizationResult authResult = Identity.getAuthorizationClient(getActivity())
                    .getAuthorizationResultFromIntent(data);
                currentAccessToken = authResult.getAccessToken();
                extractEmailFromAuthResult(authResult);
                JSObject ret = new JSObject();
                ret.put("status", STATUS_CONNECTED);
                if (currentUserEmail != null && !currentUserEmail.isEmpty()) {
                    ret.put("email", currentUserEmail);
                }
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Error getting auth result from intent", e);
                JSObject ret = new JSObject();
                ret.put("status", STATUS_ERROR);
                ret.put("message", e.getMessage() != null ? e.getMessage() : "Failed to resolve auth");
                call.resolve(ret);
            }
        } else {
            JSObject ret = new JSObject();
            ret.put("status", STATUS_UNLINKED);
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
                HttpURLConnection conn = null;
                try {
                    URL url = new URL(REVOKE_ENDPOINT + token);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                    conn.setConnectTimeout(REVOKE_TIMEOUT_MS);
                    conn.setReadTimeout(REVOKE_TIMEOUT_MS);
                    conn.getResponseCode();
                } catch (Exception e) {
                    Log.w(TAG, "Failed to revoke token on server", e);
                } finally {
                    if (conn != null) {
                        conn.disconnect();
                    }
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
            HttpURLConnection conn = null;
            try {
                String fileId = findSyncFileId(currentAccessToken);
                if (fileId == null) {
                    JSObject ret = new JSObject();
                    ret.put("content", null);
                    call.resolve(ret);
                    return;
                }

                URL downloadUrl = new URL(DRIVE_FILES_ENDPOINT + "/" + fileId + "?alt=media");
                conn = (HttpURLConnection) downloadUrl.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Authorization", "Bearer " + currentAccessToken);
                conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);

                int responseCode = conn.getResponseCode();
                if (responseCode == 401) {
                    currentAccessToken = null;
                    call.reject("401 Unauthorized");
                    return;
                }
                if (responseCode < 200 || responseCode >= 300) {
                    call.reject("Failed to download sync file: HTTP " + responseCode);
                    return;
                }

                String content = readStream(conn.getInputStream());
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
            } finally {
                if (conn != null) {
                    conn.disconnect();
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
            HttpURLConnection conn = null;
            try {
                String fileId = findSyncFileId(currentAccessToken);
                int responseCode;

                if (fileId != null) {
                    URL patchUrl = new URL(DRIVE_UPLOAD_ENDPOINT + fileId + "?uploadType=media");
                    conn = (HttpURLConnection) patchUrl.openConnection();
                    conn.setRequestMethod("PATCH");
                    conn.setRequestProperty("Authorization", "Bearer " + currentAccessToken);
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
                    conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(content.getBytes(StandardCharsets.UTF_8));
                    }
                    responseCode = conn.getResponseCode();
                } else {
                    URL createUrl = new URL(DRIVE_FILES_ENDPOINT);
                    HttpURLConnection metaConn = (HttpURLConnection) createUrl.openConnection();
                    String newFileId;
                    try {
                        metaConn.setRequestMethod("POST");
                        metaConn.setRequestProperty("Authorization", "Bearer " + currentAccessToken);
                        metaConn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                        metaConn.setDoOutput(true);
                        metaConn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
                        metaConn.setReadTimeout(HTTP_READ_TIMEOUT_MS);

                        JSONObject metaJson = new JSONObject();
                        metaJson.put("name", SYNC_FILE_NAME);
                        metaJson.put("parents", new JSONArray(Collections.singletonList("appDataFolder")));

                        try (OutputStream os = metaConn.getOutputStream()) {
                            os.write(metaJson.toString().getBytes(StandardCharsets.UTF_8));
                        }

                        int metaResponseCode = metaConn.getResponseCode();
                        if (metaResponseCode == 401) {
                            currentAccessToken = null;
                            call.reject("401 Unauthorized");
                            return;
                        }
                        if (metaResponseCode < 200 || metaResponseCode >= 300) {
                            call.reject("Failed to create file metadata: HTTP " + metaResponseCode);
                            return;
                        }

                        String metaResStr = readStream(metaConn.getInputStream());
                        JSONObject createdObj = new JSONObject(metaResStr);
                        newFileId = createdObj.getString("id");
                    } finally {
                        metaConn.disconnect();
                    }

                    URL patchUrl = new URL(DRIVE_UPLOAD_ENDPOINT + newFileId + "?uploadType=media");
                    conn = (HttpURLConnection) patchUrl.openConnection();
                    conn.setRequestMethod("PATCH");
                    conn.setRequestProperty("Authorization", "Bearer " + currentAccessToken);
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
                    conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(content.getBytes(StandardCharsets.UTF_8));
                    }
                    responseCode = conn.getResponseCode();
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
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    private String findSyncFileId(String token) throws Exception {
        String queryUrlStr = DRIVE_FILES_ENDPOINT + "?spaces=appDataFolder&q=name='" 
            + SYNC_FILE_NAME + "'%20and%20trashed=false&fields=files(id,name)";
        URL url = new URL(queryUrlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);

            int responseCode = conn.getResponseCode();
            if (responseCode == 401) {
                currentAccessToken = null;
                throw new Exception("401 Unauthorized");
            }
            if (responseCode < 200 || responseCode >= 300) {
                throw new Exception("HTTP " + responseCode);
            }

            String resStr = readStream(conn.getInputStream());
            JSONObject json = new JSONObject(resStr);
            JSONArray files = json.optJSONArray("files");
            if (files != null && files.length() > 0) {
                return files.getJSONObject(0).getString("id");
            }
            return null;
        } finally {
            conn.disconnect();
        }
    }

    private String readStream(InputStream in) throws Exception {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            return sb.toString();
        }
    }
}
