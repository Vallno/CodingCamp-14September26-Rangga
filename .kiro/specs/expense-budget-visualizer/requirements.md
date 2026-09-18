# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses by entering transactions (item name, amount, category), viewing a running total balance, and understanding spending distribution through a visual pie chart. The app stores all data in the browser's Local Storage and requires no backend server, no frameworks, and no external build tools. It must function as a standalone HTML/CSS/Vanilla JS web app or as a browser extension.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry composed of an item name, a monetary amount, and a category.
- **Transaction_Form**: The UI form component through which users submit new transactions.
- **Transaction_List**: The scrollable UI component that displays all saved transactions.
- **Balance_Display**: The UI component at the top of the page that shows the computed total balance.
- **Pie_Chart**: The visual chart component that shows the proportional spending breakdown by category.
- **Storage**: The browser's Local Storage API used to persist transaction data client-side.
- **Category**: One of three fixed expense groupings — Food, Transport, or Fun.
- **Validator**: The input validation logic that checks form fields before a transaction is saved.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to enter an expense transaction through a form, so that I can record what I spent, how much, and in which category.

#### Acceptance Criteria

1. THE App SHALL render the Transaction_Form containing three fields: Item Name (text, max 100 characters), Amount (numeric, range 0.01–999,999,999.99), and Category (select with options: Food, Transport, Fun).
2. WHEN the user submits the Transaction_Form with all fields filled and a valid Amount between 0.01 and 999,999,999.99 inclusive, THE Validator SHALL accept the submission and add the transaction to the Transaction_List.
3. WHEN the user submits the Transaction_Form with one or more empty fields, THE Validator SHALL reject the submission and display an inline error message below each empty field identifying the missing field.
4. WHEN the user submits the Transaction_Form with an Amount value outside the range 0.01–999,999,999.99 or non-numeric, THE Validator SHALL reject the submission and display an inline error message indicating the Amount must be between 0.01 and 999,999,999.99.
5. WHEN the user submits the Transaction_Form with an Item Name exceeding 100 characters, THE Validator SHALL reject the submission and display an inline error message indicating the maximum length.
6. WHEN a transaction is successfully added, THE Transaction_Form SHALL clear all fields and return to its default empty state with no error messages visible.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list, so that I can review my spending history and remove entries I no longer need.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored transactions, each showing the item name (truncated at 100 characters), amount formatted to 2 decimal places with a currency symbol, and category.
2. WHILE the number of transactions exceeds the visible area of the Transaction_List, THE Transaction_List SHALL remain scrollable to allow access to all entries.
3. THE Transaction_List SHALL display transactions in reverse chronological insertion order, with the most recently added entry appearing first.
4. WHEN a user activates the delete control on a transaction entry, THE Transaction_List SHALL remove that transaction from the list and from Storage within 1 second of activation.
5. WHEN a delete operation fails, THE Transaction_List SHALL retain the transaction in both the list and Storage and display an error message indicating the deletion could not be completed.
6. WHEN no transactions have been recorded, THE Transaction_List SHALL display an empty-state message indicating there are no transactions yet.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total amount spent at the top of the page, so that I can quickly understand my cumulative expenditure.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all transaction amounts stored in Storage, formatted as a numeric value with exactly 2 decimal places.
2. WHEN a transaction is added, THE Balance_Display SHALL update to reflect the new total within 100ms of the transaction being saved.
3. WHEN a transaction is deleted, THE Balance_Display SHALL update to reflect the new total within 100ms of the deletion being saved.
4. WHEN no transactions exist, THE Balance_Display SHALL show a total of 0.00.
5. IF the computed total exceeds ±999,999,999.99, THE Balance_Display SHALL clamp the displayed value to the boundary and show a visual indicator that the total is out of the normal display range.

---

### Requirement 4: Visual Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand how my budget is distributed across Food, Transport, and Fun.

#### Acceptance Criteria

