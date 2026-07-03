const SHEETS = {
  cs: "CS DB",
  inventoryTurnover: "제품회전율",
  familySale: "패밀리세일DB원본",
};
const SHEET_FETCH_TIMEOUT_MS = 60000;
const ANNUAL_SAFE_TURNOVER = 1;
const INVENTORY_COLUMNS = {
  salesQuantity: 31,
  periodStock: 43,
  periodCostAmount: 46,
};
const SALES_MONTH_COLUMNS = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14];
const TEAM_SHEETS = [
  { match: "영업1팀", name: "영업1팀", sheet: "영업1팀목표DB" },
  { match: "영업2팀", name: "영업2팀", sheet: "영업2팀목표DB" },
  { match: "영업3팀", name: "영업3팀", sheet: "영업3팀목표DB" },
  { match: "영업4팀", name: "영업4팀", sheet: "영업4팀목표DB" },
  { match: "해외영업팀", name: "해외영업팀", sheet: "해외영업팀목표DB" },
  { match: "직영점", name: "직영점", sheets: ["직영점매출목표DB", "직영점DB", "직영점 DB"] },
];
const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const BUILD_INFO = {
  channel: "GitHub Upload",
  version: "2026.06.22",
};
const LOWEST_PRICE_API_STORAGE_KEY = "snowline-lowest-price-api-base";
const LOWEST_PRICE_PRODUCTS_STORAGE_KEY = "snowline-lowest-price-products";
const LOWEST_PRICE_EMAIL_STORAGE_KEY = "snowline-lowest-price-email";
const LOWEST_PRICE_TOLERANCE_PERCENT = 40;
const LOWEST_PRICE_DEFAULT_API_BASE = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://127.0.0.1:8787"
  : "";

const state = {
  query: "",
  csCustomerQuery: "",
  selectedMonth: new Date().getMonth() + 1,
  productSort: "amount-desc",
  modalSort: "amount-desc",
  priceSort: "drop-rate-desc",
  activeInventoryStatus: "",
  teamDetails: {},
  inventory: [],
  teams: [],
  products: [],
  inventoryProducts: [],
  priceItems: [],
  priceMonitor: {
    apiBaseUrl: "",
    products: [],
    results: [],
    hasChecked: false,
    alertSettings: {
      email_recipients: [],
    },
    priceEvents: {
      seller_stats: [],
      hourly_stats: [],
      recent_events: [],
    },
    config: {
      credentials_configured: false,
      default_exclude: "used:rental:cbshop",
      default_seller_exclude: "쿠팡",
      monitor: {},
    },
    message: "",
    usingApi: false,
  },
  actionItems: [],
  cs: [],
};
let dashboardStarted = false;

const els = {
  sheetStatus: document.querySelector("#sheet-status"),
  statusStrip: document.querySelector("#status-strip"),
  lastUpdated: document.querySelector("#last-updated"),
  buildVersion: document.querySelector("#build-version"),
  kpiGrid: document.querySelector("#kpi-grid"),
  teamBars: document.querySelector("#team-bars"),
  monthToggle: document.querySelector("#month-toggle"),
  monthlyAchievementBody: document.querySelector("#monthly-achievement-body"),
  monthlyAchievementTitle: document.querySelector("#monthly-achievement-title"),
  annualAchievementBody: document.querySelector("#annual-achievement-body"),
  inventoryGrid: document.querySelector("#inventory-grid"),
  topProductsBody: document.querySelector("#top-products-body"),
  salesBody: document.querySelector("#sales-body"),
  productsBody: document.querySelector("#products-body"),
  csBody: document.querySelector("#cs-body"),
  csEntryForm: document.querySelector("#cs-entry-form"),
  csEntryMessage: document.querySelector("#cs-entry-message"),
  csSubmitButton: document.querySelector("#cs-submit-button"),
  csCustomerSearch: document.querySelector("#cs-customer-search"),
  csCustomerClear: document.querySelector("#cs-customer-clear"),
  csSearchSummary: document.querySelector("#cs-search-summary"),
  priceMonitorSummary: document.querySelector("#price-monitor-summary"),
  priceMonitorBody: document.querySelector("#price-monitor-body"),
  lowestApiBase: document.querySelector("#lowest-api-base"),
  lowestApiSave: document.querySelector("#lowest-api-save"),
  lowestApiStatus: document.querySelector("#lowest-api-status"),
  lowestCheckButton: document.querySelector("#lowest-check-button"),
  lowestExportButton: document.querySelector("#lowest-export-button"),
  lowestProductForm: document.querySelector("#lowest-product-form"),
  lowestProductName: document.querySelector("#lowest-product-name"),
  lowestBasePrice: document.querySelector("#lowest-base-price"),
  lowestProductRows: document.querySelector("#lowest-product-rows"),
  lowestClearProducts: document.querySelector("#lowest-clear-products"),
  lowestBulkInput: document.querySelector("#lowest-bulk-input"),
  lowestBulkImport: document.querySelector("#lowest-bulk-import"),
  lowestExcelFile: document.querySelector("#lowest-excel-file"),
  lowestExcelImport: document.querySelector("#lowest-excel-import"),
  lowestEmailForm: document.querySelector("#lowest-email-form"),
  lowestEmailRecipients: document.querySelector("#lowest-email-recipients"),
  lowestEmailStatus: document.querySelector("#lowest-email-status"),
  lowestRefreshEvents: document.querySelector("#lowest-refresh-events"),
  lowestWatchSummary: document.querySelector("#lowest-watch-summary"),
  lowestSellerPatternRows: document.querySelector("#lowest-seller-pattern-rows"),
  lowestEventRows: document.querySelector("#lowest-event-rows"),
  lowestDisplayCount: document.querySelector("#lowest-display-count"),
  lowestResultSearch: document.querySelector("#lowest-result-search"),
  lowestPriceFirst: document.querySelector("#lowest-price-first"),
  lowestExcludeSpecial: document.querySelector("#lowest-exclude-special"),
  inventoryRiskSummary: document.querySelector("#inventory-risk-summary"),
  inventoryRiskBody: document.querySelector("#inventory-risk-body"),
  actionSummary: document.querySelector("#action-summary"),
  actionQueueBody: document.querySelector("#action-queue-body"),
  channelSummary: document.querySelector("#channel-summary"),
  channelSalesBody: document.querySelector("#channel-sales-body"),
  membersSummary: document.querySelector("#members-summary"),
  membersBody: document.querySelector("#members-body"),
  membersRefresh: document.querySelector("#members-refresh"),
  searchInput: document.querySelector("#search-input"),
  refreshButton: document.querySelector("#refresh-button"),
  inventoryModal: document.querySelector("#inventory-modal"),
  inventoryModalTitle: document.querySelector("#inventory-modal-title"),
  inventoryModalSubtitle: document.querySelector("#inventory-modal-subtitle"),
  inventoryModalBody: document.querySelector("#inventory-modal-body"),
  inventoryModalClose: document.querySelector("#inventory-modal-close"),
};

initBuildInfo();
setupLowestPriceIntegration();

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".content-view").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`[data-panel="${button.dataset.view}"]`).classList.add("active");
    if (button.dataset.view === "members") loadMembers();
  });
});

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

els.refreshButton.addEventListener("click", loadDashboard);
els.membersRefresh?.addEventListener("click", loadMembers);
els.csEntryForm?.addEventListener("submit", handleCsSubmit);
els.csCustomerSearch?.addEventListener("input", (event) => {
  state.csCustomerQuery = event.target.value.trim().toLowerCase();
  render();
});
els.csCustomerClear?.addEventListener("click", () => {
  state.csCustomerQuery = "";
  if (els.csCustomerSearch) els.csCustomerSearch.value = "";
  render();
});
els.csEntryForm?.addEventListener("reset", () => {
  setCsEntryMessage("");
  setCsEditMode(null);
  window.setTimeout(() => {
    setDefaultCsDate();
    setDefaultCsManager();
  }, 0);
});
els.monthToggle.addEventListener("click", (event) => {
  const button = event.target.closest("[data-month]");
  if (!button) return;
  state.selectedMonth = Number(button.dataset.month);
  state.teams = buildTeamsFromDetails(state.teamDetails);
  render();
});
els.inventoryModalClose.addEventListener("click", closeInventoryModal);
els.inventoryModal.addEventListener("click", (event) => {
  if (event.target === els.inventoryModal) closeInventoryModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeInventoryModal();
});
document.addEventListener("click", (event) => {
  const productSortButton = event.target.closest("[data-product-sort]");
  if (productSortButton) {
    state.productSort = productSortButton.dataset.productSort;
    syncSortButtons("[data-product-sort]", state.productSort);
    state.products = parseInventoryRanking(state.inventoryProducts);
    render();
    return;
  }

  const modalSortButton = event.target.closest("[data-modal-sort]");
  if (modalSortButton) {
    state.modalSort = modalSortButton.dataset.modalSort;
    syncSortButtons("[data-modal-sort]", state.modalSort);
    if (state.activeInventoryStatus) openInventoryModal(state.activeInventoryStatus);
    return;
  }

  const priceSortButton = event.target.closest("[data-price-sort]");
  if (priceSortButton) {
    state.priceSort = getNextPriceSort(priceSortButton.dataset.priceSort);
    renderPriceMonitoring();
    return;
  }

  const memberActionButton = event.target.closest("[data-member-action]");
  if (memberActionButton) {
    updateMemberStatus(memberActionButton.dataset.userId, memberActionButton.dataset.memberAction);
    return;
  }

  const csEditButton = event.target.closest("[data-cs-edit]");
  if (csEditButton) {
    startCsEdit(Number(csEditButton.dataset.csEdit));
    return;
  }

  const csDeleteButton = event.target.closest("[data-cs-delete]");
  if (csDeleteButton) {
    deleteCs(Number(csDeleteButton.dataset.csDelete));
  }
});

if (window.SnowlineAuth?.required) {
  setStatus("idle", "로그인 후 구글시트 데이터를 불러옵니다.", "로그인 필요");
  window.addEventListener("snowline:authenticated", (event) => {
    startDashboard(event.detail);
  });
  const currentSession = window.SnowlineAuth.getSession?.();
  if (currentSession?.user) startDashboard(currentSession.user);
} else {
  setStatus("error", "로그인 모듈을 불러오지 못했습니다. auth.js 설정을 확인해주세요.", "인증 오류");
}

