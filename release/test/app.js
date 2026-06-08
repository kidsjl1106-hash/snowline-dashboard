const SHEET_ID = "1whGIBwNUDKzZp6hczvqNqExN_icFmwHPCt7385W15ws";
const SHEETS = {
  cs: "CS DB",
  inventoryTurnover: "제품회전율",
};
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
  version: "2026.06.07",
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
  }
});

if (window.SnowlineAuth?.required) {
  window.addEventListener(
    "snowline:authenticated",
    (event) => {
      setupAdminView(event.detail);
      loadDashboard();
    },
    { once: true },
  );
} else {
  setStatus("error", "로그인 모듈을 불러오지 못했습니다. auth.js 설정을 확인해주세요.", "인증 오류");
}

function initBuildInfo() {
  if (!els.buildVersion) return;
  els.buildVersion.textContent = `${BUILD_INFO.channel} 테스트 · ${BUILD_INFO.version}`;
}

async function loadDashboard() {
  setStatus("loading", "구글시트 데이터를 불러오는 중입니다.", "연결중");

  try {
    const [csRows, inventoryRows, teamDetails] = await Promise.all([
      fetchSheet(SHEETS.cs),
      fetchSheet(SHEETS.inventoryTurnover),
      fetchTeamDetails(),
    ]);

    state.inventoryProducts = parseInventoryProducts(inventoryRows);
    state.inventory = parseInventory(state.inventoryProducts);
    state.teamDetails = teamDetails;
    state.teams = buildTeamsFromDetails(teamDetails);
    state.products = parseInventoryRanking(state.inventoryProducts);
    state.cs = parseCs(csRows);

    setStatus("ready", `${new Date().toLocaleString("ko-KR")} 기준으로 갱신되었습니다.`, "연결됨");
    render();
  } catch (error) {
    console.error(error);
    setStatus("error", "구글시트 데이터를 불러오지 못했습니다. 시트 공개 범위와 네트워크를 확인해주세요.", "오류");
  }
}

async function fetchSheet(sheetName) {
  if (!window.SnowlineAuth?.request) {
    throw new Error("로그인 서버가 연결되지 않았습니다.");
  }

  const result = await window.SnowlineAuth.request({ action: "sheet", sheetName });
  if (!result?.csv) throw new Error(`${sheetName} 데이터가 비어 있습니다.`);
  return parseCsv(result.csv);
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

async function fetchTeamDetails() {
  const results = await Promise.allSettled(
    TEAM_SHEETS.map(async (team) => ({
      rows: await fetchSheet(team.sheet),
      updatedAt: new Date().toISOString(),
    })),
  );
  return TEAM_SHEETS.reduce((details, team, index) => {
    if (results[index].status === "fulfilled") {
      details[team.match] = {
        name: team.name,
        updatedAt: results[index].value.updatedAt,
        ...parseTeamDetail(results[index].value.rows),
      };
    }
    return details;
  }, {});
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
      return {
        code: row[5],
        name: row[6],
        salePrice: toNumber(row[8]),
        stock: toNumber(row[34]),
        amount: toNumber(row[36]),
        status: getTurnoverStatus(turnover),
        turnover,
      };
    })
    .filter((row) => row.code && row.name && isInventoryStatus(row.status));
}

function parseCs(rows) {
  return rows
    .slice(1)
    .map((row) => ({
      date: row[0],
      channel: row[1],
      customer: row[2],
      category: row[3],
      code: row[4],
      product: row[5],
      content: row[8],
      totalCost: toNumber(row[13]),
      manager: row[14],
    }))
    .filter((row) => row.date || row.product || row.content);
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
  if (!rows.length) return renderTableEmpty(els.csBody, 8, "CS 상담 데이터가 없습니다.");
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
    </tr>`)
    .join("");
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
  if (turnover < 0.8) return "처분";
  if (turnover < 1) return "관심";
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
