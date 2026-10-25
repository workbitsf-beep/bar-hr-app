package it.workbit.app;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.RemoteMessage;

import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService;

/**
 * The Firebase messaging plugin's service, plus the shift reminders the app
 * draws itself (ReminderNotification). Everything else goes on as before.
 */
public class WorkbitMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        if (message.getNotification() == null && ReminderNotification.handles(message.getData())) {
            ReminderNotification.show(this, message.getData());
            return;
        }
        super.onMessageReceived(message);
    }
}