function startDashboard(user) {
  if (dashboardStarted) return;
  dashboardStarted = true;
  placeAuthUserBar();
  window.setTimeout(placeAuthUserBar, 500);
  setupAdminView(user);
  setDefaultCsDate();
  setDefaultCsManager();
  loadDashboard();
}

function placeAuthUserBar() {
  const bar = document.querySelector("#auth-user-bar");
  const sidebar = document.querySelector(".sidebar");
  if (!bar || !sidebar || bar.parentElement === sidebar) return;
  sidebar.appendChild(bar);
}

function initBuildInfo() {
  if (!els.buildVersion) return;
  const channelLabel = window.location.pathname.includes("/test/") ? "테스트" : "운영";
  els.buildVersion.textContent = `${BUILD_INFO.channel} ${channelLabel} · ${BUILD_INFO.version}`;
}

function setupLowestPriceIntegration() {
  if (!els.lowestApiBase) return;

  state.priceMonitor.apiBaseUrl = loadStoredValue(LOWEST_PRICE_API_STORAGE_KEY, LOWEST_PRICE_DEFAULT_API_BASE);
  state.priceMonitor.products = loadStoredJson(LOWEST_PRICE_PRODUCTS_STORAGE_KEY, []);
  state.priceMonitor.alertSettings.email_recipients = parseRecipientList(
    loadStoredValue(LOWEST_PRICE_EMAIL_STORAGE_KEY, ""),
  );
  els.lowestApiBase.value = state.priceMonitor.apiBaseUrl;
  els.lowestEmailRecipients.value = recipientsToText(state.priceMonitor.alertSettings.email_recipients);

  els.lowestApiSave?.addEventListener("click", () => {
    state.priceMonitor.apiBaseUrl = normalizeApiBase(els.lowestApiBase.value);
    els.lowestApiBase.value = state.priceMonitor.apiBaseUrl;
    storeValue(LOWEST_PRICE_API_STORAGE_KEY, state.priceMonitor.apiBaseUrl);
    loadLowestPriceService();
  });
  els.lowestApiBase?.addEventListener("change", () => {
    state.priceMonitor.apiBaseUrl = normalizeApiBase(els.lowestApiBase.value);
    els.lowestApiBase.value = state.priceMonitor.apiBaseUrl;
    storeValue(LOWEST_PRICE_API_STORAGE_KEY, state.priceMonitor.apiBaseUrl);
  });
  els.lowestCheckButton?.addEventListener("click", () => checkLowestPrices().catch((error) => setLowestStatus(error.message, "error")));
  els.lowestExportButton?.addEventListener("click", exportLowestCsv);
  els.lowestRefreshEvents?.addEventListener("click", () => loadLowestPriceEvents().catch((error) => setLowestStatus(error.message, "error")));
  els.lowestProductForm?.addEventListener("submit", (event) => addLowestProduct(event).catch((error) => setLowestStatus(error.message, "error")));
  els.lowestProductRows?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lowest-delete]");
    if (!button) return;
    deleteLowestProduct(button.dataset.lowestDelete).catch((error) => setLowestStatus(error.message, "error"));
  });
  els.lowestClearProducts?.addEventListener("click", () => clearLowestProducts().catch((error) => setLowestStatus(error.message, "error")));
  els.lowestBulkImport?.addEventListener("click", () => importLowestBulkProducts().catch((error) => setLowestStatus(error.message, "error")));
  els.lowestExcelImport?.addEventListener("click", () => importLowestExcelProducts().catch((error) => setLowestStatus(error.message, "error")));
  els.lowestEmailForm?.addEventListener("submit", (event) => saveLowestEmailSettings(event).catch((error) => setLowestStatus(error.message, "error")));
  els.lowestResultSearch?.addEventListener("input", renderPriceMonitoring);

  renderLowestProducts();
  renderLowestWatchDashboard();
  loadLowestPriceService();
}

async function loadDashboard() {
  setStatus("loading", "구글시트 데이터를 불러오는 중입니다.", "연결중");

  const errors = [];
  const [csResult, inventoryResult, teamDetailsResult, familySaleResult] = await Promise.all([
    settle(fetchCsRecords),
    settle(fetchInventoryProducts),
    settle(() => fetchTeamDetails(null)),
    settle(() => fetchSheet(SHEETS.familySale)),
  ]);

  if (csResult.status === "fulfilled") {
    state.cs = csResult.value;
  } else {
    state.cs = [];
    errors.push(`${SHEETS.cs}: ${formatLoadError(csResult.reason)}`);
  }

  if (inventoryResult.status === "fulfilled") {
    state.inventoryProducts = inventoryResult.value;
    state.inventory = parseInventory(state.inventoryProducts);
    state.products = parseInventoryRanking(state.inventoryProducts);
  } else {
    state.inventoryProducts = [];
    state.inventory = [];
    state.products = [];
    errors.push(`${SHEETS.inventoryTurnover}: ${formatLoadError(inventoryResult.reason)}`);
  }

  if (teamDetailsResult.status === "fulfilled") {
    state.teamDetails = teamDetailsResult.value;
    state.teams = buildTeamsFromDetails(teamDetailsResult.value);
    const teamErrors = teamDetailsResult.value?._errors || [];
    errors.push(...teamErrors.map((message) => `팀 목표: ${message}`));
  } else {
    state.teamDetails = {};
    state.teams = [];
    errors.push(`팀 목표: ${formatLoadError(teamDetailsResult.reason)}`);
  }

  if (familySaleResult.status === "fulfilled") {
    state.priceItems = parseFamilySalePriceItems(familySaleResult.value);
    seedLowestProductsFromSheets();
  } else {
    state.priceItems = [];
    errors.push(`${SHEETS.familySale}: ${formatLoadError(familySaleResult.reason)}`);
  }

  const hasData = state.cs.length || state.inventoryProducts.length || state.teams.length;
  if (hasAuthLoadError(errors) && window.SnowlineAuth?.invalidate) {
    window.SnowlineAuth.invalidate("관리자 승인이 완료된 뒤 다시 로그인해주세요. 이미 승인했다면 로그아웃 후 다시 로그인해주세요.");
    return;
  }

  if (errors.length) {
    console.error("Sheet load errors", errors);
    setStatus("error", buildLoadErrorMessage(errors, hasData), "오류");
  } else {
    setStatus("ready", `${new Date().toLocaleString("ko-KR")} 기준으로 갱신되었습니다.`, "연결됨");
  }
  render();
}

async function fetchCsRecords() {
  if (!window.SnowlineAuth?.request) {
    throw new Error("로그인 세션이 필요합니다.");
  }

  try {
    const result = await withTimeout(
      window.SnowlineAuth.request({ action: "csRecords" }),
      SHEET_FETCH_TIMEOUT_MS,
      "CS 상담 데이터 조회 응답이 지연되고 있습니다.",
    );
    if (Array.isArray(result.rows)) return result.rows;
    throw new Error(result.error || "CS 상담 데이터를 불러오지 못했습니다.");
  } catch (error) {
    console.warn("CS records API failed, falling back to CSV sheet load.", error);
    return parseCs(await fetchSheet(SHEETS.cs));
  }
}

async function fetchInventoryProducts() {
  if (!window.SnowlineAuth?.request) {
    throw new Error("로그인 세션이 필요합니다.");
  }

  try {
    const result = await withTimeout(
      window.SnowlineAuth.request({ action: "inventorySummary" }),
      SHEET_FETCH_TIMEOUT_MS,
      "재고 요약 데이터 조회 응답이 지연되고 있습니다.",
    );
    if (Array.isArray(result.products)) return result.products;
    throw new Error(result.error || "재고 요약 데이터를 불러오지 못했습니다.");
  } catch (error) {
    console.warn("Inventory summary API failed, falling back to CSV sheet load.", error);
    return parseInventoryProducts(await fetchSheet(SHEETS.inventoryTurnover));
  }
}

async function fetchSheet(sheetName) {
  if (!window.SnowlineAuth?.request) {
    throw new Error("로그인 세션이 필요합니다.");
  }
  const result = await withTimeout(
    window.SnowlineAuth.request({ action: "sheet", sheetName }),
    SHEET_FETCH_TIMEOUT_MS,
    `${sheetName} 조회 응답이 지연되고 있습니다.`,
  );
  if (!result.csv) throw new Error(`${sheetName} 데이터를 불러오지 못했습니다.`);
  return parseCsv(result.csv);
}

async function fetchDashboardSheets() {
  if (!window.SnowlineAuth?.request) {
    throw new Error("로그인 세션이 필요합니다.");
  }

  try {
    const sheetNames = [SHEETS.cs, SHEETS.inventoryTurnover];
    const result = await withTimeout(
      window.SnowlineAuth.request({ action: "dashboard", sheetNames }),
      SHEET_FETCH_TIMEOUT_MS,
      "구글시트 통합 조회 응답이 지연되고 있습니다.",
    );
    return result.sheets || {};
  } catch (error) {
    console.warn("Dashboard batch load failed, falling back to individual sheet requests.", error);
    return null;
  }
}

function getDashboardSheetResult(dashboardSheets, sheetName) {
  if (!dashboardSheets) return settle(() => fetchSheet(sheetName));
  const sheet = dashboardSheets[sheetName];
  if (sheet?.csv) return { status: "fulfilled", value: parseCsv(sheet.csv) };
  return { status: "rejected", reason: new Error(sheet?.error || `${sheetName} 데이터를 불러오지 못했습니다.`) };
}

function getTeamSheetNames() {
  return [...new Set(TEAM_SHEETS.flatMap((team) => getTeamSheetCandidates(team)))];
}

function getTeamSheetCandidates(team) {
  return team.sheets || [team.sheet];
}

