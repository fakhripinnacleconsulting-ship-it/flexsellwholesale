export const ORDER_STATUS_CLASSES: Record<string, string> = {
  Placed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500",
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500",
  Confirmed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-500",
  Processing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500",
  "Awaiting Shipment": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-500",
  "In Transit": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-500",
  Shipped: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-500",
  Delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500",
  Cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500",
};

export const INDIAN_STATES = [
  "Madhya Pradesh",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Union Territory"
];

export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short", day: "2-digit", year: "numeric"
};

export const DATETIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short", day: "2-digit", year: "numeric", 
  hour: "2-digit", minute: "2-digit"
};
