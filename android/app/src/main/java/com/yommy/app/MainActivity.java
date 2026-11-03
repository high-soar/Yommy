package com.yommy.app;

import android.os.Bundle;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CloudSyncPlugin.class);
        registerPlugin(VolumeKeyPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        if ((keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP)
                && VolumeKeyPlugin.isVolumeKeyPagingEnabled()) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                if (event.getRepeatCount() == 0) {
                    String direction = (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) ? "down" : "up";
                    VolumeKeyPlugin.onVolumeKeyDown(direction);
                }
                return true;
            } else if (event.getAction() == KeyEvent.ACTION_UP) {
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }
}
