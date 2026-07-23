import dbConnect from "@/lib/dbConnect";
import Notification from "@/models/Notification";

type WebhookEvent = "order.created" | "order.status_updated" | "customer.created";

/**
 * Creates in-app notification for the customer if provided.
 * Webhook external HTTP dispatching has been removed as requested.
 */
export async function dispatchWebhook(
  event: WebhookEvent,
  payload: any,
  customerId?: string,
  notifConfig?: { title: string; message: string; type: "info" | "order" | "success" | "warning" }
) {
  try {
    await dbConnect();

    // Create in-app notification if customerId is provided
    if (customerId && notifConfig) {
      try {
        await Notification.create({
          customerId,
          title: notifConfig.title,
          message: notifConfig.message,
          type: notifConfig.type,
          isRead: false
        });
        console.log(`[Notification] In-app notification created for customer ${customerId}`);
      } catch (notifErr) {
        console.error("[Notification] Failed to create in-app notification:", notifErr);
      }
    }
  } catch (error: unknown) {
    console.error(`[Notification Dispatcher] Error:`, (error as any).message);
  }
}
