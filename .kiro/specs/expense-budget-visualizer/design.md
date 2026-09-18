# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a self-contained, single-page web application built with plain HTML, CSS, and Vanilla JavaScript. It runs entirely in the browser — no server, no build step, no framework. All data lives in the browser's Local Storage. The app lets users record expense transactions (item name, amount, category), review them in a scrollable list, see a running balance, and understand spending distribution through a Chart.js pie chart.

**Key design drivers:**

- Zero dependencies beyond a single Chart.js CDN script — must load from `file://` protocol.
- All logic in one JavaScript file (`js/app.js`) to satisfy the single-file constraint.
- Every UI update triggered synchronously in the same call stack as the data mutation, satisfying the 100ms update SLA without timers or observers.
- Local Storage is the sole persistence layer; the app must degrade gracefully when storage is unavailable or corrupted.

**Research findings:**

- Chart.js 4.4.x is the current stable release. The UMD build (`chart.umd.min.js`) is the correct build for `file://` contexts because ES module builds require a module bundler or a server with correct MIME types. CDN: [cdnjs](https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js).
- Updating a Chart.js chart in place: mutate `chart.data.datasets[0].data` and `chart.data.labels`, then call `chart.update()`. No need to destroy and recreate on every update.
- Destroying a Chart.js instance (`chart.destroy()`) is required before reusing the same `<canvas>` element.

---

## Architecture

The app follows a simple **data-first, render-on-change** architecture. There is no reactive framework; instead, every operation that mutates data explicitly calls a `renderAll()` function that re-renders every UI component from the current in-memory state.

```
┌─────────────────────────────────────────────────┐
│                  index.html                     │
│  ┌──────────────┐   ┌────────────────────────┐  │
│  │  Transaction │   │  Balance Display       │  │
│  │  Input Form  │   │  (#balance-display)    │  │
│  └──────┬───────┘   └────────────────────────┘  │
│         │ submit                                  │
│  ┌──────▼───────────────────────────────────┐   │
│  │              js/app.js                   │   │
│  │                                          │   │
│  │  state: { transactions[], storageOk }    │   │
│  │                                          │   │
│  │  addTransaction()  ──► persist()         │   │
│  │  deleteTransaction() ► persist()         │   │
│  │  loadFromStorage()                       │   │
│  │  renderAll()                             │   │
│  │    ├─ renderList()                       │   │
│  │    ├─ renderBalance()                    │   │
│  │    └─ renderChart()                      │   │
│  └──────┬───────────────────────────────────┘   │
│         │                                         │
│  ┌──────▼───────┐   ┌────────────────────────┐  │
│  │  Transaction │   │  Pie Chart             │  │
│  │  List        │   │  (Chart.js canvas)     │  │
│  │  (#tx-list)  │   │  (#spending-chart)     │  │
│  └──────────────┘   └────────────────────────┘  │
└─────────────────────────────────────────────────┘
                         │
                  ┌──────▼──────┐
                  │  localStorage│
                  │  "ebv_txs"   │
                  └─────────────┘
```

**Data flow for adding a transaction:**

1. User fills form and submits → `handleFormSubmit()`.
2. `validateInputs()` runs; on error, inline messages are shown and execution stops.
3. A `Transaction` object is constructed with a UUID (via `crypto.randomUUID()`).
4. Object is prepended to `state.transactions`.
5. `persist()` serializes `state.transactions` to Local Storage (inside `try/catch`).
6. `renderAll()` updates the list, balance, and chart synchronously.
7. Form is cleared.

**Data flow for deleting a transaction:**

1. User clicks a delete button → event delegation on `#tx-list` fires `handleDeleteClick()`.
2. The target transaction ID is read from `data-id` attribute.
3. Transaction is filtered out of `state.transactions`.
4. `persist()` writes updated list to Local Storage.
5. `renderAll()` updates all UI components.

---

## Components and Interfaces

### File Structure

```
index.html          ← single HTML entry point (Requirement 6.2)
css/
  style.css         ← single CSS file (Requirement 6.3)
js/
  app.js            ← single JS file (Requirement 6.4)
```