async function settle(task) {
  try {
    return { status: "fulfilled", value: await task() };
  } catch (error) {
    return { status: "rejected", reason: error };
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function formatLoadError(error) {
  const message = error?.message || String(error || "알 수 없는 오류");
  if (/세션|승인|로그인/.test(message)) {
    return `${message} 관리자 승인 상태를 확인한 뒤 다시 로그인해주세요.`;
  }
  return message;
}

function buildLoadErrorMessage(errors, hasData) {
  const detail = errors.slice(0, 3).join(" / ");
  const suffix = errors.length > 3 ? ` 외 ${errors.length - 3}건` : "";
  if (errors.some((message) => /세션|승인|로그인/.test(message))) {
    return `로그인 세션 또는 회원 승인 상태를 확인해주세요. ${detail}${suffix}`;
  }
  return hasData
    ? `일부 구글시트를 불러오지 못했습니다. ${detail}${suffix}`
    : `구글시트 데이터를 불러오지 못했습니다. ${detail}${suffix}`;
}

function hasAuthLoadError(errors) {
  return errors.some((message) => /승인된 계정|관리자 승인|세션|로그인/.test(message));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows.map((cells) => cells.map((cell) => cell.trim()));
}

function parseFamilySalePriceItems(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return [];

  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => /상품|제품|품명|product|name/i.test(String(cell || ""))),
  );
  const header = rows[Math.max(headerIndex, 0)] || [];
  const dataRows = rows.slice(Math.max(headerIndex, 0) + 1);
  const normalizedHeaders = header.map((cell) => String(cell || "").toLowerCase().replace(/\s+/g, ""));
  const findColumn = (...terms) =>
    normalizedHeaders.findIndex((headerText) => terms.some((term) => headerText.includes(term.toLowerCase())));

  const nameIndex = findColumn("상품", "제품", "품명", "product", "name");
  const baseIndex = findColumn("기준", "정상", "판매가", "base", "original");
  const lowestIndex = findColumn("최저", "할인가", "lowest", "sale");
  const sellerIndex = findColumn("판매처", "업체", "seller", "mall");
  const urlIndex = findColumn("url", "링크", "link");
  const noteIndex = findColumn("비고", "메모", "note");

  return dataRows
    .map((row) => {
      const numericValues = row.map(toNumber).filter((value) => value > 0);
      const basePrice = baseIndex >= 0 ? toNumber(row[baseIndex]) : Math.max(0, ...numericValues);
      const detectedLowest = lowestIndex >= 0 ? toNumber(row[lowestIndex]) : Math.min(...numericValues);
      const lowestPrice = Number.isFinite(detectedLowest) && detectedLowest > 0 ? detectedLowest : basePrice;
      const dropAmount = Math.max(0, basePrice - lowestPrice);
      return {
        name: String(row[nameIndex >= 0 ? nameIndex : 0] || "").trim(),
        basePrice,
        lowestPrice,
        dropRate: basePrice ? dropAmount / basePrice : 0,
        dropAmount,
        seller: String(row[sellerIndex >= 0 ? sellerIndex : -1] || "").trim(),
        url: String(row[urlIndex >= 0 ? urlIndex : -1] || "").trim(),
        note: String(row[noteIndex >= 0 ? noteIndex : -1] || "").trim(),
      };
    })
    .filter((item) => item.name && item.basePrice);
}

function parseInventory(products = []) {
  const counts = products.reduce((acc, product) => {
    acc[product.status] = (acc[product.status] || 0) + 1;
    acc["총재고품목수"] = (acc["총재고품목수"] || 0) + 1;
    return acc;
  }, {});

  return [
    { label: "안전", value: counts["안전"] || 0 },
    { label: "관심", value: counts["관심"] || 0 },
    { label: "위험", value: counts["위험"] || 0 },
    { label: "처분", value: counts["처분"] || 0 },
    { label: "총재고품목수", value: counts["총재고품목수"] || 0 },
  ];
}

function parseTeamDetail(rows) {
  const annualColumn = 16;
  const months = SALES_MONTH_COLUMNS.map((column, index) => {
    const target = toNumber(rows[2]?.[column]);
    const actual = toNumber(rows[3]?.[column]);
    return {
      month: index + 1,
      target,
      actual,
      rate: target ? actual / target : 0,
    };
  });
  const annualTarget = toNumber(rows[2]?.[annualColumn]);
  const annualActual = toNumber(rows[3]?.[annualColumn]);

  return {
    months,
    annualTarget,
    annualActual,
    annualRate: annualTarget ? annualActual / annualTarget : 0,
  };
}

async function fetchTeamDetails(dashboardSheets) {
  const summary = await fetchSalesSummary();
  if (summary) return summary;

  const results = dashboardSheets
    ? TEAM_SHEETS.map((team) => {
        const sheetName = getTeamSheetCandidates(team).find((candidate) => dashboardSheets[candidate]?.csv);
        if (sheetName) {
          return { status: "fulfilled", value: { rows: parseCsv(dashboardSheets[sheetName].csv), sheetName, updatedAt: new Date().toISOString() } };
        }
        const errors = getTeamSheetCandidates(team)
          .map((candidate) => dashboardSheets[candidate]?.error)
          .filter(Boolean)
          .join(" / ");
        return { status: "rejected", reason: new Error(errors || `${team.name} 데이터를 불러오지 못했습니다.`) };
      })
    : await Promise.allSettled(
        TEAM_SHEETS.map((team) => fetchFirstTeamSheet(team)),
      );
  const errors = [];
  const details = TEAM_SHEETS.reduce((details, team, index) => {
    if (results[index].status === "fulfilled") {
      details[team.match] = {
        name: team.name,
        sheetName: results[index].value.sheetName,
        updatedAt: results[index].value.updatedAt,
        ...parseTeamDetail(results[index].value.rows),
      };
    } else {
      errors.push(`${team.name}: ${formatLoadError(results[index].reason)}`);
    }
    return details;
  }, {});
  Object.defineProperty(details, "_errors", { value: errors, enumerable: false });
  return details;
}

async function fetchSalesSummary() {
  if (!window.SnowlineAuth?.request) return null;
  try {
    const result = await withTimeout(
      window.SnowlineAuth.request({ action: "salesSummary" }),
      SHEET_FETCH_TIMEOUT_MS,
      "매출 요약 조회 응답이 지연되고 있습니다.",
    );
    const details = (result.teams || []).reduce((acc, team) => {
      acc[team.match] = {
        name: team.name,
        sheetName: team.sheetName,
        months: team.months || [],
        annualTarget: toNumber(team.annualTarget),
        annualActual: toNumber(team.annualActual),
        annualRate: toNumber(team.annualRate),
        updatedAt: team.updatedAt,
      };
      return acc;
    }, {});
    Object.defineProperty(details, "_errors", { value: result.errors || [], enumerable: false });
    return details;
  } catch (error) {
    console.warn("Sales summary load failed, falling back to sheet reads.", error);
    return null;
  }
}

async function fetchFirstTeamSheet(team) {
  const candidates = getTeamSheetCandidates(team);
  const errors = [];
  for (const sheetName of candidates) {
    try {
      return {
        rows: await fetchSheet(sheetName),
        sheetName,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      errors.push(`${sheetName}: ${formatLoadError(error)}`);
    }
  }
  throw new Error(errors.join(" / ") || `${team.name} 데이터를 불러오지 못했습니다.`);
}

function buildTeamsFromDetails(teamDetails = {}) {
  const teams = TEAM_SHEETS.map((team) => {
    const detail = teamDetails[team.match];
    if (!detail) return null;
    const month = detail.months?.[state.selectedMonth - 1] || { target: 0, actual: 0, rate: 0 };
    return {
      team: detail.name,
      target: detail.annualTarget,
      actual: detail.annualActual,
      rate: detail.annualRate,
      annualRate: detail.annualRate,
      annualTarget: detail.annualTarget,
      annualActual: detail.annualActual,
      monthlyRate: month.rate,
      monthlyTarget: month.target,
      monthlyActual: month.actual,
      updatedAt: detail.updatedAt,
    };
  }).filter(Boolean);

  return teams.concat(buildTeamTotal(teams));
}

function buildTeamTotal(teams) {
  const total = teams.reduce(
    (acc, team) => {
      acc.target += team.target || 0;
      acc.actual += team.actual || 0;
      acc.annualTarget += team.annualTarget || 0;
      acc.annualActual += team.annualActual || 0;
      acc.monthlyTarget += team.monthlyTarget || 0;
      acc.monthlyActual += team.monthlyActual || 0;
      return acc;
    },
    {
      team: "통합합계",
      target: 0,
      actual: 0,
      annualTarget: 0,
      annualActual: 0,
      monthlyTarget: 0,
      monthlyActual: 0,
    },
  );

  return {
    ...total,
    rate: total.target ? total.actual / total.target : 0,
    annualRate: total.annualTarget ? total.annualActual / total.annualTarget : 0,
    monthlyRate: total.monthlyTarget ? total.monthlyActual / total.monthlyTarget : 0,
    updatedAt: getLatestUpdatedAt(teams),
  };
}

function parseInventoryRanking(products) {
  return products
    .slice()
    .sort((a, b) => compareInventoryProducts(a, b, state.productSort))
    .slice(0, 20)
    .map((product, index) => ({
      rank: index + 1,
      code: product.code,
      name: product.name,
      quantity: product.turnover,
      stock: product.stock,
      amount: product.amount,
    }));
}

function parseInventoryProducts(rows) {
  return rows
    .slice(2)
    .map((row) => {
      const salesQuantity = toNumber(row[INVENTORY_COLUMNS.salesQuantity]);
      const stock = toNumber(row[INVENTORY_COLUMNS.periodStock]);
      const amount = toNumber(row[INVENTORY_COLUMNS.periodCostAmount]);
      const turnover = stock ? salesQuantity / stock : 0;
      const code = String(row[5] || "").trim();
      return {
        code,
        name: row[6],
        salePrice: toNumber(row[8]),
        stock,
        amount,
        status: getTurnoverStatus(turnover),
        turnover,
      };
    })
    .filter(
      (row) =>
        isSnowlineProductCode(row.code) &&
        row.name &&
        !isExcludedInventoryProductName(row.name) &&
        row.stock > 0 &&
        isInventoryStatus(row.status),
    );
}

function isSnowlineProductCode(code) {
  return String(code || "").trim().toUpperCase().startsWith("SN");
}

function isExcludedInventoryProductName(name) {
  return String(name || "").includes("이지캠핑");
}

function parseCs(rows) {
  return rows
    .map((row, index) => ({
      rowNumber: index + 1,
      date: row[0],
      channel: row[1],
      customer: row[2],
      category: row[3],
      code: row[4],
      product: row[5],
      content: row[8],
      totalCost: toNumber(row[14]),
      manager: row[15],
    }))
    .filter((row) => row.rowNumber >= 4 && (row.date || row.product || row.content));
}

function render() {
  const products = filterRows(state.products, ["code", "name"]);
  const teams = filterRows(state.teams, ["team"]);
  const cs = filterCsRows(filterRows(state.cs, ["customer", "category", "code", "product", "content", "manager"]));

  renderKpis();
  renderMonthToggle();
  renderTeamBars(teams);
  renderAchievementTables(teams);
  renderInventory();
  renderProducts(els.topProductsBody, products.slice(0, 10));
  renderProducts(els.productsBody, products);
  renderSales(teams);
  renderCs(cs);
  renderCsSearchSummary(cs);
  renderPriceMonitoring();
  renderInventoryRisk();
  renderActionQueue(teams, cs);
  renderChannelSales();
}

function renderMonthToggle() {
  els.monthToggle.innerHTML = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const active = month === state.selectedMonth ? "active" : "";
    return `<button class="${active}" type="button" data-month="${month}" aria-pressed="${active ? "true" : "false"}">${month}월</button>`;
  }).join("");
}

