# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a self-contained, single-page expense tracker using plain HTML, CSS, and Vanilla JavaScript. All logic lives in `js/app.js` as a single IIFE. Chart.js 4.4.x is loaded via CDN. Data persists in Local Storage under the key `"ebv_txs"`. The implementation proceeds incrementally: scaffold → pure functions → storage → rendering → event handlers → boot.

## Tasks

- [x] 1. Create project file structure and HTML scaffold
  - Create `index.html` at the project root with the full DOM skeleton
  - Include all required element IDs: `#tx-form`, `#item-name`, `#amount`, `#category`, `#err-item-name`, `#err-amount`, `#err-category`, `#balance-value`, `#balance-overflow`, `#tx-list`, `#chart-container`, `#spending-chart`, `#chart-empty-msg`, `#storage-warning`
  - Add Chart.js UMD CDN `<script>` tag before `js/app.js` (defer): `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js`
  - Create empty `css/style.css` and `js/app.js` files with placeholder comments
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [x] 2. Implement CSS layout and visual styles
  - [x] 2.1 Write `css/style.css` with layout for all four sections: Transaction_Form, Balance_Display, Transaction_List, Pie_Chart
    - Use non-overlapping bounding areas with clear visual separation between sections
    - Set minimum 14px font size for all body text
    - Ensure color contrast meets WCAG 2.1 AA (4.5:1 minimum for normal text)
    - Style the `#storage-warning` and `#balance-overflow` elements as hidden by default (CSS `display: none`)
    - Style inline error `<span>` elements as hidden by default
    - Make `#tx-list` scrollable when content overflows
    - _Requirements: 2.2, 7.3, 7.4, 7.5_

- [x] 3. Implement pure helper functions in `js/app.js`
  - [x] 3.1 Set up the IIFE wrapper and declare constants and state object
    - Write the `(function () { ... })();` IIFE wrapper
    - Declare `STORAGE_KEY = 'ebv_txs'`, `CATEGORIES = ['Food', 'Transport', 'Fun']`, `AMOUNT_MIN = 0.01`, `AMOUNT_MAX = 999_999_999.99`, `NAME_MAX = 100`
    - Declare `state = { transactions: [], storageOk: true, chart: null }`
    - _Requirements: 6.1, 6.4_

  - [x] 3.2 Implement `validateInputs(name, amountStr, category)`
    - Return `{ valid: boolean, errors: { name?, amount?, category? } }`
    - Reject empty name; reject name longer than 100 characters
    - Reject empty amount; reject non-numeric or NaN amount; reject amount outside [0.01, 999,999,999.99]
    - Reject empty/unselected category
    - Use exact error messages from the design's error handling table
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.3 Write property tests for `validateInputs`
    - Install dev dependencies: `npm install --save-dev vitest fast-check jsdom`
    - Create `tests/pure.test.js`
    - **Property 1: Validator accepts any valid input triple** — `Validates: Requirements 1.2`
    - **Property 2: Validator rejects out-of-range or non-numeric amounts** — `Validates: Requirements 1.4`
    - **Property 3: Validator rejects item names exceeding 100 characters** — `Validates: Requirements 1.5`
    - _Requirements: 1.2, 1.4, 1.5_

  - [x] 3.4 Implement `computeBalance(transactions)`, `formatAmount(number)`, and `clampBalance(value)`
    - `computeBalance`: sum all `tx.amount` values; return 0 for empty array
    - `formatAmount`: format number to exactly 2 decimal places with thousands separator (e.g., `"1,234.56"`)
    - `clampBalance`: return `{ value, overflow: boolean }` — clamp to `±AMOUNT_MAX` and set `overflow: true` if out of range
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ]* 3.5 Write property test for `computeBalance`
    - **Property 6: Balance display equals the sum of all transaction amounts** — `Validates: Requirements 3.1, 3.4, 3.5`
    - _Requirements: 3.1, 3.4, 3.5_

  - [x] 3.6 Implement `computeCategories(transactions)` and `buildChartData(transactions)`
    - `computeCategories`: return `{ Food: number, Transport: number, Fun: number }` with totals per category
    - `buildChartData`: use `computeCategories` output; filter out zero-total categories; return `{ labels: string[], values: number[] }`
    - _Requirements: 4.1, 4.7, 4.8_

  - [ ]* 3.7 Write property test for `buildChartData`
    - **Property 7: Pie chart data reflects correct proportions, percentages, and zero-category exclusion** — `Validates: Requirements 4.1, 4.6, 4.7`
    - _Requirements: 4.1, 4.6, 4.7_

- [x] 4. Implement storage functions in `js/app.js`
  - [x] 4.1 Implement `loadFromStorage()` and `persist(transactions)`
    - `loadFromStorage`: wrap in `try/catch`; parse `localStorage.getItem(STORAGE_KEY)`; return `[]` if missing, non-array, or parse error
    - `persist`: wrap `localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))` in `try/catch`; on error set `state.storageOk = false` and show `#storage-warning`
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [ ]* 4.2 Write property test for storage round-trip
    - **Property 8: Storage is the exact serialization of the in-memory transaction list after any mutation** — `Validates: Requirements 5.1, 5.2`
    - Use a mock `localStorage` object to avoid real browser storage in tests
    - _Requirements: 5.1, 5.2_

- [x] 5. Checkpoint — Ensure pure functions and storage are correct
  - Ensure all non-optional tests pass, ask the user if questions arise.

