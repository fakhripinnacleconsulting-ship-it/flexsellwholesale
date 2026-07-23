# FlexSell Wholesale - AI Agent Guidelines & Architecture

Welcome! This file provides guidelines, command lists, and architectural patterns to help AI agents work efficiently on the FlexSell Wholesale codebase.

## 🛠️ Essential Commands

- **Development Server:** `npm run dev`
- **Production Build:** `npm run build`
- **Start Production Build:** `npm run start`
- **Lint Check:** `npm run lint`

## 🏗️ Technical Stack & Architecture

- **Framework:** Next.js (App Router, dynamic page rendering)
- **Styling:** Tailwind CSS v4 (using CSS variables, standard color palettes, modern design system)
- **State Management:** Zustand (scoped client stores in `src/stores/`)
- **API Utilities:** Custom client wrapper (`src/lib/apiClient.ts`)

---

## ⚡ B2B Unified Service Layer Conventions

For all dynamic B2B enterprise features (Addresses, Reviews, Coupons, and Notifications), we use a unified client-side service layer inside `src/services/`.

Every service MUST support:
1. **Mock Mode Fallback:** If `isMockMode` is active (defined in `src/lib/apiClient.ts`), store/retrieve arrays using `localStorage` keys to enable a fully functional developer sandbox.
2. **API Proxy:** In live mode (`isMockMode = false`), route requests to their corresponding REST endpoints using `apiClient`.

### Existing Services & Storage Keys:
- **Addresses:** `customerService.ts` ➔ Key: `"flexsell-addresses-storage"`
- **Product Reviews:** `reviewService.ts` ➔ Key: `"flexsell-reviews-storage"`
- **Coupons:** `couponService.ts` ➔ Key: `"flexsell-coupons-storage"`
- **Notifications:** `notificationService.ts` ➔ Key: `"flexsell-notifications-storage"`

### Rule for Components:
Components must **never** make direct `fetch` or `apiClient` requests to endpoints for address management, review submission/moderation, coupon validation, or webhook administration. They must call the appropriate service method.

---

## 🎨 UI & Design Guidelines

- **Premium Aesthetic:** Use modern typography (e.g., Google Fonts), smooth transitions, glassmorphism, and custom hover transitions. Avoid generic default colors (e.g., pure blue, pure red).
- **Responsive Layouts:** Ensure all tables, dialog grids, and checkout views scale flawlessly on mobile and desktop.
- **Print Optimization:** Invoices and quotes must support print CSS rules (hiding headers, footers, and interactive buttons).

---

## ⚠️ Next.js Rules & Warnings
- **Middleware Deprecation:** The `middleware` file convention is deprecated in this project. Use `proxy` instead (refer to `node_modules/next/dist/docs/`).
- **React Server Components (RSC):** Maintain clean separation between server and client components (use `"use client"` where state hooks are required).
