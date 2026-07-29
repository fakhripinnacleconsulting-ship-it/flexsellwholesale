export const GTM_ID = "GTM-T73FGQ88";

declare global {
  interface Window {
    dataLayer: Record<string, any>[];
  }
}

/**
 * Safe wrapper to push data to window.dataLayer
 */
export function sendGTMEvent(data: Record<string, any>) {
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
  }
}

/**
 * Track Product View (view_item)
 */
export function trackViewItem(product: any) {
  if (!product) return;
  const firstVariant = product.colorVariants?.[0]?.subVariants?.[0];
  const price = firstVariant?.b2cPrice || firstVariant?.mrp || 0;

  sendGTMEvent({
    event: "view_item",
    ecommerce: {
      currency: "INR",
      value: price,
      items: [
        {
          item_id: product._id,
          item_name: product.title,
          item_category: product.categoryId || "General",
          price,
          quantity: 1,
        },
      ],
    },
  });
}

/**
 * Track Add to Cart (add_to_cart)
 */
export function trackAddToCart(product: any, quantity: number = 1, selectedVariant?: any) {
  if (!product) return;
  const price = selectedVariant?.b2cPrice || product.colorVariants?.[0]?.subVariants?.[0]?.b2cPrice || 0;

  sendGTMEvent({
    event: "add_to_cart",
    ecommerce: {
      currency: "INR",
      value: price * quantity,
      items: [
        {
          item_id: product._id,
          item_name: product.title,
          item_category: product.categoryId || "General",
          item_variant: selectedVariant?.size || selectedVariant?.color || undefined,
          price,
          quantity,
        },
      ],
    },
  });
}

/**
 * Track Remove from Cart (remove_from_cart)
 */
export function trackRemoveFromCart(product: any, quantity: number = 1) {
  if (!product) return;
  const price = product.b2cPrice || product.price || 0;

  sendGTMEvent({
    event: "remove_from_cart",
    ecommerce: {
      currency: "INR",
      value: price * quantity,
      items: [
        {
          item_id: product._id || product.id,
          item_name: product.title || product.name,
          price,
          quantity,
        },
      ],
    },
  });
}

/**
 * Track Begin Checkout (begin_checkout)
 */
export function trackBeginCheckout(items: any[], totalValue: number) {
  if (!items || items.length === 0) return;

  sendGTMEvent({
    event: "begin_checkout",
    ecommerce: {
      currency: "INR",
      value: totalValue,
      items: items.map((item) => ({
        item_id: item.product?._id || item.productId,
        item_name: item.product?.title || item.name,
        price: item.pricePerUnit || item.price,
        quantity: item.quantity,
      })),
    },
  });
}

/**
 * Track Order Purchase (purchase)
 */
export function trackPurchase(order: any) {
  if (!order) return;

  sendGTMEvent({
    event: "purchase",
    ecommerce: {
      transaction_id: order._id || order.id,
      value: order.amount,
      tax: order.taxDetails?.cgst ? order.taxDetails.cgst + order.taxDetails.sgst + order.taxDetails.igst : 0,
      shipping: order.shippingCharge || 0,
      currency: "INR",
      coupon: order.couponCode || undefined,
      items: (order.items || []).map((item: any) => ({
        item_id: item.product?._id || item.productId,
        item_name: item.product?.title || item.name,
        price: item.pricePerUnit || item.price,
        quantity: item.quantity,
      })),
    },
  });
}

/**
 * Track Search Query (search)
 */
export function trackSearch(searchQuery: string) {
  if (!searchQuery || !searchQuery.trim()) return;

  sendGTMEvent({
    event: "search",
    search_term: searchQuery.trim(),
  });
}

/**
 * Track User Login (login)
 */
export function trackLogin(method: string = "email") {
  sendGTMEvent({
    event: "login",
    method,
  });
}

/**
 * Track User Sign Up (sign_up)
 */
export function trackSignUp(method: string = "email") {
  sendGTMEvent({
    event: "sign_up",
    method,
  });
}