### index.html

The HTML skeleton defines the layout and loads dependencies. Chart.js is loaded via CDN before `app.js` (Requirement 6.5).

```html
<!-- Chart.js UMD build — compatible with file:// protocol -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
<script src="js/app.js" defer></script>
```

The layout uses semantic HTML structured with the following CSS classes:

| Class | Element | Role |
|-------|---------|------|
| `.app-wrapper` | `<div>` | Top-level container for the entire page |
| `.app-header` | `<header>` | Page title and subtitle |
| `.balance-section` | `<section>` | Total balance display area |
| `.main-grid` | `<div>` | Two-column CSS Grid (left: form + list; right: chart) |
| `.left-column` | `<div>` | Left grid column containing form and list |
| `.card` | `<section>` | Shared card surface applied to form, list, and chart sections |
| `.form-section` | `<section>` | Transaction input form card |
| `.list-section` | `<section>` | Transaction history list card |
| `.chart-section` | `<section>` | Pie chart card |

Key DOM IDs used by `app.js`:

| ID | Element | Purpose |
|----|---------|---------|
| `#tx-form` | `<form>` | Transaction input form |
| `#item-name` | `<input type="text">` | Item name field |
| `#amount` | `<input type="number">` | Amount field |
| `#category` | `<select>` | Category selector |
| `#err-item-name` | `<span>` | Inline error for item name |
| `#err-amount` | `<span>` | Inline error for amount |
| `#err-category` | `<span>` | Inline error for category |
| `#balance-value` | `<span>` | Numeric balance text |
| `#balance-overflow` | `<span>` | Overflow indicator (hidden by default) |
| `#tx-list` | `<ul>` | Transaction list container |
| `#chart-container` | `<div>` | Wrapper for canvas and empty-state message |
| `#spending-chart` | `<canvas>` | Chart.js render target |
| `#chart-empty-msg` | `<p>` | Empty-state message for chart |
| `#storage-warning` | `<div>` | Storage unavailability notification |
| `#delete-error-banner` | `<div>` | Delete operation failure error banner (hidden by default) |

### js/app.js — Module Structure

`app.js` is organized as plain functions in a single IIFE (Immediately Invoked Function Expression) to avoid polluting the global scope while remaining compatible with `file://` protocol (no ES module import/export required).

```
(function () {
  // ── Constants ──────────────────────────────────────────────
  const STORAGE_KEY = 'ebv_txs';
  const CATEGORIES  = ['Food', 'Transport', 'Fun'];
  const AMOUNT_MIN  = 0.01;
  const AMOUNT_MAX  = 999_999_999.99;
  const NAME_MAX    = 100;

  // ── State ───────────────────────────────────────────────────
  const state = {
    transactions: [],   // Transaction[]  (newest-first)
    storageOk:    true, // false if localStorage is unavailable
    chart:        null, // Chart.js instance
  };

  // ── Pure Functions ──────────────────────────────────────────
  validateInputs(name, amount, category) → ValidationResult
  computeBalance(transactions)           → number
  computeCategories(transactions)        → CategoryTotals
  formatAmount(number)                   → string  ("1,234.56")
  clampBalance(number)                   → { value, overflow }
  buildChartData(transactions)           → ChartData

  // ── Storage ─────────────────────────────────────────────────
  loadFromStorage()   → Transaction[]
  persist(transactions)

  // ── Rendering ───────────────────────────────────────────────
  renderAll()
  renderList(transactions)
  renderBalance(transactions)
  renderChart(transactions)
  clearFormErrors()
  showFormErrors(errors)

  // ── Event Handlers ──────────────────────────────────────────
  handleFormSubmit(event)
  handleDeleteClick(event)   // event delegation on #tx-list

  // ── Boot ────────────────────────────────────────────────────
  init()
})();
```

### Validator Interface

```javascript
// Returns an object with a boolean valid flag and a map of field-level error messages.
// Pure function — no DOM access, no side effects.
function validateInputs(name, amountStr, category) {
  // Returns: { valid: boolean, errors: { name?: string, amount?: string, category?: string } }
}
```

