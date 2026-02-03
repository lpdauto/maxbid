// =======================
// IAA Max Bid Calculator
// =======================

const TARGET_MARGIN = 0.25;

// Confirmed from your receipts:
const FEE_BANDS = [
  { min: 0,    max: 1999.99, fees: 485, label: "IAA Fees: $485 (< $2k hammer)" },
  { min: 2000, max: 4999.99, fees: 840, label: "IAA Fees: $840 ($2k–$5k hammer)" }
];

// For hammer >= $5k we don't have a receipt yet.
// We'll use a conservative buffer so you don't get burned.
const UNKNOWN_HIGH_HAMMER_FEES = 1000;
const UNKNOWN_HIGH_HAMMER_LABEL = "IAA Fees: ~$1,000 (>= $5k hammer, conservative)";

function money(n) {
  if (!isFinite(n)) return "$—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function clamp0(n) {
  return Math.max(0, n);
}

/**
 * Fees are a function of HAMMER bid.
 * We use your confirmed bands; for >=$5k we apply a conservative fallback.
 */
function estimateFeesByHammer(hammer) {
  for (const b of FEE_BANDS) {
    if (hammer >= b.min && hammer <= b.max) {
      return { fees: b.fees, label: b.label };
    }
  }
  return { fees: UNKNOWN_HIGH_HAMMER_FEES, label: UNKNOWN_HIGH_HAMMER_LABEL };
}

/**
 * Exact max bid solve (band-aware):
 * Profit >= TARGET_MARGIN * SellPrice
 * TotalCost = Bid + Fees(Bid) + Repairs + Towing
 * => Bid <= (1 - margin)*Sell - Repairs - Towing - Fees(Bid)
 *
 * Since Fees(Bid) is piecewise constant by bid band, we compute candidates
 * and select the best valid one.
 */
function calculateMaxBid(sellPrice, repairs, towing) {
  const rhs = (1 - TARGET_MARGIN) * sellPrice - repairs - towing;

  // Candidate for band 2k–5k (fees = 840)
  const candMid = rhs - 840;

  // Candidate for band <2k (fees = 485)
  const candLow = rhs - 485;

  // Candidate for >=5k (conservative)
  const candHigh = rhs - UNKNOWN_HIGH_HAMMER_FEES;

  // Validate candidates by their band ranges
  const candidates = [];

  // Low band valid if resulting bid is < 2000
  if (candLow >= 0 && candLow < 2000) {
    candidates.push({ bid: candLow, fees: 485, label: "IAA Fees: $485 (< $2k hammer)" });
  }

  // Mid band valid if resulting bid is between 2000 and 5000
  if (candMid >= 2000 && candMid < 5000) {
    candidates.push({ bid: candMid, fees: 840, label: "IAA Fees: $840 ($2k–$5k hammer)" });
  }

  // High band valid if resulting bid is >= 5000
  if (candHigh >= 5000) {
    candidates.push({ bid: candHigh, fees: UNKNOWN_HIGH_HAMMER_FEES, label: UNKNOWN_HIGH_HAMMER_LABEL });
  }

  // If none are "perfectly valid", pick the maximum non-negative candidate
  // but still attach a fee estimate based on that value.
  if (candidates.length === 0) {
    const bestGuess = clamp0(Math.max(candLow, candMid, candHigh));
    const feeGuess = estimateFeesByHammer(bestGuess);
    return { maxBid: bestGuess, feeInfo: feeGuess };
  }

  // Otherwise pick the best (highest) valid bid
  candidates.sort((a, b) => b.bid - a.bid);
  const best = candidates[0];
  return { maxBid: best.bid, feeInfo: { fees: best.fees, label: best.label } };
}

function profitAndMarginAtBid(sellPrice, repairs, towing, bid) {
  const feeInfo = estimateFeesByHammer(bid);
  const totalCost = bid + feeInfo.fees + repairs + towing;
  const profit = sellPrice - totalCost;
  const margin = sellPrice > 0 ? (profit / sellPrice) : 0;
  return { profit, margin, feeInfo };
}

// --------------------
// UI Wiring
// --------------------

const elSell = document.getElementById("sellPrice");
const elRep = document.getElementById("repairs");
const elTow = document.getElementById("towing");
const elBid = document.getElementById("yourBid");

const elMax = document.getElementById("maxBid");
const elFeeBand = document.getElementById("feeBand");
const elProfitInfo = document.getElementById("profitInfo");
const elBtn = document.getElementById("calcBtn");

// Load last inputs (nice for phone use)
(function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem("maxBidInputs") || "{}");
    if (saved.sellPrice != null) elSell.value = saved.sellPrice;
    if (saved.repairs != null) elRep.value = saved.repairs;
    if (saved.towing != null) elTow.value = saved.towing;
    if (saved.yourBid != null) elBid.value = saved.yourBid;
  } catch {}
})();

function saveInputs() {
  const payload = {
    sellPrice: elSell.value,
    repairs: elRep.value,
    towing: elTow.value,
    yourBid: elBid.value
  };
  localStorage.setItem("maxBidInputs", JSON.stringify(payload));
}

function calcAndRender() {
  const sellPrice = Number(elSell.value || 0);
  const repairs = Number(elRep.value || 0);
  const towing = Number(elTow.value || 0);
  const yourBid = Number(elBid.value || 0);

  saveInputs();

  if (sellPrice <= 0) {
    elMax.textContent = "$—";
    elFeeBand.textContent = "IAA Fees: —";
    elProfitInfo.textContent = "Enter an expected sell price to calculate.";
    return;
  }

  const { maxBid, feeInfo } = calculateMaxBid(sellPrice, repairs, towing);

  elMax.textContent = money(clamp0(maxBid));
  elFeeBand.textContent = feeInfo.label;

  if (yourBid > 0) {
    const { profit, margin, feeInfo: feeAtBid } = profitAndMarginAtBid(sellPrice, repairs, towing, yourBid);
    elProfitInfo.textContent =
      `At your bid (${money(yourBid)}): ` +
      `Profit ${money(profit)} | Margin ${(margin * 100).toFixed(1)}% | ` +
      `${feeAtBid.label}`;
  } else {
    elProfitInfo.textContent = "";
  }
}

// Button click
elBtn.addEventListener("click", calcAndRender);

// Convenience: recalc when pressing Enter in any field
[elSell, elRep, elTow, elBid].forEach((el) => {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") calcAndRender();
  });
});
