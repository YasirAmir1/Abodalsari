# Subscriber Due Date & Payment Alert Implementation Plan

Add a 'Due Date' (`dueDate`) field to each subscriber in the subscribers management module, with visual red highlighting and warning badges when the payment due date is approaching (within 3 days or overdue).

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Alert Threshold**: Confirmed by user as **Within 3 days** (or overdue).
> - **Editing Locations**: Confirmed by user as **In add and edit subscriber modals**.

- **Confirmed Decision 1**: Add `dueDate` property to subscriber objects in local state and Firestore database sync.
- **Confirmed Decision 2**: Display due date column in subscribers table with automatic status badge (Normal, Due Soon / < 3 days, Overdue).
- **Confirmed Decision 3**: Add date picker input fields to both the "Add Subscriber" modal and "Edit Subscriber" modal.

## 1. Overview & Core Concept

- **What It Does**: Allows administrators and sellers to assign and track payment due dates for each subscriber. If a subscriber's due date is within 3 days or has passed, the row and date display will be highlighted in vivid red with warning indicators.
- **Key Value**: Prevents missed renewals, improves cash flow management, and provides instant visual clarity on at-risk subscriptions.

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. Opening Add/Edit Subscriber modal -> entering or selecting a due date (`dueDate` date input).
  2. Viewing Subscribers Table -> seeing the new "تاريخ الاستحقاق" (Due Date) column.
  3. Visual alerts -> rows or due date cells with approaching/expired due dates get styled with red text/background tags (e.g. `bg-red-50 text-red-700 border-red-200` or CSS equivalent).
- **Visual Identity & Theme**: Matches the existing Al-Sari system design (clean Arabic RTL layout, Tailwind CSS / custom styles, badge notifications).

## 3. Key Product Decisions & Trade-Offs

- **Decision 1**: Client-side date comparison against current date (midnight normalized).
  - *Why*: Simple, instantaneous, and resilient without complex backend schedulers.
- **Decision 2**: Storing as ISO date string (`YYYY-MM-DD`).
  - *Why*: Standard HTML `<input type="date">` compatibility and easy sorting/filtering.

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   Subscribers Module                   │
│  - Subscribers Table (RTL, Due Date Column, Badges)    │
│  - Add Subscriber Modal (Date Input Field)             │
│  - Edit Subscriber Modal (Date Input Field)            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Data & Sync Layer                    │
│  - Local State (`subscribers` array)                   │
│  - Firestore Persistence (`subscribers` collection)    │
└────────────────────────────────────────────────────────┘
```

- **Data Model**: Subscriber entity updated to include `dueDate?: string`.
- **Validation**: Ensure dates are valid strings.
- **Security Rules**: Firestore rules reviewed for subscriber document updates including `dueDate`.
