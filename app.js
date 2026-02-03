// =======================
// IAA / Copart Max Bid Calculator
// =======================

// ---------- IAA (your receipts) ----------
const IAA_FEE_BANDS = [
  { min: 0,    max: 1999.99, fees: 485, label: "IAA Fees: $485 (< $2k hammer)" },
  { min: 2000, max: 4999.99, fees: 840, label: "IAA Fees: $840 ($2k–$5k hammer)" },
  { min: 5000, max: 6999.99, fees: 905, label: "IAA Fees: $905 ($5k–$7k hammer)" }
];

// If hammer is above our last confirmed band, stay conservative.
const IAA_UNKNOWN_OVER_MAX = { fees: 1000, label: "IAA Fees: ~$1,000 (>= $7k hammer, conservative)" };


// ---------- Copart (U.S. Licensed Fees, Standard Vehicles, Clean Title) ----------
// Assumptions:
// - Secured payment methods
// - Live bid (virtual bid fee applies)
const COPART_GATE_FEE_CLEAN = 79;
const COPART_ENV_FEE_CLEAN  = 0;

// Virtual Bid Fee — Live Bid (Clean Title)
function copartVirtualBidFeeLive(hammer) {
  if (hammer < 100)  return 0;
  if (hammer < 500)  return 49;
  if (hammer < 1000) return 59;
  if (hammer < 1500) return 79;
  if (hammer < 2000) return 89;
  if (hammer < 4000) return 99;
  if (hammer < 6000) return 109;
  if (hammer < 8000) return 139;
  return 149;
}

// Bidding Fees — Secured Payment Methods (Standard Vehicles, Clean Title)
function copartBiddingFeeSecuredClean(hammer) {
  if (hammer < 100)  return 1;
  if (hammer < 200)  return 25;
  if (hammer < 300)  return 50;
  if (hammer < 350)  return 75;
  if (hammer < 400)  return 75;
  if (hammer < 450)  return 110;
  if (hammer < 500)  return 110;
  if (hammer < 550)  return 125;
  if (hammer < 600)  return 130;
  if (hammer < 700)  return 140;
  if (hammer < 800)  return 155;
  if (hammer < 900)  return 170;
  if (hammer < 1000) return 185;
  if (hammer < 1200) return 200;
  if (hammer < 1300) return 225;
  if (hammer < 1400) return 240;
  if (hammer < 1500) return 250;
  if (hammer < 1600) return 260;
  if (hammer < 1700) return 275;
  if (hammer < 1800) return 285;
  if (hammer < 2000) return 300;
  if (hammer < 2400) return 325;
  if (hammer < 2500) return 335;
  if (hammer < 3000) return 350;
  if (hammer < 3500) return 400;
  if (hammer < 4000) return 455;
  if (hammer < 4500) return 600;
  if (hammer < 5000) return 625;
  if (hammer < 6000) return 625;
  if (hammer < 6500) return 675;
  if (hammer < 7000) return 675;
  if (hammer < 7500) return 675;
  if (hammer < 8000) return 690;
  if (hammer < 8500) return 715;
  if (hammer < 10000) return 715;
  if (hammer < 10500) return 720;
  if (hammer < 12500) return 720;
  if (hammer < 15000) return 720;
  return hammer * 0.0575; // 15,000+
}


// ---------- helpers ----------
function money(n) {
  if (!isFinite(n)) return "$—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function clamp0(n) { return Math.max(0, n); }

// ---------- UI elements ----------
const elSell = document.getElementById("sellPrice");
const elRep = document.getElementById("repairs");
const elTow = document.getElementById("towing");
const elBid = document.getElementById("yourBid");

const elMax = document.getElementById("maxBid");
const elFeeBand = document.getElementById("feeBand");
const elProfitInfo = document.getElementById("profitInfo");

const elTotalCost = document.getElementById("totalCost");
const elProfitAtMax = document.getElementById("profitAtMax");

const elBtn = document.getElementById("calcBtn");
const elMarginPill = document.getElementById("marginPill");
const elAuctionPill = document.getElementById("auctionPill");
const elFeeNote = document.getElementById("feeNote");

const marginButtons = Array.from(document.querySelectorAll(".marginBtn"));
const auctionButtons = Array.from(document.querySelectorAll(".auctionBtn"));


// ---------- preferences ----------
function getSelectedAuction() { return localStorage.getItem("auction") || "iaa"; }
function setSelectedAuction(a) {
  localStorage.setItem("auction", a);
  auctionButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.auction === a));
  elAuctionPill.textContent = `Auction: ${a.toUpperCase()}`;
}

function getSelectedMargin() {
  const saved = localStorage.getItem("targetMargin");
  if (saved && !isNaN(Number(saved))) return Number(saved);
  return 0.25;
}
function setSelectedMargin(m) {
  localStorage.setItem("targetMargin", String(m));
  marginButtons.forEach(btn => btn.classList.toggle("active", Number(btn.dataset.margin) === m));
  elMarginPill.textContent = `Target Margin: ${(m * 100).toFixed(0)}%`;
}

function saveInputs() {
  const payload = {
    sellPrice: elSell.value,
    repairs: elRep.value,
    towing: elTow.value,
    yourBid: elBid.value
  };
  localStorage.setItem("maxBidInputs", JSON.stringify(payload));
}
function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem("maxBidInputs") || "{}");
    if (saved.sellPrice != null) elSell.value = saved.sellPrice;
    if (saved.repairs != null) elRep.value = saved.repairs;
    if (saved.towing != null) elTow.value = saved.towing;
    if (saved.yourBid != null) elBid.value = saved.yourBid;
  } catch {}
}


