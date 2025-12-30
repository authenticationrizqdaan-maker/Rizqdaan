
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User } from '../types';

/**
 * Initializes Push Notifications for the logged-in user.
 */
export const initPushNotifications = async (user: User) => {
  if (!user || !user.id) return;

  try {
    // 1. Request Push Permissions
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    // 2. Request Local Notification Permissions (For Foreground Sound)
    await LocalNotifications.requestPermissions();

    if (permStatus.receive !== 'granted') {
      console.warn("Push notification permission not granted.");
      return;
    }

    // 3. Create Vendor Channel (Android)
    // IMPORTANT: 'vendor_notification' must exist in android/app/src/main/res/raw/
    try {
      await PushNotifications.createChannel({
        id: 'vendor_alerts',
        name: 'Vendor Business Alerts',
        description: 'Sound for new orders or messages',
        sound: 'vendor_notification', 
        importance: 5,
        visibility: 1,
        vibration: true
      });
    } catch (e) {
      console.log("Channel creation skipped on non-android platform.");
    }

    // 4. Register Device
    await PushNotifications.register();

    // 5. Store FCM Token in Firestore
    PushNotifications.addListener('registration', async (token) => {
      if (db) {
        const userRef = doc(db, 'users', user.id);
        await setDoc(userRef, {
          fcmTokens: arrayUnion(token.value),
          lastTokenUpdate: new Date().toISOString()
        }, { merge: true });
      }
    });

    // 6. FOREGROUND HANDLING (The "Sound" Fix)
    // When the app is open, the system doesn't show a banner.
    // We manually trigger a local notification to play the sound.
    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('Push received in foreground:', notification);

      // Trigger local notification with vendor sound
      await LocalNotifications.schedule({
        notifications: [
          {
            title: notification.title || "New Alert",
            body: notification.body || "Check your vendor dashboard",
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 100) },
            sound: 'vendor_notification.mp3', // Note: Extension needed for LocalNotification plugin
            channelId: 'vendor_alerts',
            smallIcon: 'ic_stat_name', // Ensure you generate this asset
            extra: notification.data
          }
        ]
      });
    });

    // 7. Navigation logic for when user clicks notification
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      const data = notification.notification.data;
      if (data.link) {
          // You can dispatch a custom event here that App.tsx listens to for navigation
          window.dispatchEvent(new CustomEvent('app_navigate', { detail: data.link }));
      }
    });

  } catch (err) {
    console.error("Push Init Error:", err);
  }
};
