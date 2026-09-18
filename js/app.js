(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────────
  const STORAGE_KEY = 'ebv_txs';
  const CATEGORIES  = ['Food', 'Transport', 'Fun'];
  const AMOUNT_MIN  = 0.01;
  const AMOUNT_MAX  = 999_999_999.99;
  const NAME_MAX    = 100;

  // ── State ────────────────────────────────────────────────────────────────────
  const state = {
    transactions: [], // Transaction[]  (newest-first)
    storageOk:    true, // false if localStorage is unavailable
    chart:        null, // Chart.js instance
  };

  // ── Pure Functions ───────────────────────────────────────────────────────────

  /**
   * Validates the transaction form inputs.
   * Pure function — no DOM access, no side effects.
   *
   * @param {string} name        - Raw value from #item-name
   * @param {string} amountStr   - Raw value from #amount (as string)
   * @param {string} category    - Raw value from #category
   * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
   */
  function validateInputs(name, amountStr, category) {
    const errors = {};

    // ── Name validation ──────────────────────────────────────────────────────
    if (!name || name.trim().length === 0) {
      errors.name = 'Item name is required.';
    } else if (name.length > NAME_MAX) {
      errors.name = 'Item name must be 100 characters or fewer.';
    }

    // ── Amount validation ────────────────────────────────────────────────────
    if (amountStr === '' || amountStr == null) {
      errors.amount = 'Amount is required.';
    } else {
      const num = Number(amountStr);
      if (isNaN(num) || !isFinite(num)) {
        errors.amount = 'Amount must be a number between 0.01 and 999,999,999.99.';
      } else if (num < AMOUNT_MIN || num > AMOUNT_MAX) {
        errors.amount = 'Amount must be between 0.01 and 999,999,999.99.';
      }
    }

    // ── Category validation ──────────────────────────────────────────────────
    if (!category || !CATEGORIES.includes(category)) {
      errors.category = 'Please select a category.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Returns the sum of all transaction amounts.
   * Returns 0 for an empty array.
   * @param {Transaction[]} transactions
   * @returns {number}
   */
  function computeBalance(transactions) {
    return transactions.reduce(function (sum, tx) {
      return sum + tx.amount;
    }, 0);
  }

  /**
   * Formats a number as a currency string with exactly 2 decimal places.
   * e.g. 1234.56 → "$1,234.56"
   * @param {number} number
   * @returns {string}
   */
  function formatAmount(number) {
    return '$' + number.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Clamps a balance value to ±AMOUNT_MAX.
   * Returns { value, overflow: false } when within range,
   * or { value: boundary, overflow: true } when out of range.
   * @param {number} value
   * @returns {{ value: number, overflow: boolean }}
   */
  function clampBalance(value) {
    if (value > AMOUNT_MAX)  return { value: AMOUNT_MAX,  overflow: true };
    if (value < -AMOUNT_MAX) return { value: -AMOUNT_MAX, overflow: true };
    return { value: value, overflow: false };
  }

  /**
   * Computes the total amount spent per category.
   * Pure function — no DOM access, no side effects.
   *
   * @param {Transaction[]} transactions
   * @returns {{ Food: number, Transport: number, Fun: number }}
   */
  function computeCategories(transactions) {
    const totals = { Food: 0, Transport: 0, Fun: 0 };
    for (const tx of transactions) {
      if (Object.prototype.hasOwnProperty.call(totals, tx.category)) {
        totals[tx.category] += tx.amount;
      }
    }
    return totals;
  }

  /**
   * Builds the data payload for Chart.js from a list of transactions.
   * Filters out any category whose total is zero.
   * Only the three fixed categories (Food, Transport, Fun) may appear.
   * Pure function — no DOM access, no side effects.
   *
   * @param {Transaction[]} transactions
   * @returns {{ labels: string[], values: number[] }}
   */
  function buildChartData(transactions) {
    const totals = computeCategories(transactions);
    const labels = [];
    const values = [];
    for (const category of CATEGORIES) {
      if (totals[category] > 0) {
        labels.push(category);
        values.push(totals[category]);
      }
    }
    return { labels, values };
  }

  // ── Storage ──────────────────────────────────────────────────────────────────

  /**
   * Shows the storage-unavailable warning banner.
   */
  function showStorageWarning() {
    const el = document.getElementById('storage-warning');
    if (el) el.style.display = 'block';
  }

  /**
   * Loads transactions from localStorage.
   * Returns [] if storage is unavailable, the key is missing, the value is not
   * a valid JSON array, or JSON.parse throws.
   *
   * @returns {Transaction[]}
   */
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Serializes transactions to JSON and writes them to localStorage.
   * On any failure sets state.storageOk = false and shows the warning banner.
   *
   * @param {Transaction[]} transactions
   */
  function persist(transactions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      state.storageOk = false;
      showStorageWarning();
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  /**
   * Renders the running balance in the #balance-value element.
   * Clamps the balance to ±AMOUNT_MAX and shows/hides the overflow indicator.
   *
   * @param {Transaction[]} transactions
   */
  function renderBalance(transactions) {
    const raw    = computeBalance(transactions);
    const clamped = clampBalance(raw);

    const balanceEl  = document.getElementById('balance-value');
    const overflowEl = document.getElementById('balance-overflow');

    if (balanceEl)  balanceEl.textContent = formatAmount(clamped.value);

    if (overflowEl) {
      if (clamped.overflow) {
        overflowEl.classList.add('visible');
      } else {
        overflowEl.classList.remove('visible');
      }
    }
  }

  /**
   * Clears #tx-list and rebuilds it from the given transactions array.
   * Transactions are expected to be already sorted newest-first.
   * Shows an empty-state message when the array is empty.
   *
   * @param {Transaction[]} transactions
   */
  function renderList(transactions) {
    const list = document.getElementById('tx-list');
    list.innerHTML = '';

    if (transactions.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'tx-empty-msg';
      empty.textContent = 'No transactions yet.';
      list.appendChild(empty);
      return;
    }

    for (const tx of transactions) {
      const name = tx.name.slice(0, 100);
      const badgeClass = 'category-badge category-badge--' + tx.category.toLowerCase();

      const li = document.createElement('li');
      li.className = 'tx-item';

      // Body: name + meta
      const body = document.createElement('div');
      body.className = 'tx-item-body';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'tx-item-name';
      nameSpan.textContent = name;

      const metaSpan = document.createElement('span');
      metaSpan.className = 'tx-item-meta';

      const badge = document.createElement('span');
      badge.className = badgeClass;
      badge.textContent = tx.category;

      metaSpan.appendChild(badge);
      body.appendChild(nameSpan);
      body.appendChild(metaSpan);

      // Amount
      const amountSpan = document.createElement('span');
      amountSpan.className = 'tx-item-amount';
      amountSpan.textContent = formatAmount(tx.amount);

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.dataset.id = tx.id;
      deleteBtn.textContent = 'Delete';

      li.appendChild(body);
      li.appendChild(amountSpan);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    }
  }

  /**
   * Clears all inline form error messages and resets error styling.
   * Hides #err-item-name, #err-amount, #err-category and removes
   * the 'has-error' class from their parent .form-group elements.
   */
  function clearFormErrors() {
    const fieldMap = [
      { spanId: 'err-item-name' },
      { spanId: 'err-amount'    },
      { spanId: 'err-category'  },
    ];

    for (const { spanId } of fieldMap) {
      const span = document.getElementById(spanId);
      if (!span) continue;
      span.textContent = '';
      span.classList.remove('visible');
      span.style.display = '';

      // Walk up to the nearest .form-group ancestor and remove has-error
      let parent = span.parentElement;
      while (parent) {
        if (parent.classList.contains('form-group')) {
          parent.classList.remove('has-error');
          break;
        }
        parent = parent.parentElement;
      }
    }
  }

  /**
   * Displays inline form errors produced by validateInputs().
   * For each key in the errors object, shows the corresponding error span
   * and marks the parent .form-group with 'has-error'.
   *
   * @param {{ name?: string, amount?: string, category?: string }} errors
   */
  function showFormErrors(errors) {
    const fieldMap = {
      name:     'err-item-name',
      amount:   'err-amount',
      category: 'err-category',
    };

    for (const [field, spanId] of Object.entries(fieldMap)) {
      if (!errors[field]) continue;

      const span = document.getElementById(spanId);
      if (!span) continue;
      span.textContent = errors[field];
      span.classList.add('visible');
      span.style.display = 'block';

      // Walk up to the nearest .form-group ancestor and add has-error
      let parent = span.parentElement;
      while (parent) {
        if (parent.classList.contains('form-group')) {
          parent.classList.add('has-error');
          break;
        }
        parent = parent.parentElement;
      }
    }
  }

  /**
   * Updates the Chart.js pie chart to reflect the current transactions.
   * Shows or hides the empty-state message based on whether there is data.
   *
   * This function only UPDATES an existing state.chart instance — it does NOT
   * create one. Chart initialization happens once in init(). If state.chart is
   * null this function is a no-op.
   *
   * Legend labels include the percentage share, e.g. "Food (45.2%)".
   *
   * @param {Transaction[]} transactions
   */
  function renderChart(transactions) {
    // Guard: chart must be initialized in init() before this function runs.
    if (!state.chart) return;

    const emptyMsg = document.getElementById('chart-empty-msg');
    const canvas   = document.getElementById('spending-chart');

    const data = buildChartData(transactions);

    if (data.labels.length === 0) {
      // No data — show placeholder message, hide canvas.
      if (emptyMsg) emptyMsg.classList.add('visible');
      if (canvas)   canvas.style.display = 'none';
      return;
    }

    // There is data — hide placeholder, ensure canvas is visible.
    if (emptyMsg) emptyMsg.classList.remove('visible');
    if (canvas)   canvas.style.display = '';

    // Compute grand total for percentage calculations.
    const grandTotal = data.values.reduce(function (sum, v) { return sum + v; }, 0);

    // Build labels that embed the rounded-to-one-decimal percentage,
    // e.g. "Food (45.2%)". This makes the built-in Chart.js legend show
    // both the category name and its share without a custom plugin.
    const labelsWithPct = data.labels.map(function (label, i) {
      const pct = Math.round((data.values[i] / grandTotal) * 1000) / 10;
      return label + ' (' + pct + '%)';
    });

    // Update the existing Chart.js instance in-place (avoids destroy/recreate).
    state.chart.data.labels           = labelsWithPct;
    state.chart.data.datasets[0].data = data.values;
    state.chart.update();
  }

  /**
   * Re-renders all UI components from the current in-memory state.
   * Call this after any mutation to state.transactions.
   */
  function renderAll() {
    renderList(state.transactions);
    renderBalance(state.transactions);
    renderChart(state.transactions);
  }

  // ── Event Handlers ──────────────────────────────────────────────────────────

  /**
   * Handles the #tx-form submit event.
   * Validates inputs, constructs a Transaction, prepends it to state, persists,
   * re-renders, and resets the form. Shows inline errors on failure.
   *
   * @param {Event} event
   */
  function handleFormSubmit(event) {
    event.preventDefault();

    const nameEl     = document.getElementById('item-name');
    const amountEl   = document.getElementById('amount');
    const categoryEl = document.getElementById('category');

    const name      = nameEl     ? nameEl.value     : '';
    const amountStr = amountEl   ? amountEl.value   : '';
    const category  = categoryEl ? categoryEl.value : '';

    clearFormErrors();

    const result = validateInputs(name, amountStr, category);
    if (!result.valid) {
      showFormErrors(result.errors);
      return;
    }

    // Construct and prepend the new transaction (newest-first order).
    const transaction = {
      id:        crypto.randomUUID(),
      name:      name.trim(),
      amount:    parseFloat(amountStr),
      category:  category,
      timestamp: Date.now(),
    };

    state.transactions.unshift(transaction);
    persist(state.transactions);
    renderAll();

    // Reset form fields to their default empty values.
    if (nameEl)     nameEl.value     = '';
    if (amountEl)   amountEl.value   = '';
    if (categoryEl) categoryEl.value = '';
    clearFormErrors();
  }

  // Attach the form submit listener.
  document.getElementById('tx-form').addEventListener('submit', handleFormSubmit);

  /**
   * Deletes a transaction by ID.
   * Backs up the current list before mutation; restores it and shows an error
   * banner if persist() throws (e.g. storage quota exceeded).
   *
   * @param {string} id - The transaction ID to remove
   */
  function deleteTransaction(id) {
    const backup = [...state.transactions];
    state.transactions = state.transactions.filter(function (t) { return t.id !== id; });

    const errorBanner = document.getElementById('delete-error-banner');

    try {
      persist(state.transactions);
    } catch (e) {
      // Rollback in-memory state and surface the error
      state.transactions = backup;
      if (errorBanner) {
        errorBanner.style.display = 'block';
        errorBanner.classList.add('visible');
      }
      return;
    }

    // Success — hide any previous error banner and re-render
    if (errorBanner) {
      errorBanner.style.display = '';
      errorBanner.classList.remove('visible');
    }
    renderAll();
  }

  /**
   * Event delegation handler for delete clicks on #tx-list.
   * Looks for the closest .btn-delete ancestor of the clicked target;
   * reads its data-id attribute and calls deleteTransaction().
   *
   * @param {MouseEvent} event
   */
  function handleDeleteClick(event) {
    const button = event.target.closest('.btn-delete');
    if (!button) return;

    const id = button.dataset.id;
    deleteTransaction(id);
  }

  // Attach the delete listener via event delegation on the transaction list.
  document.getElementById('tx-list').addEventListener('click', handleDeleteClick);

  // ── Boot ────────────────────────────────────────────────────────────────────

  /**
   * Initializes the application:
   *  1. Detects localStorage availability and shows a warning if unavailable.
   *  2. Loads persisted transactions from localStorage.
   *  3. Creates the Chart.js pie chart instance on #spending-chart.
   *  4. Calls renderAll() to populate the full UI from stored data.
   */
  function init() {
    // 1. Detect localStorage availability.
    try {
      localStorage.setItem('__test', '1');
      localStorage.removeItem('__test');
    } catch (e) {
      state.storageOk = false;
      showStorageWarning();
    }

    // 2. Load persisted transactions (returns [] on any failure).
    state.transactions = loadFromStorage();

    // 3. Initialize the Chart.js pie chart instance once.
    state.chart = new Chart(document.getElementById('spending-chart'), {
      type: 'pie',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: ['#4caf50', '#2196f3', '#e91e63'],
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                return ' ' + label + ': $' + value.toFixed(2);
              },
            },
          },
        },
      },
    });

    // 4. Render the full UI from whatever was loaded.
    renderAll();

    // 5. If storage was unavailable at load time, keep the warning visible.
    if (!state.storageOk) {
      showStorageWarning();
    }
  }

  // Kick everything off.
  init();

})();