// ---------- fee engines ----------
function estimateFees(auction, hammer) {
  if (auction === "copart") {
    const bidding = copartBiddingFeeSecuredClean(hammer);
    const virtual = copartVirtualBidFeeLive(hammer);
    const gate = COPART_GATE_FEE_CLEAN;
    const env = COPART_ENV_FEE_CLEAN;

    const total = bidding + virtual + gate + env;

    return {
      totalFees: total,
      label: `Copart Fees: ${money(total)} (secured + live + gate)`,
      breakdown: { bidding, virtual, gate, env }
    };
  }

  // IAA
  for (const b of IAA_FEE_BANDS) {
    if (hammer >= b.min && hammer <= b.max) {
      return { totalFees: b.fees, label: b.label, breakdown: { total: b.fees } };
    }
  }
  return { totalFees: IAA_UNKNOWN_OVER_MAX.fees, label: IAA_UNKNOWN_OVER_MAX.label, breakdown: { total: IAA_UNKNOWN_OVER_MAX.fees } };
}


// ---------- max bid solver ----------
function calculateMaxBid(sellPrice, repairs, towing, targetMargin, auction) {
  // bid + fees(bid) + repairs + towing <= (1 - margin) * sell
  const rhs = (1 - targetMargin) * sellPrice - repairs - towing;
  const maxPossible = clamp0(rhs);

  if (auction === "iaa") {
    let best = { bid: 0, feeInfo: estimateFees("iaa", 0) };

    for (const band of IAA_FEE_BANDS) {
      const cand = rhs - band.fees;
      if (cand >= band.min && cand <= band.max && cand > best.bid) {
        best = { bid: cand, feeInfo: { totalFees: band.fees, label: band.label, breakdown: { total: band.fees } } };
      }
    }

    if (best.bid === 0) {
      const guess = clamp0(rhs - IAA_UNKNOWN_OVER_MAX.fees);
      return { maxBid: guess, feeInfo: estimateFees("iaa", guess) };
    }

    return { maxBid: best.bid, feeInfo: best.feeInfo };
  }

  // Copart: binary search for max bid satisfying bid + fees(bid) <= rhs
  let lo = 0;
  let hi = maxPossible;

  for (let i = 0; i < 45; i++) {
    const mid = (lo + hi) / 2;
    const f = estimateFees("copart", mid).totalFees;
    const totalCost = mid + f;
    if (totalCost <= rhs) lo = mid; else hi = mid;
  }

  const bid = lo;
  return { maxBid: bid, feeInfo: estimateFees("copart", bid) };
}

function profitAndMarginAtBid(sellPrice, repairs, towing, bid, auction) {
  const feeInfo = estimateFees(auction, bid);
  const totalCost = bid + feeInfo.totalFees + repairs + towing;
  const profit = sellPrice - totalCost;
  const margin = sellPrice > 0 ? profit / sellPrice : 0;
  return { profit, margin, totalCost, feeInfo };
}


// ---------- render ----------
function renderFeeNote(auction) {
  if (auction === "copart") {
    elFeeNote.textContent = "Copart: secured payment + live virtual bid + gate fee (clean title).";
  } else {
    elFeeNote.textContent = "IAA: dealer fee bands from your receipts.";
  }
}

function calcAndRender() {
  const sellPrice = Number(elSell.value || 0);
  const repairs = Number(elRep.value || 0);
  const towing = Number(elTow.value || 0);
  const yourBid = Number(elBid.value || 0);

  const targetMargin = getSelectedMargin();
  const auction = getSelectedAuction();

  setSelectedMargin(targetMargin);
  setSelectedAuction(auction);
  renderFeeNote(auction);
  saveInputs();

  if (sellPrice <= 0) {
    elMax.textContent = "$—";
    elFeeBand.textContent = "Fees: —";
    elTotalCost.textContent = "$—";
    elProfitAtMax.textContent = "$—";
    elProfitInfo.textContent = "Enter an expected sell price to calculate.";
    return;
  }

  const { maxBid, feeInfo } = calculateMaxBid(sellPrice, repairs, towing, targetMargin, auction);
  elMax.textContent = money(clamp0(maxBid));
  elFeeBand.textContent = feeInfo.label;

  const atMax = profitAndMarginAtBid(sellPrice, repairs, towing, maxBid, auction);
  elTotalCost.textContent = money(atMax.totalCost);
  elProfitAtMax.textContent = money(atMax.profit);

  if (yourBid > 0) {
    const atBid = profitAndMarginAtBid(sellPrice, repairs, towing, yourBid, auction);
    elProfitInfo.textContent =
      `At your bid (${money(yourBid)}): Profit ${money(atBid.profit)} | Margin ${(atBid.margin * 100).toFixed(1)}% | ${atBid.feeInfo.label}`;
  } else {
    elProfitInfo.textContent = "";
  }
}


// ---------- handlers ----------
marginButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    setSelectedMargin(Number(btn.dataset.margin));
    calcAndRender();
  });
});
auctionButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    setSelectedAuction(btn.dataset.auction);
    calcAndRender();
  });
});

elBtn.addEventListener("click", calcAndRender);

[elSell, elRep, elTow, elBid].forEach((el) => {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") calcAndRender();
  });
});


// ---------- init ----------
loadSaved();
setSelectedMargin(getSelectedMargin());
setSelectedAuction(getSelectedAuction());
renderFeeNote(getSelectedAuction());