function renderKpis() {
  const total = state.teams.find((team) => team.team === "통합합계");

  const cards = [
    ["총 매출목표액", formatWon(total?.target || 0), `현재 달성률 ${formatPercent(total?.rate || 0)}`],
    ["현재 달성매출액", formatWon(total?.actual || 0), `목표 대비 ${formatPercent(total?.rate || 0)}`],
    ["월간 달성매출액", formatWon(total?.monthlyActual || 0), `월간 목표 ${formatWon(total?.monthlyTarget || 0)}`],
  ];

  els.kpiGrid.innerHTML = cards
    .map(
      ([label, value, note]) =>
        `<article class="kpi-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`,
    )
    .join("");
}

function renderTeamBars(teams) {
  if (!teams.length) return renderEmpty(els.teamBars, "팀별 실적 데이터가 없습니다.");

  els.teamBars.innerHTML = teams
    .map((team) => {
      const percent = clampPercent(team.rate);
      const statusClass = team.rate >= 1 ? "complete" : team.rate >= 0.7 ? "good" : team.rate >= 0.4 ? "watch" : "low";
      const teamName = escapeHtml(team.team);
      return `<div class="bar-row">
        <span class="bar-label">${teamName}</span>
        <progress class="bar-progress ${statusClass}" value="${percent}" max="100" aria-label="${escapeAttribute(`${team.team} 달성률 ${formatPercent(team.rate)}`)}">${percent}%</progress>
        <span class="bar-value">
          <strong>${formatPercent(team.rate)}</strong>
          <small>연간 ${formatPercent(team.annualRate)} · 월간 ${formatPercent(team.monthlyRate)}</small>
          <small class="bar-updated">업데이트 ${escapeHtml(formatTeamUpdatedAt(team.updatedAt))}</small>
        </span>
      </div>`;
    })
    .join("");
}

function renderAchievementTables(teams) {
  const visibleTeams = teams.filter((team) => team.team !== "통합합계");
  els.monthlyAchievementTitle.textContent = `${state.selectedMonth}월 목표달성률`;
  renderAchievementTable(els.monthlyAchievementBody, visibleTeams, "monthly");
  renderAchievementTable(els.annualAchievementBody, visibleTeams, "annual");
}

function renderAchievementTable(target, teams, period) {
  if (!teams.length) return renderTableEmpty(target, 4, "팀별 목표 데이터가 없습니다.");

  target.innerHTML = teams
    .map((team) => {
      const targetAmount = period === "monthly" ? team.monthlyTarget : team.annualTarget;
      const actualAmount = period === "monthly" ? team.monthlyActual : team.annualActual;
      const rate = period === "monthly" ? team.monthlyRate : team.annualRate;
      return `<tr>
        <td>${escapeHtml(team.team)}</td>
        <td>${formatWon(targetAmount)}</td>
        <td>${formatWon(actualAmount)}</td>
        <td>
          <span class="rate-pill ${getRateClass(rate)}">${formatPercent(rate)}</span>
        </td>
      </tr>`;
    })
    .join("");
}

function renderInventory() {
  if (!state.inventory.length) return renderEmpty(els.inventoryGrid, "재고 트리거 데이터가 없습니다.");
  els.inventoryGrid.innerHTML = state.inventory
    .map((item) => `<button class="inventory-item" type="button" data-status="${escapeAttribute(item.label)}">
      <span>${escapeHtml(item.label)}</span>
      <strong>${formatNumber(item.value)}</strong>
      <small>제품회전율 기준 상세 보기</small>
    </button>`)
    .join("");

  els.inventoryGrid.querySelectorAll(".inventory-item").forEach((button) => {
    button.addEventListener("click", () => openInventoryModal(button.dataset.status));
  });
}

function renderSales(teams) {
  if (!teams.length) return renderTableEmpty(els.salesBody, 5, "팀별 실적 데이터가 없습니다.");
  els.salesBody.innerHTML = teams
    .map((team) => `<tr>
      <td>${escapeHtml(team.team)}</td>
      <td>${formatWon(team.target)}</td>
      <td>${formatWon(team.actual)}</td>
      <td>${formatPercent(team.rate)}</td>
      <td class="progress-cell"><progress class="mini-progress" value="${clampPercent(team.rate)}" max="100" aria-label="${escapeAttribute(`${team.team} 달성률 ${formatPercent(team.rate)}`)}">${formatPercent(team.rate)}</progress></td>
    </tr>`)
    .join("");
}

function renderProducts(target, products) {
  if (!products.length) return renderTableEmpty(target, 6, "제품 판매 데이터가 없습니다.");
  target.innerHTML = products
    .map((product) => `<tr>
      <td>${product.rank}</td>
      <td>${escapeHtml(product.code)}</td>
      <td class="product-name">${escapeHtml(product.name)}</td>
      <td>${formatNumber(product.quantity)}</td>
      <td>${formatNumber(product.stock)}</td>
      <td>${formatWon(product.amount)}</td>
    </tr>`)
    .join("");
}

function renderCs(rows) {
  if (!rows.length) return renderTableEmpty(els.csBody, 9, "CS 상담 데이터가 없습니다.");
  els.csBody.innerHTML = rows
    .map((row) => `<tr>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.channel)}</td>
      <td>${escapeHtml(row.customer)}</td>
      <td>${escapeHtml(row.category)}</td>
      <td class="product-name">${escapeHtml(row.product)}</td>
      <td class="cs-content">${escapeHtml(row.content)}</td>
      <td>${formatWon(row.totalCost)}</td>
      <td>${escapeHtml(row.manager)}</td>
      <td class="table-actions">
        <button class="secondary-button compact-button" type="button" data-cs-edit="${row.rowNumber}">수정</button>
        <button class="danger-button compact-button" type="button" data-cs-delete="${row.rowNumber}">삭제</button>
      </td>
    </tr>`)
    .join("");
}

function filterCsRows(rows) {
  if (!state.csCustomerQuery) return rows;
  return rows.filter((row) => String(row.customer || "").toLowerCase().includes(state.csCustomerQuery));
}

function renderCsSearchSummary(rows) {
  if (!els.csSearchSummary) return;
  const customer = els.csCustomerSearch?.value?.trim();
  if (customer) {
    els.csSearchSummary.textContent = `${customer} 상담내역 ${formatNumber(rows.length)}건`;
    return;
  }
  els.csSearchSummary.textContent = `전체 상담내역 ${formatNumber(state.cs.length)}건`;
}

async function deleteCs(rowNumber) {
  const row = state.cs.find((item) => item.rowNumber === rowNumber);
  if (!row) {
    setCsEntryMessage("삭제할 CS 상담을 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.", "error");
    return;
  }

  const subject = row.customer || row.product || row.content || "선택한 상담";
  if (!window.confirm(`"${subject}" 상담내역을 삭제할까요? 삭제 후에는 화면에서 복구할 수 없습니다.`)) return;

  setCsEntryMessage("CS 상담을 삭제하는 중입니다.");
  try {
    await window.SnowlineAuth.request({ action: "deleteCs", rowNumber });
    if (els.csEntryForm?.elements?.rowNumber?.value === String(rowNumber)) {
      els.csEntryForm.reset();
      setCsEditMode(null);
      setDefaultCsDate();
      setDefaultCsManager();
    }
    await loadDashboard();
    setCsEntryMessage("CS 상담이 삭제되었습니다.", "ready");
  } catch (error) {
    setCsEntryMessage(error.message || "CS 상담을 삭제하지 못했습니다.", "error");
  }
}