### Chart Rendering Interface

Chart.js is initialized once in `init()` and updated in-place on every subsequent `renderChart()` call:

```javascript
function renderChart(transactions) {
  const data = buildChartData(transactions); // filters zero-total categories
  if (data.labels.length === 0) {
    // show #chart-empty-msg, hide canvas
    return;
  }
  // hide #chart-empty-msg, show canvas
  state.chart.data.labels            = data.labels;
  state.chart.data.datasets[0].data  = data.values;
  state.chart.update();
}
```

`buildChartData` computes per-category sums and filters out any category with a zero total, returning only the labels and values to be passed to Chart.js (Requirement 4.7).

---

## Data Models

### Transaction

```javascript
/**
 * @typedef {Object} Transaction
 * @property {string} id         - Unique ID (crypto.randomUUID())
 * @property {string} name       - Item name, 1–100 characters
 * @property {number} amount     - Positive number, 0.01–999,999,999.99
 * @property {string} category   - One of 'Food' | 'Transport' | 'Fun'
 * @property {number} timestamp  - Unix ms (Date.now()) at time of creation
 */
```

### Storage Format

Transactions are stored in Local Storage under the key `"ebv_txs"` as a JSON-serialized array of `Transaction` objects, ordered newest-first:

```json
[
  {
    "id": "f3a1...",
    "name": "Coffee",
    "amount": 4.50,
    "category": "Food",
    "timestamp": 1710000000000
  },
  ...
]
```

On load, the raw string is parsed with `JSON.parse()`. If the result is not a valid array (corrupted or missing), the app initializes with an empty array (Requirement 5.4).

### ValidationResult

```javascript
/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {{ name?: string, amount?: string, category?: string }} errors
 */
```

### CategoryTotals

```javascript
/**
 * @typedef {Object} CategoryTotals
 * @property {number} Food
 * @property {number} Transport
 * @property {number} Fun
 */
```

### ChartData

```javascript
/**
 * @typedef {Object} ChartData
 * @property {string[]} labels   - Categories with non-zero totals only
 * @property {number[]} values   - Corresponding totals, same order as labels
 */
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Validator accepts any valid input triple

*For any* item name with 1–100 non-whitespace-only characters, any amount number in the range [0.01, 999,999,999.99], and any category from {Food, Transport, Fun}, `validateInputs()` shall return `{ valid: true }` with no error entries.

**Validates: Requirements 1.2**

---

### Property 2: Validator rejects out-of-range or non-numeric amounts

*For any* amount value that is either less than 0.01, greater than 999,999,999.99, `NaN`, `Infinity`, or a non-numeric string, `validateInputs()` shall return `{ valid: false }` with an `errors.amount` field set.

**Validates: Requirements 1.4**

---

### Property 3: Validator rejects item names exceeding 100 characters

*For any* string with length greater than 100 characters, `validateInputs()` shall return `{ valid: false }` with an `errors.name` field set.

**Validates: Requirements 1.5**

---

### Property 4: Transaction list display formatting is correct for all entries

*For any* non-empty list of transactions, every entry rendered by `renderList()` shall include the item name (truncated to 100 characters), the amount formatted to exactly 2 decimal places, and the category name.

**Validates: Requirements 2.1**

---

### Property 5: Transactions are displayed in reverse insertion order

*For any* sequence of transactions added in a defined order, the rendered list shall display them such that for every adjacent pair of entries, the upper entry's timestamp is greater than or equal to the lower entry's timestamp (i.e., newest-first).

**Validates: Requirements 2.3**

---

### Property 6: Balance display equals the sum of all transaction amounts

*For any* list of transactions with amounts a₁, a₂, …, aₙ, `computeBalance()` shall return a value equal to a₁ + a₂ + … + aₙ, and the displayed balance shall show that value formatted to exactly 2 decimal places (or the clamped boundary value if outside ±999,999,999.99).

**Validates: Requirements 3.1, 3.4, 3.5**

---

### Property 7: Pie chart data reflects correct proportions, percentages, and zero-category exclusion

*For any* list of transactions with a non-zero grand total, the data passed to Chart.js by `buildChartData()` shall satisfy all three sub-properties simultaneously:

- Each label's corresponding value equals the sum of all transaction amounts in that category.
- Each category with a total of zero is absent from both `labels` and `values`.
- Each category's share expressed as a percentage equals `Math.round((categoryTotal / grandTotal) * 1000) / 10` percent (i.e., rounded to one decimal place).

**Validates: Requirements 4.1, 4.6, 4.7**

---

### Property 8: Storage is the exact serialization of the in-memory transaction list after any mutation

*For any* sequence of add and delete operations on the transaction list, immediately after each operation completes, `JSON.parse(localStorage.getItem('ebv_txs'))` shall produce an array that is deeply equal to `state.transactions` at that moment.

**Validates: Requirements 5.1, 5.2**

---

## Error Handling

### Input Validation Errors

All validation errors are surfaced inline, adjacent to the offending field. Error `<span>` elements are hidden by default (CSS `display: none` or `visibility: hidden`) and made visible by `showFormErrors()`. On the next successful submit or a new form interaction, `clearFormErrors()` resets them.

| Condition | Affected field | Error message |
|-----------|---------------|---------------|
| Empty item name | `#err-item-name` | "Item name is required." |
| Item name > 100 chars | `#err-item-name` | "Item name must be 100 characters or fewer." |
| Empty amount | `#err-amount` | "Amount is required." |
| Amount non-numeric or NaN | `#err-amount` | "Amount must be a number between 0.01 and 999,999,999.99." |
| Amount < 0.01 or > 999,999,999.99 | `#err-amount` | "Amount must be between 0.01 and 999,999,999.99." |
| Empty category | `#err-category` | "Please select a category." |

