package it.workbit.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;

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

            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);

            return WindowInsetsCompat.CONSUMED;
        });
    }
}