1. THE Pie_Chart SHALL display each Category as a distinct segment where the arc angle equals (category total / grand total) × 360°, sized proportionally to its share of total spending.
2. WHEN a transaction is added, THE Pie_Chart SHALL update to reflect the new category distribution within 100ms of the transaction being saved.
3. WHEN a transaction is deleted, THE Pie_Chart SHALL update to reflect the new category distribution within 100ms of the deletion being saved.
4. WHEN only one Category contains transactions, THE Pie_Chart SHALL display a single full-circle segment (360°) for that Category.
5. WHEN no transactions exist, THE Pie_Chart SHALL display a text message indicating no spending data and render no segments.
6. THE Pie_Chart SHALL include a legend where each entry shows the category name and its percentage of total spending rounded to one decimal place.
7. WHERE a Category has a total spending of zero, THE Pie_Chart SHALL omit that category from both the segments and the legend.
8. THE Pie_Chart SHALL only render segments for the three fixed categories: Food, Transport, and Fun.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my expense history when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a transaction is successfully added, THE Storage SHALL persist the transaction data to Local Storage as a serialized list of all current transactions before the Transaction_List is updated.
2. WHEN a transaction is deleted, THE Storage SHALL remove that transaction's entry from Local Storage and overwrite the stored list with the updated transactions before the Transaction_List is updated.
3. WHEN the App loads, THE App SHALL read all transactions from Local Storage and populate the Transaction_List, Balance_Display, and Pie_Chart with the stored data within 500 milliseconds.
4. IF Local Storage data is missing or corrupted, THEN THE App SHALL initialize with an empty transaction list, restore the Balance_Display to 0.00, clear the Pie_Chart, and display no error message to the user.
5. IF Local Storage is unavailable or write access is denied, THEN THE App SHALL continue operating in-memory for the current session and display a notification to the user indicating that transaction data will not be saved.

---

### Requirement 6: Technology and Project Structure Constraints

**User Story:** As a developer, I want the app built with plain HTML, CSS, and Vanilla JavaScript in a defined folder structure, so that the codebase is simple, portable, and requires no build tools.

#### Acceptance Criteria

1. THE App SHALL be implemented using only HTML, CSS, and Vanilla JavaScript with no frontend frameworks, transpilers, module bundlers, or backend server.
2. THE App SHALL have exactly one HTML entry point file located at the project root.
3. THE App SHALL contain exactly one CSS file located inside a `css/` directory.
4. THE App SHALL contain exactly one JavaScript file located inside a `js/` directory.
5. WHERE a charting library is used, THE App SHALL load the library via a CDN `<script>` tag and SHALL NOT require a package manager or build step to run.
6. THE App SHALL function correctly when opened via direct file loading (file:// protocol) in a browser without requiring a local server.
7. THE App SHALL function correctly in current stable releases of Chrome, Firefox, Edge, and Safari without requiring browser extensions or polyfills.

---

### Requirement 7: Performance and Visual Design

**User Story:** As a user, I want the app to load quickly and have a clean, readable interface, so that I can use it efficiently without distraction.

#### Acceptance Criteria

1. THE App SHALL complete its initial load and render the full UI within 2 seconds on a connection with at least 25 Mbps download speed and no more than 50ms latency.
2. WHEN the user submits an input or selects an item in the Transaction_Form or Transaction_List, THE App SHALL reflect the result of that interaction within 100ms.
3. THE App SHALL lay out the Transaction_Form, Balance_Display, Transaction_List, and Pie_Chart in non-overlapping bounding areas with clear visual separation between each section.
4. THE App SHALL use a font size of at least 14px for all body text to ensure readability.
5. THE App SHALL apply sufficient color contrast between text and background elements to meet WCAG 2.1 AA contrast ratio requirements (minimum 4.5:1 for normal text).
6. WHEN the Pie_Chart finishes rendering after page load, THE Pie_Chart SHALL complete its render within 100ms of the Transaction_List finishing its initial population.