async function handleCsSubmit(event) {
  event.preventDefault();
  if (!els.csEntryForm) return;

  const form = new FormData(els.csEntryForm);
  const rawDate = form.get("date");
  const entry = {
    rowNumber: Number(form.get("rowNumber")) || 0,
    date: rawDate ? normalizeCsDate(rawDate) : "",
    channel: form.get("channel"),
    customer: form.get("customer"),
    category: form.get("category"),
    code: form.get("code"),
    product: form.get("product"),
    content: form.get("content"),
    totalCost: form.get("totalCost"),
    manager: getCurrentAccountName(),
  };

  if (!String(entry.channel || "").trim()) {
    setCsEntryMessage("채널을 입력해주세요.", "error");
    return;
  }
  if (!String(entry.content || "").trim()) {
    setCsEntryMessage("상담내용을 입력해주세요.", "error");
    return;
  }

  const registeredCustomer = String(entry.customer || "").trim();
  const isEdit = Boolean(entry.rowNumber);

  setCsEntryMessage(isEdit ? "CS 상담을 수정하는 중입니다." : "CS 상담을 등록하는 중입니다.");
  try {
    await window.SnowlineAuth.request({ action: isEdit ? "updateCs" : "addCs", entry });
    els.csEntryForm.reset();
    setCsEditMode(null);
    setDefaultCsDate();
    if (registeredCustomer) {
      state.csCustomerQuery = registeredCustomer.toLowerCase();
      if (els.csCustomerSearch) els.csCustomerSearch.value = registeredCustomer;
      state.query = "";
      if (els.searchInput) els.searchInput.value = "";
    } else {
      state.csCustomerQuery = "";
      if (els.csCustomerSearch) els.csCustomerSearch.value = "";
      state.query = "";
      if (els.searchInput) els.searchInput.value = "";
    }
    await loadDashboard();
    if (registeredCustomer) {
      setCsEntryMessage(`CS 상담이 ${isEdit ? "수정" : "등록"}되었습니다. "${registeredCustomer}" 고객명으로 조회했습니다.`, "ready");
    } else {
      setCsEntryMessage(`CS 상담이 ${isEdit ? "수정" : "등록"}되었습니다.`, "ready");
    }
  } catch (error) {
    setCsEntryMessage(error.message || `CS 상담을 ${isEdit ? "수정" : "등록"}하지 못했습니다.`, "error");
  }
}

function startCsEdit(rowNumber) {
  if (!els.csEntryForm || !rowNumber) return;
  const row = state.cs.find((item) => item.rowNumber === rowNumber);
  if (!row) {
    setCsEntryMessage("수정할 CS 상담을 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.", "error");
    return;
  }

  const form = els.csEntryForm.elements;
  form.rowNumber.value = row.rowNumber;
  form.date.value = toDateTimeLocalValue(row.date);
  form.channel.value = row.channel || "";
  form.customer.value = row.customer || "";
  form.category.value = row.category || "";
  form.code.value = row.code || "";
  form.product.value = row.product || "";
  form.content.value = row.content || "";
  form.totalCost.value = row.totalCost ? String(row.totalCost) : "";
  form.manager.value = getCurrentAccountName();
  setCsEditMode(row.rowNumber);
  setCsEntryMessage("CS 상담 내용을 수정한 뒤 CS 수정 버튼을 눌러주세요.", "ready");
  els.csEntryForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setCsEditMode(rowNumber) {
  if (els.csEntryForm?.elements?.rowNumber) {
    els.csEntryForm.elements.rowNumber.value = rowNumber || "";
  }
  if (els.csSubmitButton) {
    els.csSubmitButton.textContent = rowNumber ? "CS 수정" : "CS 등록";
  }
}

function setDefaultCsDate() {
  const dateInput = els.csEntryForm?.elements?.date;
  if (!dateInput || dateInput.value) return;

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  dateInput.value = now.toISOString().slice(0, 16);
}

function setDefaultCsManager() {
  const managerInput = els.csEntryForm?.elements?.manager;
  if (!managerInput) return;
  managerInput.value = getCurrentAccountName();
}

function getCurrentAccountName() {
  const user = window.SnowlineAuth?.getSession?.()?.user;
  return user?.displayName || user?.userId || "";
}

function normalizeCsDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toLocaleString("ko-KR");
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("ko-KR");
}

function toDateTimeLocalValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = raw
    .replace(/\.\s*/g, "-")
    .replace(/-\s*(오전|AM)\s*/i, " ")
    .replace(/-\s*(오후|PM)\s*/i, " PM ")
    .replace(/\s*(오전|AM)\s*/i, " ")
    .replace(/\s*(오후|PM)\s*/i, " PM ");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function setCsEntryMessage(message, type = "") {
  if (!els.csEntryMessage) return;
  els.csEntryMessage.textContent = message;
  els.csEntryMessage.className = `form-status ${type}`.trim();
}

function renderPriceMonitoring() {
  if (!els.priceMonitorBody) return;
  syncPriceSortButtons();
  renderLowestProducts();
  renderLowestWatchDashboard();
  const items = visibleLowestPriceRows().slice().sort((a, b) => comparePriceItems(a, b, state.priceSort));
  const sourceLabel = state.priceMonitor.usingApi ? "네이버 API 조회" : "구글시트 참고";
  els.priceMonitorSummary.textContent = items.length
    ? `${sourceLabel} ${formatNumber(items.length)}개 · ${getPriceSortLabel(state.priceSort)}`
    : "최저가 API 연결 대기";

  if (!items.length) {
    renderTableEmpty(els.priceMonitorBody, 8, "API 주소를 저장하거나 구글시트 가격 데이터를 확인해주세요.");
    return;
  }

  els.priceMonitorBody.innerHTML = items
    .map((item) => `<tr>
      <td class="product-name">${escapeHtml(item.name)}</td>
      <td>${formatWon(item.basePrice)}</td>
      <td>${formatWon(item.lowestPrice)}</td>
      <td>${formatPercent(item.dropRate)}</td>
      <td>${formatWon(item.dropAmount)}</td>
      <td>${escapeHtml(item.seller)}</td>
      <td>${formatUrl(item.url)}</td>
      <td>${escapeHtml(item.note)}</td>
    </tr>`)
    .join("");
}

async function loadLowestPriceService() {
  const apiBase = normalizeApiBase(els.lowestApiBase?.value || state.priceMonitor.apiBaseUrl);
  state.priceMonitor.apiBaseUrl = apiBase;
  storeValue(LOWEST_PRICE_API_STORAGE_KEY, apiBase);

  if (!apiBase) {
    state.priceMonitor.usingApi = false;
    setLowestStatus("API 주소 미설정 · 구글시트 참고 데이터 표시", "idle");
    renderPriceMonitoring();
    return;
  }

  setLowestStatus("최저가 API 연결 확인 중", "loading");
  try {
    const [config, productPayload, alertSettings] = await Promise.all([
      lowestApi("/api/config"),
      lowestApi("/api/products"),
      lowestApi("/api/alert-settings"),
    ]);
    state.priceMonitor.config = {
      ...state.priceMonitor.config,
      ...config,
    };
    const serverProducts = Array.isArray(productPayload.products) ? productPayload.products.map(createLowestProduct) : [];
    if (serverProducts.length) {
      state.priceMonitor.products = serverProducts.filter((product) => product.name && product.base_price);
      saveLowestProducts();
    } else if (state.priceMonitor.products.length) {
      await syncLowestProducts();
    }
    state.priceMonitor.alertSettings = {
      email_recipients: parseRecipientList(alertSettings.email_recipients),
    };
    els.lowestEmailRecipients.value = recipientsToText(state.priceMonitor.alertSettings.email_recipients);
    saveLowestEmailToStorage();
    state.priceMonitor.usingApi = true;
    setLowestStatus(config.credentials_configured ? "최저가 API 연결됨" : "API 연결됨 · 네이버 키 확인 필요", config.credentials_configured ? "ready" : "warn");
    await loadLowestPriceEvents();
  } catch (error) {
    state.priceMonitor.usingApi = false;
    setLowestStatus(`API 연결 실패 · ${error.message}`, "error");
    renderPriceMonitoring();
  }
}

async function checkLowestPrices() {
  seedLowestProductsFromSheets();
  if (!state.priceMonitor.products.length) {
    setLowestStatus("조회할 상품이 없습니다.", "warn");
    return;
  }

  setLowestButtonBusy(els.lowestCheckButton, true, "조회중");
  setLowestStatus("네이버 최저가 조회 중", "loading");
  try {
    const payload = await lowestApi("/api/check", {
      method: "POST",
      body: JSON.stringify({
        products: state.priceMonitor.products,
        display: Number(els.lowestDisplayCount?.value || 100),
        price_first: Boolean(els.lowestPriceFirst?.checked),
        price_tolerance_percent: LOWEST_PRICE_TOLERANCE_PERCENT,
        exclude: els.lowestExcludeSpecial?.checked ? state.priceMonitor.config.default_exclude : "",
        seller_exclude: state.priceMonitor.config.default_seller_exclude || "쿠팡",
      }),
    });
    const allResults = Array.isArray(payload.results) ? payload.results : [];
    state.priceMonitor.results = allResults.filter(hasPositiveLowestDrop).map(normalizeLowestResult);
    state.priceMonitor.hasChecked = true;
    state.priceMonitor.usingApi = true;
    setLowestStatus(
      state.priceMonitor.results.length
        ? `${formatNumber(state.priceMonitor.results.length)}개 하락 상품 표시`
        : "기준가격보다 낮은 상품 없음",
      "ready",
    );
    renderPriceMonitoring();
  } finally {
    setLowestButtonBusy(els.lowestCheckButton, false, "", "조회");
  }
}

async function loadLowestPriceEvents() {
  if (!normalizeApiBase(state.priceMonitor.apiBaseUrl)) {
    renderLowestWatchDashboard();
    return;
  }
  const payload = await lowestApi("/api/price-events?days=14&limit=80");
  state.priceMonitor.priceEvents = payload || {};
  renderLowestWatchDashboard();
}

async function addLowestProduct(event) {
  event.preventDefault();
  const product = createLowestProduct({
    name: els.lowestProductName?.value,
    base_price: els.lowestBasePrice?.value,
  });
  if (!product.name || !product.base_price) {
    setLowestStatus("상품명과 기준가격을 입력해주세요.", "warn");
    return;
  }
  upsertLowestProducts([product], { replace: false });
  els.lowestProductForm.reset();
  await syncLowestProducts();
  renderLowestProducts();
  setLowestStatus("상품을 반영했습니다.", "ready");
}

async function deleteLowestProduct(productId) {
  state.priceMonitor.products = state.priceMonitor.products.filter((product) => product.id !== productId);
  saveLowestProducts();
  await syncLowestProducts();
  renderLowestProducts();
}

async function clearLowestProducts() {
  state.priceMonitor.products = [];
  state.priceMonitor.results = [];
  state.priceMonitor.hasChecked = false;
  saveLowestProducts();
  await syncLowestProducts();
  renderLowestProducts();
  renderPriceMonitoring();
  setLowestStatus("상품 목록을 비웠습니다.", "ready");
}