- [x] 6. Implement rendering functions in `js/app.js`
  - [x] 6.1 Implement `renderList(transactions)`
    - Clear `#tx-list` and rebuild it from `state.transactions` (newest-first order — already stored newest-first)
    - Each list item shows: item name (truncated to 100 chars), amount formatted with `formatAmount` + currency symbol, category, and a delete button with `data-id` attribute set to `tx.id`
    - Show empty-state text in `#tx-list` when `transactions` is empty
    - _Requirements: 2.1, 2.3, 2.6_

  - [ ]* 6.2 Write property tests for `renderList`
    - Extract a pure `buildListHTML(transactions)` helper that `renderList` delegates to
    - **Property 4: Transaction list display formatting is correct for all entries** — `Validates: Requirements 2.1`
    - **Property 5: Transactions are displayed in reverse insertion order** — `Validates: Requirements 2.3`
    - _Requirements: 2.1, 2.3_

  - [x] 6.3 Implement `renderBalance(transactions)`
    - Call `computeBalance` then `clampBalance`
    - Set `#balance-value` text to `formatAmount(result.value)`
    - Show/hide `#balance-overflow` based on `result.overflow`
    - _Requirements: 3.1, 3.4, 3.5_

  - [x] 6.4 Implement `renderChart(transactions)` with Chart.js integration
    - On first call (when `state.chart` is null): initialize a `new Chart(canvas, { type: 'pie', ... })` and assign to `state.chart`
    - On subsequent calls: mutate `state.chart.data.labels`, `state.chart.data.datasets[0].data`, then call `state.chart.update()`
    - Call `buildChartData(transactions)` to get labels and values
    - If `data.labels.length === 0`: show `#chart-empty-msg`, hide `#spending-chart`; else hide message, show canvas
    - Include a legend entry per category showing name and percentage rounded to one decimal place
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 6.5 Implement `renderAll()`, `clearFormErrors()`, and `showFormErrors(errors)`
    - `renderAll`: call `renderList`, `renderBalance`, `renderChart` in sequence with `state.transactions`
    - `clearFormErrors`: hide all three `#err-*` spans and clear their text
    - `showFormErrors(errors)`: for each key in `errors`, show the corresponding `#err-*` span with the error message
    - _Requirements: 1.3, 1.4, 1.5, 3.2, 3.3, 4.2, 4.3_

- [x] 7. Implement event handlers and `addTransaction` / `deleteTransaction` in `js/app.js`
  - [x] 7.1 Implement `addTransaction(name, amountStr, category)` with form submission handler
    - Construct a `Transaction` object: `{ id: crypto.randomUUID(), name, amount: parseFloat(amountStr), category, timestamp: Date.now() }`
    - Prepend to `state.transactions` (newest-first)
    - Call `persist(state.transactions)` then `renderAll()`
    - Implement `handleFormSubmit(event)`: call `event.preventDefault()`, call `clearFormErrors()`, call `validateInputs`; on failure call `showFormErrors(result.errors)` and return; on success call `addTransaction` and reset the form
    - Attach listener: `document.getElementById('tx-form').addEventListener('submit', handleFormSubmit)`
    - _Requirements: 1.2, 1.3, 1.6, 5.1, 7.2_

  - [x] 7.2 Implement `deleteTransaction(id)` with event delegation handler
    - Use backup/rollback pattern: save `[...state.transactions]` before filtering; on `persist` throw, restore backup, call `showDeleteError()`, and return
    - On success: call `renderAll()`
    - Implement `handleDeleteClick(event)`: use `event.target.closest('[data-id]')` to find the delete button; read `dataset.id`; call `deleteTransaction(id)`
    - Attach listener: `document.getElementById('tx-list').addEventListener('click', handleDeleteClick)`
    - _Requirements: 2.4, 2.5, 5.2, 7.2_

- [x] 8. Implement `init()` boot function and wire everything together
  - [x] 8.1 Implement `init()` and invoke it at the end of the IIFE
    - Call `loadFromStorage()` and assign result to `state.transactions`
    - Initialize the Chart.js instance on `#spending-chart` (before first `renderAll` call to avoid null reference in `renderChart`)
    - Call `renderAll()` to populate the full UI from stored data
    - If `state.storageOk` is false after load, show `#storage-warning`
    - Call `init()` as the last statement inside the IIFE
    - _Requirements: 5.3, 5.4, 5.5, 6.6_

- [x] 9. Final checkpoint — Full integration verification
  - Ensure all non-optional tests pass, ask the user if questions arise.
  - Verify the app opens correctly via `file://` protocol in a browser (no server needed).
  - Confirm Chart.js loads from CDN and the pie chart renders on first transaction.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP — no test setup is required to run the app.
- Each task references specific requirements for traceability.
- Checkpoints (tasks 5 and 9) ensure incremental validation before proceeding.
- Property tests validate universal correctness properties defined in `design.md`.
- The production app has zero runtime dependencies beyond the Chart.js CDN script — test tooling (Vitest, fast-check, jsdom) is development-only.
- Pure functions (`validateInputs`, `computeBalance`, `buildChartData`, etc.) must be exported or extracted to a testable scope if tests are written — use a `window.__ebv` shim inside the IIFE for test access, or extract them into a separate module only if testing is opted in.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["3.1"] },
    { "id": 1, "tasks": ["2.1", "3.2", "3.4", "3.6", "4.1"] },
    { "id": 2, "tasks": ["3.3", "3.5", "3.7", "4.2", "6.1", "6.3"] },
    { "id": 3, "tasks": ["6.2", "6.4", "6.5"] },
    { "id": 4, "tasks": ["7.1", "7.2"] },
    { "id": 5, "tasks": ["8.1"] }
  ]
}
```
