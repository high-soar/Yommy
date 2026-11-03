package com.yommy.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ハードウェア音量キー（Volume Down / Up）捕捉・通知用 Capacitor ネイティブプラグイン
 */
@CapacitorPlugin(name = "VolumeKey")
public class VolumeKeyPlugin extends Plugin {
    private static volatile boolean volumeKeyPagingEnabled = false;
    private static VolumeKeyPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
        super.handleOnDestroy();
    }

    public static boolean isVolumeKeyPagingEnabled() {
        return volumeKeyPagingEnabled;
    }

    public static void setPagingEnabled(boolean enabled) {
        volumeKeyPagingEnabled = enabled;
    }

    @PluginMethod
    public void setVolumeKeyPagingEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", false);
        volumeKeyPagingEnabled = Boolean.TRUE.equals(enabled);
        call.resolve();
    }

    public static void onVolumeKeyDown(String direction) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("direction", direction);
            instance.notifyListeners("volumeKeyEvent", data);
        }
    }
}