async function importLowestBulkProducts() {
  const products = parseLowestBulkProducts(els.lowestBulkInput?.value || "");
  if (!products.length) {
    setLowestStatus("붙여넣기 목록을 확인해주세요.", "warn");
    return;
  }
  if (products.some((product) => !product.base_price)) {
    setLowestStatus("붙여넣기는 상품명, 기준가격 형식으로 입력해주세요.", "warn");
    return;
  }
  upsertLowestProducts(products, { replace: true });
  els.lowestBulkInput.value = "";
  await syncLowestProducts();
  renderLowestProducts();
  setLowestStatus(`${formatNumber(products.length)}개 상품을 반영했습니다.`, "ready");
}

async function importLowestExcelProducts() {
  const file = els.lowestExcelFile?.files?.[0];
  if (!file) {
    setLowestStatus("엑셀 파일을 선택해주세요.", "warn");
    return;
  }
  if (!normalizeApiBase(state.priceMonitor.apiBaseUrl)) {
    setLowestStatus("엑셀 업로드는 최저가 API 연결 후 사용할 수 있습니다.", "warn");
    return;
  }
  setLowestButtonBusy(els.lowestExcelImport, true, "반영중");
  try {
    const contentBase64 = await fileToBase64(file);
    const payload = await lowestApi("/api/products/import-xlsx", {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        content_base64: contentBase64,
      }),
    });
    state.priceMonitor.products = (payload.products || []).map(createLowestProduct);
    saveLowestProducts();
    els.lowestExcelFile.value = "";
    renderLowestProducts();
    setLowestStatus(`${formatNumber(payload.imported_count || state.priceMonitor.products.length)}개 상품을 엑셀에서 반영했습니다.`, "ready");
  } finally {
    setLowestButtonBusy(els.lowestExcelImport, false, "", "엑셀 반영");
  }
}

async function saveLowestEmailSettings(event) {
  event.preventDefault();
  const recipients = parseRecipientList(els.lowestEmailRecipients?.value);
  state.priceMonitor.alertSettings.email_recipients = recipients;
  saveLowestEmailToStorage();
  if (normalizeApiBase(state.priceMonitor.apiBaseUrl)) {
    const payload = await lowestApi("/api/alert-settings", {
      method: "POST",
      body: JSON.stringify({ email_recipients: recipients }),
    });
    state.priceMonitor.alertSettings.email_recipients = parseRecipientList(payload.email_recipients);
    saveLowestEmailToStorage();
  }
  renderLowestEmailStatus();
  setLowestStatus("메일 수신 설정을 저장했습니다.", "ready");
}

async function syncLowestProducts() {
  saveLowestProducts();
  const apiBase = normalizeApiBase(state.priceMonitor.apiBaseUrl);
  if (!apiBase) return;
  const payload = await lowestApi("/api/products/import", {
    method: "POST",
    body: JSON.stringify({ products: state.priceMonitor.products }),
  });
  if (Array.isArray(payload.products)) {
    state.priceMonitor.products = payload.products.map(createLowestProduct);
    saveLowestProducts();
  }
}

function renderLowestProducts() {
  if (!els.lowestProductRows) return;
  if (!state.priceMonitor.products.length) {
    renderTableEmpty(els.lowestProductRows, 3, "등록된 상품이 없습니다.");
    return;
  }

  els.lowestProductRows.innerHTML = state.priceMonitor.products
    .slice(0, 80)
    .map((product) => `<tr>
      <td class="product-name">${escapeHtml(product.name)}</td>
      <td>${formatWon(product.base_price)}</td>
      <td><button class="icon-button" type="button" title="삭제" data-lowest-delete="${escapeAttribute(product.id)}">×</button></td>
    </tr>`)
    .join("");
}

function renderLowestWatchDashboard() {
  renderLowestEmailStatus();
  renderLowestWatchSummary();
  renderLowestSellerPatterns();
  renderLowestEvents();
}

function renderLowestEmailStatus() {
  if (!els.lowestEmailStatus) return;
  const recipients = state.priceMonitor.alertSettings.email_recipients || [];
  const emailReady = Boolean(state.priceMonitor.config.monitor?.email_configured);
  els.lowestEmailStatus.textContent = recipients.length
    ? emailReady
      ? `저장됨 · ${formatNumber(recipients.length)}명`
      : `저장됨 · SMTP 확인 필요`
    : "수신 메일 미설정";
}

function renderLowestWatchSummary() {
  if (!els.lowestWatchSummary) return;
  const data = state.priceMonitor.priceEvents || {};
  const items = [
    ["감시 기간", `최근 ${data.period_days || 14}일`],
    ["인하 이벤트", `${formatNumber(data.event_count || 0)}건`],
    ["판매처", `${formatNumber(data.seller_count || 0)}곳`],
    ["상품", `${formatNumber(data.product_count || 0)}개`],
    ["현재 하락", `${formatNumber(data.active_down_count || 0)}건`],
  ];
  els.lowestWatchSummary.innerHTML = items
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

function renderLowestSellerPatterns() {
  if (!els.lowestSellerPatternRows) return;
  const rows = state.priceMonitor.priceEvents?.seller_stats || [];
  if (!rows.length) {
    renderTableEmpty(els.lowestSellerPatternRows, 6, "감지된 판매처 패턴이 없습니다.");
    return;
  }
  els.lowestSellerPatternRows.innerHTML = rows
    .slice(0, 20)
    .map((row) => `<tr>
      <td class="product-name">${escapeHtml(row.seller_business_name || "-")}</td>
      <td>${formatNumber(row.event_count || 0)}</td>
      <td>${formatNumber(row.product_count || 0)}</td>
      <td>${formatPercent(toRate(row.avg_drop_percent))}</td>
      <td>${formatPercent(toRate(row.max_drop_percent))}</td>
      <td>${formatHour(row.hot_hour)}</td>
    </tr>`)
    .join("");
}

function renderLowestEvents() {
  if (!els.lowestEventRows) return;
  const rows = state.priceMonitor.priceEvents?.recent_events || [];
  if (!rows.length) {
    renderTableEmpty(els.lowestEventRows, 6, "최근 감지 이벤트가 없습니다.");
    return;
  }
  els.lowestEventRows.innerHTML = rows
    .slice(0, 50)
    .map((event) => `<tr>
      <td>${escapeHtml(formatDateTime(event.observed_at))}</td>
      <td>${escapeHtml(event.event_label || event.event_type || "-")}</td>
      <td class="product-name">${escapeHtml(event.product_name || "-")}</td>
      <td>${escapeHtml(event.seller_business_name || "-")}</td>
      <td>${formatWon(event.lowest_price)}</td>
      <td>${formatUrl(event.seller_url)}</td>
    </tr>`)
    .join("");
}

function visibleLowestPriceRows() {
  const keyword = normalizeSearchValue(els.lowestResultSearch?.value || "");
  const rows = lowestPriceRows();
  if (!keyword) return rows;
  return rows.filter((row) => normalizeSearchValue(`${row.name} ${row.title} ${row.seller} ${row.note}`).includes(keyword));
}

function lowestPriceRows() {
  if (state.priceMonitor.results.length) {
    return state.priceMonitor.results;
  }
  return state.priceItems.map((item) => ({
    name: item.name,
    title: item.name,
    basePrice: item.basePrice,
    lowestPrice: item.lowestPrice,
    dropRate: item.dropRate,
    dropAmount: item.dropAmount,
    seller: item.seller || "구글시트",
    url: item.url || "",
    note: item.note || "구글시트 참고 데이터",
  }));
}

function normalizeLowestResult(result) {
  const basePrice = toNumber(result.base_price ?? result.basePrice);
  const lowestPrice = toNumber(result.lowest_price ?? result.lowestPrice);
  const dropAmount = toNumber(result.drop_amount ?? result.dropAmount ?? basePrice - lowestPrice);
  const rawDropRate = result.drop_percent ?? result.dropRate ?? (basePrice ? dropAmount / basePrice : 0);
  return {
    id: String(result.id || result.product_id || createId()),
    name: String(result.product_name || result.name || "").trim(),
    title: String(result.title || "").trim(),
    basePrice,
    lowestPrice,
    dropRate: Number(rawDropRate) > 1 ? Number(rawDropRate) / 100 : Number(rawDropRate || 0),
    dropAmount,
    seller: String(result.seller_business_name || result.seller || "-").trim(),
    url: String(result.seller_url || result.url || "").trim(),
    note: String(result.note || result.error || "").trim(),
    status: result.status || "ok",
  };
}

function hasPositiveLowestDrop(result) {
  if (!result || result.status !== "ok") return false;
  return Number(result.drop_amount) > 0 || Number(result.drop_percent) > 0;
}

function seedLowestProductsFromSheets() {
  if (state.priceMonitor.products.length || !state.priceItems.length) return;
  const seeded = state.priceItems
    .slice(0, 80)
    .map((item) => createLowestProduct({ name: item.name, base_price: item.basePrice, source: "sheet" }))
    .filter((product) => product.name && product.base_price);
  upsertLowestProducts(seeded, { replace: false });
  renderLowestProducts();
}

function upsertLowestProducts(products, { replace = false } = {}) {
  const merged = new Map();
  if (!replace) {
    state.priceMonitor.products.forEach((product) => merged.set(lowestProductKey(product), product));
  }
  products.map(createLowestProduct).forEach((product) => {
    if (product.name && product.base_price) merged.set(lowestProductKey(product), product);
  });
  state.priceMonitor.products = Array.from(merged.values());
  saveLowestProducts();
}

function createLowestProduct(payload = {}) {
  return {
    id: String(payload.id || createId()),
    name: String(payload.name || payload.product_name || "").trim(),
    base_price: parsePriceValue(payload.base_price ?? payload.basePrice),
    manager_name: String(payload.manager_name || payload.manager || "").trim(),
    manager_email: String(payload.manager_email || payload.email || "").trim(),
    kakao_receiver_uuids: String(payload.kakao_receiver_uuids || payload.kakao_receiver_uuid || payload.kakao_uuid || "").trim(),
    source: String(payload.source || "manual").trim() || "manual",
  };
}

function lowestProductKey(product) {
  return `${normalizeSearchValue(product.name)}|${product.base_price || ""}`;
}

function parseLowestBulkProducts(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, basePrice] = line.split(/,|\t/);
      return createLowestProduct({ name, base_price: basePrice });
    })
    .filter((product) => product.name);
}