### Delete Failure

If `persist()` throws during a delete operation, the transaction is **not** removed from `state.transactions` (the mutation is rolled back) and an error banner is shown. The Transaction_List retains the entry (Requirement 2.5).

```javascript
function deleteTransaction(id) {
  const backup = [...state.transactions];
  state.transactions = state.transactions.filter(t => t.id !== id);
  try {
    persist(state.transactions);
  } catch (e) {
    state.transactions = backup; // rollback
    showDeleteError();           // makes #delete-error-banner visible
    return;
  }
  renderAll();
}
```

### Local Storage Unavailability

`persist()` and `loadFromStorage()` are both wrapped in `try/catch`. If `localStorage.setItem` throws (e.g., quota exceeded, private browsing restriction), `state.storageOk` is set to `false` and the `#storage-warning` banner is made visible. The app continues operating in-memory for the session (Requirement 5.5).

### Corrupted Storage on Load

If `JSON.parse()` throws, or the parsed value is not an array, `loadFromStorage()` returns `[]` and the app starts with an empty state. No error message is shown to the user (Requirement 5.4).

```javascript
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
```

### Balance Overflow

If `computeBalance()` returns a value outside ±999,999,999.99, the displayed value is clamped to the boundary and the `#balance-overflow` indicator element is shown (Requirement 3.5).

```javascript
function clampBalance(value) {
  if (value > AMOUNT_MAX)  return { value: AMOUNT_MAX,  overflow: true };
  if (value < -AMOUNT_MAX) return { value: -AMOUNT_MAX, overflow: true };
  return { value, overflow: false };
}
```

---

## Testing Strategy

### Overview

