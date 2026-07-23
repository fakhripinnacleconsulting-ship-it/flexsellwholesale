# FlexSell Wholesale - CLAUDE Developer Guide

This file provides a quick reference for building, running, and maintaining the FlexSell Wholesale codebase.

## 🛠️ Build and Dev Commands

- **Start Dev Server:** `npm run dev`
- **Run Production Build:** `npm run build`
- **Start Production Server:** `npm run start`
- **Code Linter:** `npm run lint`

## 📐 Code Style & Guidelines

- **Architecture Rules:** Refer to the full specification in [AGENTS.md](file:///e:/FAKHRI/flexsell/flexsell-wholesale/AGENTS.md).
- **Service Layer Pattern:** Do not use inline fetches. Route address management, product reviews, coupons, and webhooks through the service wrappers in `src/services/`.
- **Mock Mode Support:** Ensure services handle a `localStorage` fallback wrapper when `isMockMode` is enabled.
- **Styling:** Use Tailwind CSS v4 variables and custom vanilla CSS classes.
- **Types:** Strictly define types in `src/types/` and avoid using `any` when possible.
