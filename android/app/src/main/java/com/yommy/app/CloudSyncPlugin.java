package com.yommy.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
import com.google.android.gms.tasks.Tasks;
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
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Google Drive appDataFolder クラウド同期用 Capacitor ネイティブプラグイン
 */
@CapacitorPlugin(name = "CloudSyncPlugin")
public class CloudSyncPlugin extends Plugin {
    private static final String TAG = "CloudSyncPlugin";
    private static final String PREFS_NAME = "yommy_cloud_sync";
    private static final String PREF_KEY_IS_LINKED = "is_cloud_sync_enabled";
    private static final String PREF_KEY_EMAIL = "cloud_sync_email";

    private static final String DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    private static final String SYNC_FILE_NAME = "yommy-sync-state.json";
    private static final String REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke?token=";
    private static final String DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
    private static final String DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files/";
    private static final String DRIVE_MULTIPART_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

    private static final int HTTP_CONNECT_TIMEOUT_MS = 10000;
    private static final int HTTP_READ_TIMEOUT_MS = 10000;
    private static final int REVOKE_TIMEOUT_MS = 5000;
    private static final int AUTH_TIMEOUT_SECONDS = 10;

    private static final String STATUS_CONNECTED = "connected";
    private static final String STATUS_UNLINKED = "unlinked";
    private static final String STATUS_ERROR = "error";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile String currentAccessToken = null;
    private volatile String currentUserEmail = null;
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

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getAuthState(PluginCall call) {
        if (currentAccessToken != null && !currentAccessToken.isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("status", STATUS_CONNECTED);
            if (currentUserEmail != null && !currentUserEmail.isEmpty()) {
                ret.put("email", currentUserEmail);
            }
            call.resolve(ret);
            return;
        }

        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isLinked = prefs.getBoolean(PREF_KEY_IS_LINKED, false);
        if (!isLinked) {
            JSObject ret = new JSObject();
            ret.put("status", STATUS_UNLINKED);
            call.resolve(ret);
            return;
        }

        try {
            AuthorizationRequest request = AuthorizationRequest.builder()
                .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_APPDATA_SCOPE)))
                .build();

            AuthorizationClient client = Identity.getAuthorizationClient(getActivity());
            client.authorize(request)
                .addOnSuccessListener(result -> {
                    if (!result.hasResolution()) {
                        currentAccessToken = result.getAccessToken();
                        extractEmailFromAuthResult(result);
                        if (currentUserEmail == null || currentUserEmail.isEmpty()) {
                            currentUserEmail = prefs.getString(PREF_KEY_EMAIL, null);
                        } else {
                            saveLinkedState();
                        }
                        JSObject res = new JSObject();
                        res.put("status", STATUS_CONNECTED);
                        if (currentUserEmail != null && !currentUserEmail.isEmpty()) {
                            res.put("email", currentUserEmail);
                        }
                        call.resolve(res);
                    } else {
                        clearLinkedState();
                        currentAccessToken = null;
                        currentUserEmail = null;
                        JSObject res = new JSObject();
                        res.put("status", STATUS_UNLINKED);
                        call.resolve(res);
                    }
                })
                .addOnFailureListener(e -> {
                    Log.w(TAG, "Silent re-authorization failed in getAuthState", e);
                    JSObject res = new JSObject();
                    res.put("status", STATUS_UNLINKED);
                    call.resolve(res);
                });
        } catch (Exception e) {
            Log.w(TAG, "Silent re-authorization exception in getAuthState", e);
            JSObject res = new JSObject();
            res.put("status", STATUS_UNLINKED);
            call.resolve(res);
        }
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
                            saveCall(call);
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
                        saveLinkedState();
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
        PluginCall call = getSavedCall();
        if (call == null) {
            call = pendingSignInCall;
        }
        pendingSignInCall = null;
        if (call == null) {
            return;
        }

        try {
            if (result.getResultCode() == Activity.RESULT_OK) {
                Intent data = result.getData();
                try {
                    AuthorizationResult authResult = Identity.getAuthorizationClient(getActivity())
                        .getAuthorizationResultFromIntent(data);
                    currentAccessToken = authResult.getAccessToken();
                    extractEmailFromAuthResult(authResult);
                    saveLinkedState();
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
        } finally {
            freeSavedCall();
        }
    }

    private void saveLinkedState() {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putBoolean(PREF_KEY_IS_LINKED, true)
                .putString(PREF_KEY_EMAIL, currentUserEmail)
                .apply();
        } catch (Exception e) {
            Log.w(TAG, "Failed to save linked state", e);
        }
    }

    private void clearLinkedState() {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putBoolean(PREF_KEY_IS_LINKED, false)
                .remove(PREF_KEY_EMAIL)
                .apply();
        } catch (Exception e) {
            Log.w(TAG, "Failed to clear linked state", e);
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        clearLinkedState();
        final String token = currentAccessToken;
        currentAccessToken = null;
        currentUserEmail = null;

        executor.execute(() -> {
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

    private String getOrRefreshToken() throws Exception {
        if (currentAccessToken != null && !currentAccessToken.isEmpty()) {
            return currentAccessToken;
        }
        return refreshAccessToken();
    }

    private String refreshAccessToken() throws Exception {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isLinked = prefs.getBoolean(PREF_KEY_IS_LINKED, false);
        if (!isLinked) {
            throw new Exception("401 Unauthorized: Not authenticated");
        }
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_APPDATA_SCOPE)))
            .build();
        AuthorizationResult result = Tasks.await(
            Identity.getAuthorizationClient(getActivity()).authorize(request),
            AUTH_TIMEOUT_SECONDS,
            TimeUnit.SECONDS
        );
        if (!result.hasResolution()) {
            currentAccessToken = result.getAccessToken();
            extractEmailFromAuthResult(result);
            if (currentUserEmail == null || currentUserEmail.isEmpty()) {
                currentUserEmail = prefs.getString(PREF_KEY_EMAIL, null);
            } else {
                saveLinkedState();
            }
            return currentAccessToken;
        } else {
            clearLinkedState();
            currentAccessToken = null;
            currentUserEmail = null;
            throw new Exception("401 Unauthorized: Resolution required");
        }
    }

    @PluginMethod
    public void pullFile(PluginCall call) {
        executor.execute(() -> {
            try {
                String token = getOrRefreshToken();
                String fileId;
                try {
                    fileId = findSyncFileId(token);
                } catch (Exception e) {
                    if (e.getMessage() != null && e.getMessage().contains("401")) {
                        currentAccessToken = null;
                        token = refreshAccessToken();
                        fileId = findSyncFileId(token);
                    } else {
                        throw e;
                    }
                }

                if (fileId == null) {
                    JSObject ret = new JSObject();
                    ret.put("content", null);
                    call.resolve(ret);
                    return;
                }

                int responseCode;
                HttpURLConnection conn = null;
                try {
                    URL downloadUrl = new URL(DRIVE_FILES_ENDPOINT + "/" + fileId + "?alt=media");
                    conn = (HttpURLConnection) downloadUrl.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                    conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
                    conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);
                    responseCode = conn.getResponseCode();

                    if (responseCode == 401) {
                        conn.disconnect();
                        currentAccessToken = null;
                        token = refreshAccessToken();
                        conn = (HttpURLConnection) downloadUrl.openConnection();
                        conn.setRequestMethod("GET");
                        conn.setRequestProperty("Authorization", "Bearer " + token);
                        conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
                        conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);
                        responseCode = conn.getResponseCode();
                    }

                    if (responseCode == 401) {
                        currentAccessToken = null;
                        clearLinkedState();
                        call.reject("401 Unauthorized");
                        return;
                    }
                    if (responseCode < 200 || responseCode >= 300) {
                        call.reject("Failed to download sync file: HTTP " + responseCode);
                        return;
                    }

                    String content = readStream(conn.getInputStream());
                    JSObject ret = new JSObject();
                    if (content == null || content.trim().isEmpty()) {
                        ret.put("content", null);
                    } else {
                        ret.put("content", content);
                    }
                    call.resolve(ret);
                } finally {
                    if (conn != null) {
                        conn.disconnect();
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "pullFile failed", e);
                String msg = e.getMessage() != null ? e.getMessage() : e.toString();
                if (msg.contains("401")) {
                    currentAccessToken = null;
                    clearLinkedState();
                    call.reject("401 Unauthorized");
                } else {
                    call.reject("pullFile error: " + msg);
                }
            }
        });
    }

    @PluginMethod
    public void pushFile(PluginCall call) {
        String content = call.getString("content");
        if (content == null) {
            call.reject("pushFile requires content");
            return;
        }

        executor.execute(() -> {
            try {
                String token = getOrRefreshToken();
                String fileId;
                try {
                    fileId = findSyncFileId(token);
                } catch (Exception e) {
                    if (e.getMessage() != null && e.getMessage().contains("401")) {
                        currentAccessToken = null;
                        token = refreshAccessToken();
                        fileId = findSyncFileId(token);
                    } else {
                        throw e;
                    }
                }
                int responseCode;

                if (fileId != null) {
                    responseCode = uploadPatch(fileId, content, token);
                    if (responseCode == 401) {
                        currentAccessToken = null;
                        token = refreshAccessToken();
                        responseCode = uploadPatch(fileId, content, token);
                    }
                } else {
                    responseCode = uploadMultipart(content, token);
                    if (responseCode == 401) {
                        currentAccessToken = null;
                        token = refreshAccessToken();
                        responseCode = uploadMultipart(content, token);
                    }
                }

                if (responseCode == 401) {
                    currentAccessToken = null;
                    clearLinkedState();
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
                    clearLinkedState();
                    call.reject("401 Unauthorized");
                } else {
                    call.reject("pushFile error: " + msg);
                }
            }
        });
    }

    private int uploadMultipart(String content, String token) throws Exception {
        String boundary = "===============" + System.currentTimeMillis() + "==";
        URL url = new URL(DRIVE_MULTIPART_ENDPOINT);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "multipart/related; boundary=" + boundary);
            conn.setDoOutput(true);
            conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);

            JSONObject metaJson = new JSONObject();
            metaJson.put("name", SYNC_FILE_NAME);
            metaJson.put("parents", new JSONArray(Collections.singletonList("appDataFolder")));

            String body = "--" + boundary + "\r\n"
                + "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                + metaJson.toString() + "\r\n"
                + "--" + boundary + "\r\n"
                + "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                + content + "\r\n"
                + "--" + boundary + "--";

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
            return conn.getResponseCode();
        } finally {
            conn.disconnect();
        }
    }

    private int uploadPatch(String fileId, String content, String token) throws Exception {
        URL patchUrl = new URL(DRIVE_UPLOAD_ENDPOINT + fileId + "?uploadType=media");
        HttpURLConnection conn = (HttpURLConnection) patchUrl.openConnection();
        try {
            conn.setRequestMethod("PATCH");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setDoOutput(true);
            conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(content.getBytes(StandardCharsets.UTF_8));
            }
            return conn.getResponseCode();
        } finally {
            conn.disconnect();
        }
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
