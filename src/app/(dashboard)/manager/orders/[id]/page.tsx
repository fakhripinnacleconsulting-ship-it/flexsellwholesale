import * as React from "react";
import { AdminOrderViewManager } from "@/components/admin/order/AdminOrderViewManager";

export default function ManagerOrderPage(props: { params: Promise<{ id: string }> }) {
  return <AdminOrderViewManager params={props.params} />;
}
