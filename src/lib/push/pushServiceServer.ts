import webpush from "web-push";
import PushSubscriptionModel from "@/models/PushSubscription";

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BKQriP1s0RiVE4y4VgGlPQUmFUtjK_Ms_WCKVEBNgnq0a71Ph9osCCjUK3TmGy0b0Mgwqg3VZSBw-PRMsWlhkQg";
const PRIVATE_VAPID_KEY = process.env.VAPID_PRIVATE_KEY;

let isConfigured = false;
if (PRIVATE_VAPID_KEY) {
  try {
    const contactEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_USER || "mauryatech7@gmail.com";
    const mailto = contactEmail.startsWith("mailto:") ? contactEmail : `mailto:${contactEmail}`;
    webpush.setVapidDetails(
      mailto,
      PUBLIC_VAPID_KEY,
      PRIVATE_VAPID_KEY
    );
    isConfigured = true;
    console.log("[PUSH SERVICE] Web Push VAPID initialized successfully with subject:", mailto);
  } catch (err) {
    console.error("Failed to configure web-push VAPID details:", err);
  }
} else {
  console.warn("VAPID_PRIVATE_KEY not set. Web push notifications will run in mock/console mode.");
}

export const pushServiceServer = {
  async sendPushNotification(
    userId: string,
    role: "customer" | "admin",
    payload: {
      title: string;
      body: string;
      link?: string;
      entityId?: string;
      actionType?: string;
    }
  ): Promise<void> {
    console.log(`[PUSH DISPATCH] Target: ${userId} (${role}) | Title: ${payload.title}`);

    if (!isConfigured) {
      console.log(`[PUSH DISPATCHER] VAPID keys not configured. Push logged to console:`, payload);
      return;
    }

    try {
      // Find all active subscriptions for this user
      // Note: for admin, we match userId = "admin" or role = "admin"
      const query = role === "admin"
        ? { $or: [{ role: "admin" }, { userId: "admin" }], isActive: true }
        : { $or: [{ userId }, { userId: "current" }, { userId: "anonymous" }, { userId: "current-user" }, { role: "customer" }], isActive: true };

      const subscriptions = await PushSubscriptionModel.find(query);
      if (subscriptions.length === 0) {
        console.log(`[PUSH DISPATCHER] No active push subscriptions found for ${userId} (${role})`);
        return;
      }

      const promises = subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
          // Update last used timestamp
          sub.lastUsedAt = new Date();
          await sub.save();
          console.log(`[PUSH SUCCESS] Sent to endpoint: ${sub.endpoint.substring(0, 40)}...`);
        } catch (err: any) {
          console.error(`[PUSH ERROR] Failed to send push to subscription ${sub._id}:`, err.message);

          // Deactivate subscription if it has expired or is no longer valid (e.g. 410 Gone, 404 Not Found)
          if (err.statusCode === 410 || err.statusCode === 404) {
            sub.isActive = false;
            await sub.save();
            console.log(`[PUSH CLEANUP] Deactivated expired subscription: ${sub._id}`);
          }
        }
      });

      await Promise.all(promises);
    } catch (err: any) {
      console.error(`[PUSH DISPATCH ERROR] Failed to process push queue for user ${userId}:`, err.message);
    }
  },
};
