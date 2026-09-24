package it.workbit.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * From Android 15 the system draws apps edge to edge and it is up to the app
 * to keep clear of the status and navigation bars. Android does not report
 * those bars to a WebView through the CSS safe-area values, so the web layout
 * cannot avoid them on its own — the insets are applied here as padding
 * instead, which keeps the page out from under the clock and battery.
 */
public class MainActivity extends BridgeActivity {

    private static final int APP_BACKGROUND = Color.parseColor("#F7F3FF");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final View webView = getBridge().getWebView();

        if (webView == null) {
            return;
        }

        webView.setBackgroundColor(APP_BACKGROUND);
        getWindow().getDecorView().setBackgroundColor(APP_BACKGROUND);

        // The bars sit over a light background, so their icons must be dark.
        WindowInsetsControllerCompat controller =
            new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);

        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );

            // Padding the web view turned out to do nothing to the rendered
            // page, so the measurements are handed to the stylesheet instead,
            // which works for anchored and scrolling content alike.
            publishInsetsToWebView(bars);

            return WindowInsetsCompat.CONSUMED;
        });

        // Android delivers the bar measurements once, before this listener is
        // attached, and does not repeat them on its own — so ask for them
        // again, otherwise the listener never runs and the padding stays zero.
        ViewCompat.requestApplyInsets(webView);

        askForLocationUpfront();
    }

    /**
     * Exposes the system bar sizes to the page as CSS variables, converted from
     * device pixels to the CSS pixels the layout is written in.
     */
    private void publishInsetsToWebView(Insets bars) {
        final View webView = getBridge().getWebView();

        if (webView == null) {
            return;
        }

        float density = getResources().getDisplayMetrics().density;

        if (density <= 0) {
            density = 1f;
        }

        final int top = Math.round(bars.top / density);
        final int bottom = Math.round(bars.bottom / density);

        final String script =
            "document.documentElement.style.setProperty('--wb-inset-top','" + top + "px');" +
            "document.documentElement.style.setProperty('--wb-inset-bottom','" + bottom + "px');";

        webView.post(() -> getBridge().eval(script, null));
    }

    /**
     * Clock-in needs a position, and discovering the permission is missing at
     * that moment interrupts someone who is starting a shift. Ask once when the
     * app opens instead. Android shows nothing if it was already granted, or if
     * the user has refused permanently.
     */
    private void askForLocationUpfront() {
        boolean alreadyGranted =
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED;

        if (alreadyGranted) {
            return;
        }

        ActivityCompat.requestPermissions(
            this,
            new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION },
            9101
        );
    }
}
