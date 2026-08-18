package fr.arubinu.tachsync;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Full-screen host for the dashboard.
 *
 * A monitor sitting on a dashboard is read at a glance while driving: a status
 * bar showing the time and the battery, and a navigation bar inviting a stray
 * touch, are both noise and hazard. The web layer cannot remove them — hiding
 * system bars is the window's business, so it is settled here.
 *
 * Bars stay reachable: a swipe from an edge brings them back briefly, then they
 * withdraw on their own. Locking the user out of their own device would be a
 * different, and much worse, decision.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // A gauge that goes dark after thirty seconds is no gauge at all: the
        // screen is read at a glance, never touched while driving, so the idle
        // timer would fire exactly when the display is most needed.
        //
        // Held by the window rather than a wake lock: it is released with the
        // activity, and cannot outlive it and drain the battery in the pocket.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        goImmersive();
    }

    /**
     * Android restores the bars on its own after a dialog, a permission prompt
     * or a return from the background. Without this the screen would come back
     * framed, and stay so until the next launch.
     */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            goImmersive();
        }
    }

    private void goImmersive() {
        // Lets the WebView draw under the bars rather than beside them: without
        // it the layout would keep their footprint once they are hidden.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);

        // On a notched screen the system letterboxes the window by default,
        // leaving a black band across a display that is meant to be filled.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
    }
}
