import { Order } from "@/stores/orderStore";

export async function exportOrdersToExcel(orders: Order[]) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Orders");

  // Define columns
  ws.columns = [
    { header: "Order ID", key: "_id", width: 25 },
    { header: "Date", key: "createdAt", width: 20 },
    { header: "Type", key: "orderType", width: 15 },
    { header: "Status", key: "status", width: 15 },
    { header: "Amount", key: "amount", width: 15 },
    { header: "Payment Status", key: "paymentStatus", width: 15 },
    { header: "Customer Name", key: "customerName", width: 25 },
    { header: "Customer Email", key: "customerEmail", width: 25 },
    { header: "Amazon Order ID", key: "amazonOrderId", width: 20 },
    { header: "Amazon Invoice ID", key: "amazonInvoiceId", width: 20 },
    { header: "Dropship Customer Name", key: "dropshipCustomerName", width: 25 },
    { header: "Dropship City", key: "dropshipCity", width: 15 },
    { header: "Dropship State", key: "dropshipState", width: 15 },
    { header: "Dropship Pincode", key: "dropshipPincode", width: 15 },
  ];

  // Make header row bold
  ws.getRow(1).font = { bold: true };

  // Add data rows
  orders.forEach(order => {
    ws.addRow({
      _id: order._id,
      createdAt: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : order.date,
      orderType: order.orderType,
      status: order.status,
      amount: order.amount,
      paymentStatus: order.paymentStatus,
      customerName: order.customerName,
      customerEmail: order.shippingAddress?.email || "",
      amazonOrderId: order.dropshipDetails?.amazonOrderId || "",
      amazonInvoiceId: order.dropshipDetails?.amazonInvoiceId || "",
      dropshipCustomerName: order.dropshipDetails?.customerName || "",
      dropshipCity: order.dropshipDetails?.city || "",
      dropshipState: order.dropshipDetails?.state || "",
      dropshipPincode: order.dropshipDetails?.pinCode || "",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  a.download = `flexsell_orders_${timestamp}.xlsx`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
