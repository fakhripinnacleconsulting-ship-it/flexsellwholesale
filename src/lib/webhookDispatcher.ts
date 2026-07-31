import dbConnect from "@/lib/dbConnect";
import Notification from "@/models/Notification";

type WebhookEvent = "order.created" | "order.status_updated" | "customer.created";

/**
 * NOTE: despite the name, this does NOT deliver an HTTP webhook to any external system —
 * outbound webhook delivery was intentionally removed. It only creates an in-app Notification
 * document for the given customer. If real third-party webhook delivery (e.g. for an ERP
 * integration) is ever needed, that would be a new feature built from scratch, not something
 * this function already does.
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
