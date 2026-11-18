 // Replace with your live Render/Railway server URL
const BACKEND_URL = "https://nevaxban.onrender.com";

const state = {
  items: JSON.parse(localStorage.getItem("nvx_bag") || "[]"),
  phone: localStorage.getItem("nvx_phone") || "",
  score: 0
};

function kes(n) {
  return "KES " + Number(n).toLocaleString("en-KE");
}

function isMpesa(phone) {
  const clean = String(phone).replace(/\D/g, "");
  return /^(?:254|0)?(7|1)\d{8}$/.test(clean);
}

function saveBag() {
  localStorage.setItem("nvx_bag", JSON.stringify(state.items));
  renderBag();
}

function updateScoreUI(score) {
  state.score = score;
  document.querySelectorAll("[data-score]").forEach((el) => {
    el.textContent = score;
  });

  const tierEl = document.querySelector("[data-tier]");
  const spentEl = document.querySelector("[data-spent]");
  if (tierEl) {
    tierEl.textContent = score >= 500 ? "Gold Member" : score >= 100 ? "Regular" : "Opening";
  }
  if (spentEl) {
    spentEl.textContent = score > 0
      ? `Verified balance: ${score} scores (= ${kes(score)} value).`
      : "Nothing confirmed yet. Your score starts at 0 (50 scores per shoe paid).";
  }
}

async function fetchVerifiedScores(phone) {
  if (!isMpesa(phone)) return;
  localStorage.setItem("nvx_phone", phone);
  state.phone = phone;

  try {
    const res = await fetch(`${BACKEND_URL}/api/scores/${encodeURIComponent(phone)}`);
    if (!res.ok) return;
    const data = await res.json();
    updateScoreUI(data.scores || 0);
  } catch (err) {
    console.error("Could not fetch scores:", err);
  }
}

function renderBag() {
  const countEl = document.querySelector("[data-bag-count]");
  const linesEl = document.querySelector("#lines");
  const totalQty = state.items.reduce((sum, item) => sum + item.qty, 0);
  const totalKes = state.items.reduce((sum, item) => sum + item.price * item.qty, 0);

  if (countEl) countEl.textContent = totalQty;
  if (!linesEl) return;

  if (state.items.length === 0) {
    linesEl.innerHTML = `<p class="muted">Your bag is empty.</p>`;
    return;
  }

  linesEl.innerHTML =
    state.items
      .map(
        (item, idx) => `
      <div class="line">
        <div>
          <strong>${item.name}</strong>
          <p class="muted">Size ${item.size} · ${kes(item.price)}</p>
        </div>
        <div class="line-actions">
          <button class="qty" type="button" onclick="changeQty(${idx}, -1)">-</button>
          <span>${item.qty}</span>
          <button class="qty" type="button" onclick="changeQty(${idx}, 1)">+</button>
        </div>
      </div>`
      )
      .join("") +
    `<p class="price" style="margin-top: 1rem;">Total: ${kes(totalKes)}</p>`;
}

window.changeQty = function (index, delta) {
  state.items[index].qty += delta;
  if (state.items[index].qty <= 0) {
    state.items.splice(index, 1);
  }
  saveBag();
};

// Add to bag buttons
document.querySelectorAll("[data-add]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const card = btn.closest(".card");
    if (!card) return;
    const id = card.dataset.id;
    const name = card.dataset.name;
    const price = Number(card.dataset.price);
    const size = card.querySelector("select")?.value || "40";

    const existing = state.items.find((i) => i.id === id && i.size === size);
    if (existing) {
      existing.qty += 1;
    } else {
      state.items.push({ id, name, price, size, qty: 1 });
    }
    saveBag();
    openBag();
  });
});

// Bag drawer open/close
function openBag() {
  document.querySelector("#backdrop")?.removeAttribute("hidden");
  document.querySelector("#drawer")?.removeAttribute("hidden");
}

function closeBag() {
  document.querySelector("#backdrop")?.setAttribute("hidden", "");
  document.querySelector("#drawer")?.setAttribute("hidden", "");
}

document.querySelectorAll("[data-open-bag]").forEach((b) => b.addEventListener("click", openBag));
document.querySelectorAll("[data-close-bag]").forEach((b) => b.addEventListener("click", closeBag));

// Checkout Form -> Calls Backend Equity Jenga STK Push
document.querySelector("#pay-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const note = document.querySelector("#pay-note");
  const input = document.querySelector("#phone");
  const payBtn = event.target.querySelector(".pay");
  const phone = input instanceof HTMLInputElement ? input.value.trim() : "";

  if (!isMpesa(phone)) {
    if (note) note.textContent = "Use a Safaricom number, like 0712 345 678.";
    return;
  }
  if (state.items.length === 0) {
    if (note) note.textContent = "Add a shoe to your bag first.";
    return;
  }

  if (payBtn) payBtn.disabled = true;
  if (note) note.textContent = "Sending M-Pesa prompt to your phone...";

  try {
    const response = await fetch(`${BACKEND_URL}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, items: state.items })
    });

    const data = await response.json();

    if (!response.ok) {
      if (note) note.textContent = data.error || "Could not send M-Pesa prompt.";
      return;
    }

    localStorage.setItem("nvx_phone", phone);
    if (note) {
      note.textContent = "Prompt sent! Enter your M-Pesa PIN. Scores stay unchanged if canceled.";
    }

    // Poll verified score from server after 12s and 25s to reflect confirmed payment
    setTimeout(() => fetchVerifiedScores(phone), 12000);
    setTimeout(() => fetchVerifiedScores(phone), 25000);
  } catch (err) {
    if (note) note.textContent = "Network error connecting to payment server.";
  } finally {
    if (payBtn) payBtn.disabled = false;
  }
});

// Check Score Form (on index.html #score panel)
document.querySelector("#check-score-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const lookupInput = document.querySelector("#lookup-phone");
  if (lookupInput && isMpesa(lookupInput.value)) {
    fetchVerifiedScores(lookupInput.value.trim());
  }
});

// Initialize on page load
renderBag();
if (state.phone) {
  const phoneInput = document.querySelector("#phone");
  if (phoneInput) phoneInput.value = state.phone;
  fetchVerifiedScores(state.phone);
}