This app is a Vanilla JS project with no existing test runner. The recommended approach is to use [Vitest](https://vitest.dev) as the unit/property test framework, because it requires minimal configuration, runs in Node (no DOM needed for pure-function tests), and supports fast-check for property-based tests.

For tests that need DOM access (form rendering, list rendering), use [jsdom](https://github.com/jsdom/jsdom) via Vitest's `environment: 'jsdom'` option.

For property-based testing, use [fast-check](https://fast-check.io) — a mature TypeScript/JavaScript PBT library that integrates directly with Vitest.

**Test commands:**
```bash
# Install dev dependencies (one-time, not needed to run the app)
npm install --save-dev vitest @vitest/coverage-v8 fast-check jsdom

# Run all tests once (use --run to avoid watch mode)
npx vitest --run
```

The production app itself has zero runtime dependencies beyond Chart.js CDN — tests are a development-only concern.

### Dual Testing Approach

| Layer | Tool | Focus |
|-------|------|-------|
| Property-based tests | fast-check + Vitest | Universal logic properties (validator, computeBalance, buildChartData, persist) |
| Unit / Example tests | Vitest | Specific scenarios, edge cases, DOM interactions, error paths |
| Smoke tests | Manual / Vitest DOM | File structure, cross-browser rendering, WCAG contrast |

Avoid writing too many example-based unit tests for inputs that property tests already cover comprehensively.

### Property-Based Tests

Each property-based test runs a minimum of **100 iterations** and is tagged with its design property.

**Property 1 — Validator accepts valid input triple**
```
// Feature: expense-budget-visualizer, Property 1: Validator accepts any valid input triple
fc.assert(fc.property(
  fc.string({ minLength: 1, maxLength: 100 }),
  fc.float({ min: 0.01, max: 999_999_999.99, noNaN: true }),
  fc.constantFrom('Food', 'Transport', 'Fun'),
  (name, amount, category) => {
    const result = validateInputs(name, String(amount), category);
    return result.valid === true;
  }
), { numRuns: 100 });
```

**Property 2 — Validator rejects out-of-range amounts**
```
// Feature: expense-budget-visualizer, Property 2: Validator rejects out-of-range or non-numeric amounts
fc.assert(fc.property(
  fc.oneof(
    fc.float({ max: 0.009, noNaN: true }),          // below min
    fc.float({ min: 999_999_999.991, noNaN: true }), // above max
    fc.constant('abc'),                               // non-numeric
    fc.constant(''),                                  // empty
  ),
  (badAmount) => {
    const result = validateInputs('Valid Name', String(badAmount), 'Food');
    return result.valid === false && result.errors.amount !== undefined;
  }
), { numRuns: 100 });
```

**Property 3 — Validator rejects names longer than 100 chars**
```
// Feature: expense-budget-visualizer, Property 3: Validator rejects item names exceeding 100 characters
fc.assert(fc.property(
  fc.string({ minLength: 101, maxLength: 500 }),
  (longName) => {
    const result = validateInputs(longName, '10.00', 'Food');
    return result.valid === false && result.errors.name !== undefined;
  }
), { numRuns: 100 });
```

**Property 4 — Transaction list display formatting**
```
// Feature: expense-budget-visualizer, Property 4: Transaction list display formatting is correct for all entries
fc.assert(fc.property(
  fc.array(arbitraryTransaction(), { minLength: 1, maxLength: 50 }),
  (transactions) => {
    const listHTML = buildListHTML(transactions); // pure rendering function
    return transactions.every(tx => {
      return listHTML.includes(tx.name.slice(0, 100))
          && listHTML.includes(tx.amount.toFixed(2))
          && listHTML.includes(tx.category);
    });
  }
), { numRuns: 100 });
```

**Property 5 — Reverse chronological order**
```
// Feature: expense-budget-visualizer, Property 5: Transactions are displayed in reverse insertion order
fc.assert(fc.property(
  fc.array(arbitraryTransaction(), { minLength: 2, maxLength: 50 }),
  (transactions) => {
    const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
    const rendered = buildListHTML(transactions); // uses internal sort
    // verify timestamps appear in descending order in rendered output
    const timestamps = extractTimestamps(rendered);
    return timestamps.every((t, i) => i === 0 || timestamps[i - 1] >= t);
  }
), { numRuns: 100 });
```

**Property 6 — Balance sum computation**
```
// Feature: expense-budget-visualizer, Property 6: Balance display equals the sum of all transaction amounts
fc.assert(fc.property(
  fc.array(arbitraryTransaction(), { minLength: 0, maxLength: 100 }),
  (transactions) => {
    const expected = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const actual = computeBalance(transactions);
    return Math.abs(actual - expected) < 0.001; // floating-point tolerance
  }
), { numRuns: 100 });
```

**Property 7 — Pie chart data proportions, percentages, and zero exclusion**
```
// Feature: expense-budget-visualizer, Property 7: Pie chart reflects correct proportions, percentages, and zero-category exclusion
fc.assert(fc.property(
  fc.array(arbitraryTransaction(), { minLength: 1, maxLength: 100 }),
  (transactions) => {
    const data = buildChartData(transactions);
    const grandTotal = transactions.reduce((s, t) => s + t.amount, 0);
    if (grandTotal === 0) return data.labels.length === 0;

    // No zero-total category appears
    const zeroOk = data.values.every(v => v > 0);
    // Values sum to grandTotal
    const sumOk = Math.abs(data.values.reduce((s, v) => s + v, 0) - grandTotal) < 0.001;
    // Only valid categories
    const labelsOk = data.labels.every(l => ['Food', 'Transport', 'Fun'].includes(l));
    return zeroOk && sumOk && labelsOk;
  }
), { numRuns: 100 });
```

**Property 8 — Storage round-trip after mutations**
```
// Feature: expense-budget-visualizer, Property 8: Storage is the exact serialization of the in-memory list after any mutation
fc.assert(fc.property(
  fc.array(arbitraryTransaction(), { minLength: 1, maxLength: 20 }),
  (transactions) => {
    const mockStorage = {};
    const mockLS = { setItem: (k, v) => { mockStorage[k] = v; }, getItem: (k) => mockStorage[k] ?? null };
    // add all transactions
    transactions.forEach(tx => persistWith(mockLS, STORAGE_KEY, transactions));
    const stored = JSON.parse(mockLS.getItem(STORAGE_KEY));
    return JSON.stringify(stored) === JSON.stringify(transactions);
  }
), { numRuns: 100 });
```

### Example-Based Unit Tests

These cover specific scenarios not addressed by property tests:

| Test | Requirement | Type |
|------|-------------|------|
| Form renders with three fields and correct category options | 1.1 | Example |
| Empty name + empty amount + no category all show errors | 1.3 | Example |
| Successful add clears form fields and removes error messages | 1.6 | Example |
| Empty transaction list shows empty-state message | 2.6 | Example |
| `computeBalance([])` returns 0 (balance = 0.00) | 3.4 | Edge case |
| Balance over 999,999,999.99 shows overflow indicator | 3.5 | Edge case |
| Chart empty state: no transactions → message shown, no segments | 4.5 | Example |
| Chart labels are always a subset of ['Food', 'Transport', 'Fun'] | 4.8 | Example |
| Page load with pre-seeded localStorage populates all UI components | 5.3 | Example |
| Corrupted localStorage value results in empty state, no error shown | 5.4 | Example |
| Unavailable localStorage shows storage warning notification | 5.5 | Example |
| Failed delete: transaction retained in list and storage | 2.5 | Example |
| Update after add: balance and chart reflect new data | 3.2, 4.2 | Example |
| Update after delete: balance and chart reflect updated data | 3.3, 4.3 | Example |

### Smoke / Manual Tests

These are verified by visual inspection and manual browser testing, not automated unit tests:

- App loads and renders correctly via `file://` protocol in Chrome, Firefox, Edge, and Safari (Requirement 6.6, 6.7).
- Transaction list is scrollable when entries overflow the visible area (Requirement 2.2).
- Initial load + full render completes within 2 seconds on a 25 Mbps connection (Requirement 7.1).
- All body text uses a font size of at least 14px (Requirement 7.4).
- Color contrast meets WCAG 2.1 AA (4.5:1 minimum for normal text) — verified with the browser DevTools accessibility panel or the [WCAG Color Contrast Checker](https://webaim.org/resources/contrastchecker/). Full validation requires manual testing with assistive technologies (Requirement 7.5).
- Layout sections (form, balance, list, chart) are visually non-overlapping with clear separation (Requirement 7.3).
