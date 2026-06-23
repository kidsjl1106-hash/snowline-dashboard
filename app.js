const SHEETS = {
  cs: "CS DB",
  inventoryTurnover: "제품회전율",
};
const SHEET_FETCH_TIMEOUT_MS = 60000;
const ANNUAL_SAFE_TURNOVER = 1;
const TEAM_SHEETS = [
  { match: "영업1팀", name: "영업1팀", sheet: "영업1팀목표DB" },
  { match: "영업2팀", name: "영업2팀", sheet: "영업2팀목표DB" },
  { match: "영업3팀", name: "영업3팀", sheet: "영업3팀목표DB" },
  { match: "영업4팀", name: "영업4팀", sheet: "영업4팀목표DB" },
  { match: "해외영업팀", name: "해외영업팀", sheet: "해외영업팀목표DB" },
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

const state = {
  query: "",
  selectedMonth: new Date().getMonth() + 1,
  productSort: "amount-desc",
  modalSort: "amount-desc",
  activeInventoryStatus: "",
  teamDetails: {},
  inventory: [],
  teams: [],
  products: [],
  inventoryProducts: [],
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
  inventoryRiskSummary: document.querySelector("#inventory-risk-summary"),
  inventoryRiskBody: document.querySelector("#inventory-risk-body"),
  channelSummary: document.querySelector("#channel-summary"),
  channelSalesBody: document.querySelector("#channel-sales-body"),
  reportSummaryGrid: document.querySelector("#report-summary-grid"),
  reportIssueBody: document.querySelector("#report-issue-body"),
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

  const memberActionButton = event.target.closest("[data-member-action]");
  if (memberActionButton) {
    updateMemberStatus(memberActionButton.dataset.userId, memberActionButton.dataset.memberAction);
    return;
  }

  const csEditButton = event.target.closest("[data-cs-edit]");
  if (csEditButton) {
    startCsEdit(Number(csEditButton.dataset.csEdit));
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

async function loadDashboard() {
  setStatus("loading", "구글시트 데이터를 불러오는 중입니다.", "연결중");

  const errors = [];
  let dashboardSheets = null;
  try {
    dashboardSheets = await fetchDashboardSheets();
  } catch (error) {
    console.error("Dashboard load failed before sheet requests.", error);
    state.cs = [];
    state.inventoryProducts = [];
    state.inventory = [];
    state.products = [];
    state.teamDetails = {};
    state.teams = [];
    setStatus("error", formatLoadError(error), "오류");
    render();
    return;
  }
  const [csResult, inventoryResult, teamDetailsResult] = await Promise.all([
    getDashboardSheetResult(dashboardSheets, SHEETS.cs),
    getDashboardSheetResult(dashboardSheets, SHEETS.inventoryTurnover),
    settle(() => fetchTeamDetails(dashboardSheets)),
  ]);

  if (csResult.status === "fulfilled") {
    state.cs = parseCs(csResult.value);
  } else {
    state.cs = [];
    errors.push(`${SHEETS.cs}: ${formatLoadError(csResult.reason)}`);
  }

  if (inventoryResult.status === "fulfilled") {
    state.inventoryProducts = parseInventoryProducts(inventoryResult.value);
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
    const sheetNames = [SHEETS.cs, SHEETS.inventoryTurnover, ...TEAM_SHEETS.map((team) => team.sheet)];
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

function parseInventory(products = []) {
  const counts = products.reduce((acc, product) => {
    acc[product.status] = (acc[product.status] || 0) + 1;
    acc["총재고품목수"] = (acc["총재고품목수"] || 0) + 1;
    return acc;
  }, {});

  return [
    { label: "안전", value: counts["안전"] || 0 },
    { label: "관심", value: counts["관심"] || 0 },
    { label: "처분", value: counts["처분"] || 0 },
    { label: "위험", value: counts["위험"] || 0 },
    { label: "총재고품목수", value: counts["총재고품목수"] || 0 },
  ];
}

function parseTeamDetail(rows) {
  const annualColumn = 16;
  const months = Array.from({ length: 12 }, (_, index) => {
    const column = index + 2;
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
  const results = dashboardSheets
    ? TEAM_SHEETS.map((team) => {
        const sheet = dashboardSheets[team.sheet];
        if (sheet?.csv) {
          return { status: "fulfilled", value: { rows: parseCsv(sheet.csv), updatedAt: new Date().toISOString() } };
        }
        return { status: "rejected", reason: new Error(sheet?.error || `${team.sheet} 데이터를 불러오지 못했습니다.`) };
      })
    : await Promise.allSettled(
        TEAM_SHEETS.map(async (team) => ({
          rows: await fetchSheet(team.sheet),
          updatedAt: new Date().toISOString(),
        })),
      );
  const errors = [];
  const details = TEAM_SHEETS.reduce((details, team, index) => {
    if (results[index].status === "fulfilled") {
      details[team.match] = {
        name: team.name,
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
    .slice(1)
    .map((row) => {
      const turnover = toNumber(row[38]);
      const code = String(row[5] || "").trim();
      return {
        code,
        name: row[6],
        salePrice: toNumber(row[8]),
        stock: toNumber(row[34]),
        amount: toNumber(row[36]),
        status: getTurnoverStatus(turnover),
        turnover,
      };
    })
    .filter((row) => isSnowlineProductCode(row.code) && row.name && isInventoryStatus(row.status));
}

function isSnowlineProductCode(code) {
  return String(code || "").trim().toUpperCase().startsWith("SN");
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
  const cs = filterRows(state.cs, ["customer", "category", "code", "product", "content", "manager"]);

  renderKpis();
  renderMonthToggle();
  renderTeamBars(teams);
  renderAchievementTables(teams);
  renderInventory();
  renderProducts(els.topProductsBody, products.slice(0, 10));
  renderProducts(els.productsBody, products);
  renderSales(teams);
  renderCs(cs);
  renderInventoryRisk();
  renderChannelSales();
  renderReports(teams, cs);
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
      <td class="table-actions"><button class="secondary-button compact-button" type="button" data-cs-edit="${row.rowNumber}">수정</button></td>
    </tr>`)
    .join("");
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
      state.query = registeredCustomer.toLowerCase();
      if (els.searchInput) els.searchInput.value = registeredCustomer;
    } else {
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

function renderReports(teams, cs) {
  if (!els.reportSummaryGrid || !els.reportIssueBody) return;
  const total = teams.find((team) => team.team === "통합합계") || {};
  const riskProducts = getInventoryRiskProducts();
  const cards = [
    { label: "매출 목표", value: formatWon(total.target || 0), sub: `달성률 ${formatPercent(total.rate || 0)}` },
    { label: "현재 실적", value: formatWon(total.actual || 0), sub: `월간 ${formatPercent(total.monthlyRate || 0)}` },
    { label: "재고 위험", value: `${formatNumber(riskProducts.length)}개`, sub: `위험/처분/관심 품목` },
    { label: "CS 접수", value: `${formatNumber(cs.length)}건`, sub: "상담 DB 기준" },
  ];

  els.reportSummaryGrid.innerHTML = cards
    .map((card) => `<div class="report-card">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small>${escapeHtml(card.sub)}</small>
    </div>`)
    .join("");

  const issues = buildActionItems(teams, cs);
  if (!issues.length) {
    renderTableEmpty(els.reportIssueBody, 5, "주요 이슈가 없습니다.");
    return;
  }
  els.reportIssueBody.innerHTML = issues.slice(0, 12).map((item) => renderActionRow(item)).join("");
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
      basis: `${product.status} · 재고금액 ${formatWon(product.amount)}`,
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
      const priority = { 위험: 0, 처분: 1, 관심: 2 };
      return priority[a.status] - priority[b.status] || b.amount - a.amount;
    });
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
      ? `제품회전율 시트 기준 전체 ${formatNumber(products.length)}개를 ${getSortLabel(state.modalSort)}으로 정렬했습니다.`
      : `제품회전율 시트 기준 ${formatNumber(summaryCount)}개 상품을 ${getSortLabel(state.modalSort)}으로 정렬했습니다.`;

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
  if (turnover < ANNUAL_SAFE_TURNOVER * 0.8) return "처분";
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
  return "재고금액순";
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
