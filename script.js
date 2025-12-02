// ------------------------------
// SessionStorage Keys
// ------------------------------
const ORDERS_KEY = 'orders';
const LAST_ORDER_KEY = 'lastOrderNumber';

// ------------------------------
// SessionStorage helpers
// ------------------------------
function getOrders() {
  const raw = sessionStorage.getItem(ORDERS_KEY);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function setOrders(orders) {
  sessionStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  const last = orders.reduce((max, o) => Math.max(max, o.orderNumber || 0), 0);
  const storedLast = Number(sessionStorage.getItem(LAST_ORDER_KEY) || 0);
  if (last > storedLast) sessionStorage.setItem(LAST_ORDER_KEY, String(last));
}

function getNextOrderNumber() {
  const orders = getOrders();
  const countBased = orders.length + 1;           
  const lastStored = Number(sessionStorage.getItem(LAST_ORDER_KEY) || 0) + 1;
  const next = Math.max(countBased, lastStored);
  sessionStorage.setItem(LAST_ORDER_KEY, String(next));
  return next;
}

// ------------------------------
// TheMealDB helpers
// ------------------------------
function normalizeIngredient(input) {
  return input.trim().toLowerCase().replace(/\s+/g, '_');
}
async function fetchMealsByIngredient(ingredient) {
  const url = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredient)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json(); 
}
function pickRandomMeal(meals) {
  const idx = Math.floor(Math.random() * meals.length);
  return meals[idx];
}

// ------------------------------
// DOM utilities
// ------------------------------
function showFeedback(el, message, type = 'info') {
  el.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
}
// Replace your existing renderOrders() with these:

function renderIncompleteOrders() {
  const listEl = document.getElementById('ordersList');
  const emptyEl = document.getElementById('ordersEmpty');
  listEl.innerHTML = '';
  const orders = getOrders().filter(o => o.status === 'incomplete');

  if (!orders.length) {
    emptyEl.classList.remove('d-none');
    return;
  }
  emptyEl.classList.add('d-none');

  orders.forEach(o => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-start';
    li.innerHTML = `
      <div class="ms-2 me-auto">
        <div class="fw-bold">Order #${o.orderNumber}</div>
        ${o.description}
      </div>
      <span class="badge text-bg-warning rounded-pill">${o.status}</span>
    `;
    listEl.appendChild(li);
  });
}

function renderCompletedOrders() {
  const listEl = document.getElementById('completedList');
  const emptyEl = document.getElementById('completedEmpty');
  if (!listEl || !emptyEl) return; // in case the card was temporarily removed

  listEl.innerHTML = '';
  const orders = getOrders().filter(o => o.status === 'completed');

  if (!orders.length) {
    emptyEl.classList.remove('d-none');
    return;
  }
  emptyEl.classList.add('d-none');

  orders.forEach(o => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-start';
    li.innerHTML = `
      <div class="ms-2 me-auto">
        <div class="fw-bold">Order #${o.orderNumber}</div>
        ${o.description}
      </div>
      <span class="badge text-bg-success rounded-pill">${o.status}</span>
    `;
    listEl.appendChild(li);
  });
}

function renderAllOrders() {
  renderIncompleteOrders();
  renderCompletedOrders();
}

// ------------------------------
// Event handlers
// ------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const orderForm = document.getElementById('orderForm');
  const ingredientInput = document.getElementById('ingredientInput');
  const orderFeedback = document.getElementById('orderFeedback');

  const completeForm = document.getElementById('completeForm');
  const orderNumberInput = document.getElementById('orderNumberInput');
  const completeFeedback = document.getElementById('completeFeedback');

  const clearAllBtn = document.getElementById('clearAllBtn');

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = ingredientInput.value;
    if (!raw.trim()) {
      showFeedback(orderFeedback, 'Please enter an ingredient.', 'warning');
      return;
    }

    const norm = normalizeIngredient(raw);
    try {
      showFeedback(orderFeedback, `Looking up meals that use <strong>${norm}</strong>…`, 'info');
      const data = await fetchMealsByIngredient(norm);

      if (!data.meals) {
        showFeedback(
          orderFeedback,
          `No meals found for <strong>${norm}</strong>. Try another ingredient (e.g. <code>beef</code>, <code>lemon</code>, <code>mint</code>).`,
          'danger'
        );
        ingredientInput.focus();
        return;
      }

      const meal = pickRandomMeal(data.meals);
      const order = {
        orderNumber: getNextOrderNumber(),
        description: meal.strMeal,
        status: 'incomplete'
      };

      const orders = getOrders();
      orders.push(order);
      setOrders(orders);

      showFeedback(orderFeedback, `Order <strong>#${order.orderNumber}</strong> created: <em>${order.description}</em>.`, 'success');
      ingredientInput.value = '';
      renderAllOrders();
    } catch (err) {
      console.error(err);
      showFeedback(orderFeedback, 'Could not reach TheMealDB right now. Please try again.', 'danger');
    }
  });

  completeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const num = Number(orderNumberInput.value);

    if (Number.isNaN(num)) {
      showFeedback(completeFeedback, 'Please enter a valid number.', 'warning');
      return;
    }
    if (num === 0) {
      showFeedback(completeFeedback, 'No order was completed.');
      orderNumberInput.value = '';
      return;
    }

    const orders = getOrders();
    const idx = orders.findIndex(o => o.orderNumber === num);
    if (idx === -1) {
      showFeedback(completeFeedback, `Order #${num} does not exist.`, 'danger');
      return;
    }

    orders[idx].status = 'completed';
    setOrders(orders);
    showFeedback(completeFeedback, `Order <strong>#${num}</strong> marked as completed.`, 'success');
    orderNumberInput.value = '';
    renderAllOrders();
  });

  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Clear all orders from this session?')) return;
    sessionStorage.removeItem(ORDERS_KEY);
    sessionStorage.removeItem(LAST_ORDER_KEY);
    renderAllOrders();
    showFeedback(orderFeedback, 'All orders cleared for this session.', 'warning');
  });

  renderAllOrders();
});