async function lowestApi(path, options = {}) {
  const apiBase = normalizeApiBase(state.priceMonitor.apiBaseUrl);
  if (!apiBase) throw new Error("최저가 API 주소를 먼저 저장해주세요.");
  const response = await fetch(`${apiBase}${path}`, {
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "최저가 API 요청에 실패했습니다.");
  }
  return payload;
}

function setLowestStatus(message, type = "idle") {
  state.priceMonitor.message = message;
  if (!els.lowestApiStatus) return;
  els.lowestApiStatus.textContent = message;
  els.lowestApiStatus.dataset.status = type;
}

function setLowestButtonBusy(button, isBusy, busyText, defaultText) {
  if (!button) return;
  button.disabled = isBusy;
  if (busyText && isBusy) button.textContent = busyText;
  if (defaultText && !isBusy) button.textContent = defaultText;
}

function saveLowestProducts() {
  storeJson(LOWEST_PRICE_PRODUCTS_STORAGE_KEY, state.priceMonitor.products);
}

function saveLowestEmailToStorage() {
  const text = recipientsToText(state.priceMonitor.alertSettings.email_recipients || []);
  storeValue(LOWEST_PRICE_EMAIL_STORAGE_KEY, text);
}

function parseRecipientList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.flatMap((item) => parseRecipientList(item))));
  }
  return Array.from(
    new Set(
      String(value || "")
        .split(/[,;\n]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function recipientsToText(value) {
  return parseRecipientList(value).join(", ");
}

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parsePriceValue(value) {
  const parsed = toNumber(value);
  return parsed > 0 ? parsed : 0;
}

function normalizeSearchValue(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function toRate(value) {
  const number = Number(value || 0);
  return number > 1 ? number / 100 : number;
}

function formatHour(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `${String(value).padStart(2, "0")}시`;
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadStoredValue(key, fallback = "") {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function storeValue(key, value) {
  try {
    localStorage.setItem(key, String(value || ""));
  } catch {
    // Browser storage can be blocked by private mode; the API remains the source of truth.
  }
}

function loadStoredJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(fallback) ? (Array.isArray(parsed) ? parsed : fallback) : parsed || fallback;
  } catch {
    return fallback;
  }
}

function storeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local storage failures.
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",", 2)[1] : result);
    };
    reader.onerror = () => reject(new Error("엑셀 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function exportLowestCsv() {
  const rows = visibleLowestPriceRows().slice().sort((a, b) => comparePriceItems(a, b, state.priceSort));
  if (!rows.length) {
    setLowestStatus("내보낼 조회 결과가 없습니다.", "warn");
    return;
  }
  const headers = ["상품명", "기준가격", "최저가", "하락률", "하락액", "판매처 사업자명", "판매처 URL", "비고"];
  const csvRows = rows.map((row) => [
    row.name,
    row.basePrice,
    row.lowestPrice,
    (row.dropRate * 100).toFixed(2),
    row.dropAmount,
    row.seller,
    row.url,
    row.note,
  ]);
  const csv = [headers, ...csvRows].map((row) => row.map(toCsvCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `snowline-lowest-price-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toCsvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function renderInventoryRisk() {
  if (!els.inventoryRiskBody) return;
  const products = getInventoryRiskProducts();
  els.inventoryRiskSummary.textContent = products.length
    ? `위험/처분/관심 ${formatNumber(products.length)}개`
    : "재고 위험 품목 없음";

  if (!products.length) {
    renderTableEmpty(els.inventoryRiskBody, 7, "재고 위험 품목이 없습니다.");
    return;
  }

  els.inventoryRiskBody.innerHTML = products.slice(0, 50)
    .map((product) => `<tr>
      <td><span class="status-pill ${getInventoryStatusKey(product.status)}">${escapeHtml(product.status)}</span></td>
      <td>${escapeHtml(product.code)}</td>
      <td class="product-name">${escapeHtml(product.name)}</td>
      <td>${formatNumber(product.turnover)}</td>
      <td>${formatNumber(product.stock)}</td>
      <td>${formatWon(product.amount)}</td>
      <td>${escapeHtml(getInventoryActionLabel(product.status))}</td>
    </tr>`)
    .join("");
}

function renderActionQueue(teams, cs) {
  if (!els.actionQueueBody) return;
  state.actionItems = buildActionItems(teams, cs);
  els.actionSummary.textContent = state.actionItems.length
    ? `처리 필요 ${formatNumber(state.actionItems.length)}건`
    : "처리 필요 항목 없음";

  if (!state.actionItems.length) {
    renderTableEmpty(els.actionQueueBody, 5, "처리 필요 항목이 없습니다.");
    return;
  }

  els.actionQueueBody.innerHTML = state.actionItems
    .map((item) => renderActionRow(item))
    .join("");
}

function renderChannelSales() {
  if (!els.channelSalesBody) return;
  const channels = buildChannelOperations();
  els.channelSummary.textContent = channels.length
    ? `CS DB 기준 ${formatNumber(channels.length)}개 채널`
    : "채널 데이터 없음";

  if (!channels.length) {
    renderTableEmpty(els.channelSalesBody, 6, "CS DB 채널 데이터가 없습니다.");
    return;
  }

  els.channelSalesBody.innerHTML = channels
    .map((channel) => `<tr>
      <td>${escapeHtml(channel.channel)}</td>
      <td>${formatNumber(channel.count)}건</td>
      <td>${formatWon(channel.cost)}</td>
      <td>${formatPercent(channel.share)}</td>
      <td class="product-name">${escapeHtml(channel.topProduct)}</td>
      <td>${escapeHtml(channel.note)}</td>
    </tr>`)
    .join("");
}

function buildActionItems(teams, cs) {
  const actions = [];
  teams
    .filter((team) => team.team !== "통합합계" && team.monthlyRate < 0.7)
    .forEach((team) => {
      actions.push({
        type: "매출",
        item: team.team,
        basis: `${state.selectedMonth}월 달성률 ${formatPercent(team.monthlyRate)}`,
        priority: team.monthlyRate < 0.4 ? "높음" : "보통",
        status: "확인",
      });
    });

  getInventoryRiskProducts().slice(0, 12).forEach((product) => {
    actions.push({
      type: "재고",
      item: product.name,
      basis: `${product.status} · 재고금액(원가) ${formatWon(product.amount)}`,
      priority: product.status === "위험" || product.status === "처분" ? "높음" : "보통",
      status: "검토",
    });
  });

  buildCsIssueItems(cs).forEach((issue) => actions.push(issue));
  return actions.sort((a, b) => getPriorityRank(a.priority) - getPriorityRank(b.priority));
}

function buildCsIssueItems(cs) {
  const counts = cs.reduce((acc, row) => {
    const key = row.product || row.category;
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({
      type: "CS",
      item: name,
      basis: `상담 ${formatNumber(count)}건`,
      priority: count >= 5 ? "높음" : "보통",
      status: "확인",
    }));
}

function buildChannelOperations() {
  const totalCount = state.cs.length;
  const groups = state.cs.reduce((acc, row) => {
    const channel = row.channel || "미지정";
    if (!acc[channel]) acc[channel] = { channel, count: 0, cost: 0, products: {} };
    acc[channel].count += 1;
    acc[channel].cost += row.totalCost || 0;
    if (row.product) acc[channel].products[row.product] = (acc[channel].products[row.product] || 0) + 1;
    return acc;
  }, {});

  return Object.values(groups)
    .map((group) => {
      const topProduct = Object.entries(group.products).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
      return {
        ...group,
        share: totalCount ? group.count / totalCount : 0,
        topProduct,
        note: "CS DB 접수채널 기준",
      };
    })
    .sort((a, b) => b.count - a.count || b.cost - a.cost);
}

function renderActionRow(item) {
  return `<tr>
    <td>${escapeHtml(item.type)}</td>
    <td class="product-name">${escapeHtml(item.item)}</td>
    <td>${escapeHtml(item.basis)}</td>
    <td><span class="status-pill ${getPriorityClass(item.priority)}">${escapeHtml(item.priority)}</span></td>
    <td>${escapeHtml(item.status)}</td>
  </tr>`;
}

function getInventoryRiskProducts() {
  return state.inventoryProducts
    .filter((product) => ["위험", "처분", "관심"].includes(product.status))
    .sort((a, b) => {
      const priority = { 처분: 0, 위험: 1, 관심: 2 };
      return priority[a.status] - priority[b.status] || b.amount - a.amount;
    });
}

function comparePriceItems(a, b, sortKey) {
  if (sortKey === "name-asc") return String(a.name || "").localeCompare(String(b.name || ""), "ko");
  if (sortKey === "name-desc") return String(b.name || "").localeCompare(String(a.name || ""), "ko");
  if (sortKey === "base-price-desc") return Number(b.basePrice || 0) - Number(a.basePrice || 0);
  if (sortKey === "base-price-asc") return Number(a.basePrice || 0) - Number(b.basePrice || 0);
  if (sortKey === "lowest-price-asc") return Number(a.lowestPrice || 0) - Number(b.lowestPrice || 0);
  if (sortKey === "lowest-price-desc") return Number(b.lowestPrice || 0) - Number(a.lowestPrice || 0);
  if (sortKey === "drop-amount-desc") return Number(b.dropAmount || 0) - Number(a.dropAmount || 0);
  if (sortKey === "drop-amount-asc") return Number(a.dropAmount || 0) - Number(b.dropAmount || 0);
  if (sortKey === "drop-rate-asc") return Number(a.dropRate || 0) - Number(b.dropRate || 0);
  return Number(b.dropRate || 0) - Number(a.dropRate || 0);
}

function getNextPriceSort(requestedSort) {
  if (!requestedSort) return state.priceSort;
  const root = priceSortRoot(requestedSort);
  const currentRoot = priceSortRoot(state.priceSort);
  if (root !== currentRoot) return requestedSort;
  return state.priceSort.endsWith("-asc") ? `${root}-desc` : `${root}-asc`;
}

function syncPriceSortButtons() {
  document.querySelectorAll("[data-price-sort]").forEach((button) => {
    const sort = button.dataset.priceSort;
    const active = priceSortRoot(state.priceSort) === priceSortRoot(sort);
    button.classList.toggle("active", active);
    button.textContent = getPriceSortButtonLabel(button.textContent.replace(/[↑↓]/g, "").trim(), sort, active);
  });
}

function priceSortRoot(sort) {
  return String(sort || "").replace(/-(asc|desc)$/, "");
}

function getPriceSortButtonLabel(label, sort, active) {
  if (!active || !sort) return label;
  const direction = state.priceSort.endsWith("-asc") ? "↑" : "↓";
  return `${label} ${direction}`;
}

function getPriceSortLabel(sortKey) {
  if (sortKey === "name-asc") return "상품명순";
  if (sortKey === "name-desc") return "상품명 역순";
  if (sortKey === "base-price-desc") return "기준가격 높은순";
  if (sortKey === "base-price-asc") return "기준가격 낮은순";
  if (sortKey === "lowest-price-asc") return "최저가 낮은순";
  if (sortKey === "lowest-price-desc") return "최저가 높은순";
  if (sortKey === "drop-amount-desc") return "하락액 큰순";
  if (sortKey === "drop-amount-asc") return "하락액 작은순";
  if (sortKey === "drop-rate-asc") return "하락률 낮은순";
  return "하락률 높은순";
}

function getInventoryActionLabel(status) {
  if (status === "위험") return "품절/재고 검토";
  if (status === "처분") return "처분/재고 검토";
  return "회전율 확인";
}

function normalizeInventoryStatus(status) {
  if (status.includes("위험")) return "위험";
  if (status.includes("처분")) return "처분";
  if (status.includes("관심")) return "관심";
  if (status.includes("안전")) return "안전";
  return status;
}

function getPriorityRank(priority) {
  return priority === "높음" ? 0 : priority === "보통" ? 1 : 2;
}

function getPriorityClass(priority) {
  return priority === "높음" ? "danger" : priority === "보통" ? "watch" : "safe";
}

function formatUrl(url) {
  if (!url) return "-";
  return `<a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">열기</a>`;
}

function setupAdminView(user) {
  document.body.classList.toggle("auth-admin", user?.role === "admin");
}

async function loadMembers() {
  if (!document.body.classList.contains("auth-admin")) return;
  if (!els.membersBody || !els.membersSummary) return;

  els.membersSummary.textContent = "회원 목록을 불러오는 중입니다.";
  renderTableEmpty(els.membersBody, 7, "회원 목록을 불러오는 중입니다.");

  try {
    const result = await window.SnowlineAuth.request({ action: "listUsers" });
    renderMembers(result.users || []);
  } catch (error) {
    els.membersSummary.textContent = error.message || "회원 목록을 불러오지 못했습니다.";
    renderTableEmpty(els.membersBody, 7, "회원 목록을 불러오지 못했습니다.");
  }
}

function renderMembers(users) {
  const counts = users.reduce((acc, user) => {
    acc[user.status] = (acc[user.status] || 0) + 1;
    return acc;
  }, {});
  els.membersSummary.textContent = `전체 ${formatNumber(users.length)}명 · 승인 ${formatNumber(counts.approved || 0)}명 · 대기 ${formatNumber(counts.pending || 0)}명 · 차단 ${formatNumber(counts.rejected || 0)}명`;

  if (!users.length) {
    renderTableEmpty(els.membersBody, 7, "등록된 회원이 없습니다.");
    return;
  }

  els.membersBody.innerHTML = users
    .map((user) => `<tr>
      <td>${escapeHtml(user.userId)}</td>
      <td>${escapeHtml(user.displayName)}</td>
      <td>${escapeHtml(getRoleLabel(user.role))}</td>
      <td><span class="status-pill ${escapeAttribute(user.status)}">${escapeHtml(getMemberStatusLabel(user.status))}</span></td>
      <td>${escapeHtml(formatDateTime(user.createdAt))}</td>
      <td>${escapeHtml(formatDateTime(user.lastLoginAt))}</td>
      <td class="member-actions">${renderMemberActions(user)}</td>
    </tr>`)
    .join("");
}

function renderMemberActions(user) {
  if (user.role === "admin") return `<span class="member-note">관리자 보호</span>`;
  if (user.status === "pending") {
    return `<button type="button" data-member-action="approved" data-user-id="${escapeAttribute(user.userId)}">승인</button>
      <button class="danger" type="button" data-member-action="rejected" data-user-id="${escapeAttribute(user.userId)}">반려</button>`;
  }
  if (user.status === "approved") {
    return `<button class="danger" type="button" data-member-action="rejected" data-user-id="${escapeAttribute(user.userId)}">강제 탈퇴</button>`;
  }
  return `<button type="button" data-member-action="approved" data-user-id="${escapeAttribute(user.userId)}">재승인</button>`;
}

async function updateMemberStatus(userId, status) {
  if (!userId || !status) return;
  els.membersSummary.textContent = "회원 상태를 변경하는 중입니다.";

  try {
    await window.SnowlineAuth.request({ action: "setUserStatus", userId, status });
    await loadMembers();
  } catch (error) {
    els.membersSummary.textContent = error.message || "회원 상태를 변경하지 못했습니다.";
  }
}

function getRoleLabel(role) {
  return role === "admin" ? "관리자" : "일반";
}

function getMemberStatusLabel(status) {
  if (status === "approved") return "승인";
  if (status === "pending") return "대기";
  if (status === "rejected") return "차단";
  return status || "-";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

function formatTeamUpdatedAt(value) {
  if (!value) return "확인 안됨";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLatestUpdatedAt(teams) {
  return teams
    .map((team) => new Date(team.updatedAt).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
}

function filterRows(rows, keys) {
  if (!state.query) return rows;
  return rows.filter((row) => keys.some((key) => String(row[key] || "").toLowerCase().includes(state.query)));
}

function setStatus(type, message, sheetStatus) {
  els.statusStrip.className = `status-strip ${type === "ready" ? "ready" : type === "error" ? "error" : ""}`;
  els.lastUpdated.textContent = message;
  els.sheetStatus.textContent = sheetStatus;
}

function renderEmpty(target, message) {
  target.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function renderTableEmpty(target, colSpan, message) {
  target.innerHTML = `<tr><td class="empty-state" colspan="${colSpan}">${escapeHtml(message)}</td></tr>`;
}

function openInventoryModal(statusLabel) {
  state.activeInventoryStatus = statusLabel;
  syncSortButtons("[data-modal-sort]", state.modalSort);
  const statusKey = getInventoryStatusKey(statusLabel);
  const summaryCount = state.inventory.find((item) => item.label === statusLabel)?.value || 0;
  const products = state.inventoryProducts
    .filter((product) => statusKey === "all" || getInventoryStatusKey(product.status) === statusKey)
    .sort((a, b) => compareInventoryProducts(a, b, state.modalSort));

  els.inventoryModalTitle.textContent = `${statusLabel} 제품 리스트`;
  els.inventoryModalSubtitle.textContent =
    statusKey === "all"
      ? `제품회전율 시트의 기간재고 원가 기준 전체 ${formatNumber(products.length)}개를 ${getSortLabel(state.modalSort)}으로 정렬했습니다.`
      : `제품회전율 시트의 기간재고 원가 기준 ${formatNumber(summaryCount)}개 상품을 ${getSortLabel(state.modalSort)}으로 정렬했습니다.`;

  if (!products.length) {
    renderTableEmpty(els.inventoryModalBody, 7, "제품회전율 시트 기준 해당 상태 제품이 없습니다.");
  } else {
    els.inventoryModalBody.innerHTML = products
      .map((product) => `<tr>
        <td>${escapeHtml(product.status)}</td>
        <td>${escapeHtml(product.code)}</td>
        <td class="product-name">${escapeHtml(product.name)}</td>
        <td>${formatNumber(product.turnover)}</td>
        <td>${formatNumber(product.stock)}</td>
        <td>${formatWon(product.salePrice)}</td>
        <td>${formatWon(product.amount)}</td>
      </tr>`)
      .join("");
  }

  els.inventoryModal.classList.add("open");
  els.inventoryModal.setAttribute("aria-hidden", "false");
}

function closeInventoryModal() {
  els.inventoryModal.classList.remove("open");
  els.inventoryModal.setAttribute("aria-hidden", "true");
  state.activeInventoryStatus = "";
}

function getInventoryStatusKey(label) {
  if (label.includes("관심")) return "watch";
  if (label.includes("처분")) return "clearance";
  if (label.includes("위험")) return "danger";
  if (label.includes("안전")) return "safe";
  return "all";
}

function isInventoryStatus(status) {
  return ["안전", "관심", "처분", "위험"].some((key) => status.includes(key));
}

function getTurnoverStatus(turnover) {
  if (turnover < 0.8) return "처분";
  if (turnover < 0.9) return "위험";
  if (turnover < ANNUAL_SAFE_TURNOVER) return "관심";
  return "안전";
}

function getRateClass(rate) {
  if (rate >= 1) return "complete";
  if (rate >= 0.7) return "good";
  if (rate >= 0.4) return "watch";
  return "low";
}

function compareInventoryProducts(a, b, sortKey) {
  if (sortKey === "turnover-asc") return a.turnover - b.turnover;
  if (sortKey === "turnover-desc") return b.turnover - a.turnover;
  return b.amount - a.amount;
}

function getSortLabel(sortKey) {
  if (sortKey === "turnover-asc") return "회전율 낮은순";
  if (sortKey === "turnover-desc") return "회전율 높은순";
  return "재고금액(원가)순";
}

function syncSortButtons(selector, activeValue) {
  document.querySelectorAll(selector).forEach((button) => {
    const value = button.dataset.productSort || button.dataset.modalSort;
    button.classList.toggle("active", value === activeValue);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function clampPercent(rate) {
  return Math.min(100, Math.max(0, Number(rate || 0) * 100));
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const normalized = String(value || "").replace(/[₩,%\s,]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function formatWon(value) {
  return `${formatNumber(Math.round(value || 0))}원`;
}

function formatPercent(value) {
  return `${((value || 0) * 100).toFixed(1)}%`;
}
