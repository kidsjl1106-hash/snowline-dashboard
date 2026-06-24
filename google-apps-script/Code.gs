const CONFIG = {
  spreadsheetId: "1whGIBwNUDKzZp6hczvqNqExN_icFmwHPCt7385W15ws",
  adminUserId: "limseongjin",
  adminDisplayName: "Limseongjin",
  adminNotificationEmail: "kidsjl1106@gmail.com",
  dashboardUrl: "https://kidsjl1106-hash.github.io/snowline-dashboard/",
  sessionHours: 8,
  allowedSheets: [
    "CS DB",
    "제품회전율",
    "패밀리세일DB원본",
    "영업1팀목표DB",
    "영업2팀목표DB",
    "영업3팀목표DB",
    "영업4팀목표DB",
    "해외영업팀목표DB",
    "직영점매출목표DB",
    "직영점DB",
    "직영점 DB",
  ],
};

const USERS_SHEET = "dashboard_users";
const AUDIT_SHEET = "dashboard_auth_audit";
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;
const USER_COLUMNS = [
  "createdAt",
  "userId",
  "displayName",
  "passwordSalt",
  "passwordHash",
  "role",
  "status",
  "approvedAt",
  "approvedBy",
  "lastLoginAt",
];
const SALES_SHEETS = [
  { match: "영업1팀", name: "영업1팀", sheets: ["영업1팀목표DB"] },
  { match: "영업2팀", name: "영업2팀", sheets: ["영업2팀목표DB"] },
  { match: "영업3팀", name: "영업3팀", sheets: ["영업3팀목표DB"] },
  { match: "영업4팀", name: "영업4팀", sheets: ["영업4팀목표DB"] },
  { match: "해외영업팀", name: "해외영업팀", sheets: ["해외영업팀목표DB"] },
  { match: "직영점", name: "직영점", sheets: ["직영점매출목표DB", "직영점DB", "직영점 DB"], fallbackKeyword: "직영" },
];
const INVENTORY_COLUMNS = {
  salesQuantity: 31,
  periodStock: 43,
  periodCostAmount: 46,
};
const SALES_MONTH_COLUMNS = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14];

function initializeAuth() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("SESSION_SECRET")) props.setProperty("SESSION_SECRET", randomSecret_());
  if (!props.getProperty("PASSWORD_PEPPER")) props.setProperty("PASSWORD_PEPPER", randomSecret_());

  const adminPassword = props.getProperty("ADMIN_INITIAL_PASSWORD");
  if (!adminPassword) {
    throw new Error("Script Properties에 ADMIN_INITIAL_PASSWORD를 먼저 설정하세요.");
  }

  ensureSheets_();
  ensureAdmin_(adminPassword);
}

function doPost(e) {
  try {
    ensureSheets_();
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
    return json_(handleAction_(payload));
  } catch (error) {
    return json_({ ok: false, error: error.message || "요청 처리 중 오류가 발생했습니다." });
  }
}

function doGet(e) {
  const callback = String(e && e.parameter && e.parameter.callback || "");
  try {
    ensureSheets_();
    const payload = parseJsonpPayload_(e);
    return jsonp_(callback, handleAction_(payload));
  } catch (error) {
    return jsonp_(callback, { ok: false, error: error.message || "요청 처리 중 오류가 발생했습니다." });
  }
}

function handleAction_(payload) {
  const action = payload.action;

  if (action === "signup") return signup_(payload);
  if (action === "login") return login_(payload);
  if (action === "me") return me_(payload);
  if (action === "dashboard") return dashboard_(payload);
  if (action === "sheet") return sheet_(payload);
  if (action === "salesSummary") return salesSummary_(payload);
  if (action === "inventorySummary") return inventorySummary_(payload);
  if (action === "csRecords") return csRecords_(payload);
  if (action === "addCs") return addCs_(payload);
  if (action === "updateCs") return updateCs_(payload);
  if (action === "deleteCs") return deleteCs_(payload);
  if (action === "listPending") return listPending_(payload);
  if (action === "listUsers") return listUsers_(payload);
  if (action === "setUserStatus") return setUserStatus_(payload);
  if (action === "approveUser") return reviewUser_(payload, "approved");
  if (action === "rejectUser") return reviewUser_(payload, "rejected");

  throw new Error("지원하지 않는 요청입니다.");
}

function parseJsonpPayload_(e) {
  const encoded = String(e && e.parameter && e.parameter.payload || "");
  if (!encoded) return {};
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - normalized.length % 4) % 4);
  const bytes = Utilities.base64Decode(normalized + padding);
  return JSON.parse(Utilities.newBlob(bytes).getDataAsString("UTF-8"));
}

function signup_(payload) {
  const userId = normalizeUserId_(payload.userId);
  const displayName = cleanText_(payload.displayName);
  const password = String(payload.password || "");

  validateUserId_(userId);
  validateDisplayName_(displayName);
  validatePassword_(password);

  const sheet = usersSheet_();
  if (findUserRow_(userId).rowNumber) throw new Error("이미 등록된 계정 이름입니다.");

  const salt = randomSecret_();
  sheet.appendRow([
    new Date().toISOString(),
    userId,
    displayName,
    salt,
    hashPassword_(password, salt),
    "user",
    "pending",
    "",
    "",
    "",
  ]);
  audit_("signup", userId, "pending");
  notifySignup_(userId, displayName);
  return { ok: true };
}

function login_(payload) {
  const userId = normalizeUserId_(payload.userId);
  const password = String(payload.password || "");
  assertLoginAllowed_(userId);

  const found = findUserRow_(userId);
  if (!found.user) {
    recordLoginFailure_(userId, "unknown_user");
    throw new Error("계정 또는 비밀번호가 올바르지 않습니다.");
  }

  const user = found.user;
  if (user.status !== "approved") {
    recordLoginFailure_(userId, "not_approved");
    throw new Error("관리자 승인 후 로그인할 수 있습니다.");
  }
  if (hashPassword_(password, user.passwordSalt) !== user.passwordHash) {
    recordLoginFailure_(userId, "bad_password");
    throw new Error("계정 또는 비밀번호가 올바르지 않습니다.");
  }

  clearLoginFailures_(userId);
  usersSheet_().getRange(found.rowNumber, USER_COLUMNS.indexOf("lastLoginAt") + 1).setValue(new Date().toISOString());
  audit_("login", userId, "success");
  return { ok: true, token: createToken_(user), user: publicUser_(user) };
}

function me_(payload) {
  const user = requireUser_(payload.token);
  return { ok: true, user: publicUser_(user) };
}

function sheet_(payload) {
  requireUser_(payload.token);
  const sheetName = String(payload.sheetName || "");
  if (!CONFIG.allowedSheets.includes(sheetName)) throw new Error("허용되지 않은 시트입니다.");

  const values = readDashboardSheet_(sheetName);
  return { ok: true, csv: toCsv_(values) };
}

function dashboard_(payload) {
  requireUser_(payload.token);
  const requestedNames = Array.isArray(payload.sheetNames) ? payload.sheetNames : CONFIG.allowedSheets;
  const uniqueNames = [...new Set(requestedNames.map((name) => String(name || "")).filter(Boolean))];
  const sheets = {};

  uniqueNames.forEach((sheetName) => {
    if (!CONFIG.allowedSheets.includes(sheetName)) {
      sheets[sheetName] = { ok: false, error: "허용되지 않은 시트입니다." };
      return;
    }

    try {
      sheets[sheetName] = { ok: true, csv: toCsv_(readDashboardSheet_(sheetName)) };
    } catch (error) {
      sheets[sheetName] = { ok: false, error: error.message || "구글시트 데이터를 읽지 못했습니다." };
    }
  });

  return { ok: true, sheets };
}

function readDashboardSheet_(sheetName) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(sheetName);
    if (!sheet) throw new Error("시트를 찾을 수 없습니다.");
    return sheet.getDataRange().getDisplayValues();
  } catch (error) {
    throw new Error(buildSpreadsheetAccessMessage_(error));
  }
}

function buildSpreadsheetAccessMessage_(error) {
  const message = error && error.message ? error.message : String(error || "");
  if (/permission|access|권한|액세스|You do not have permission/i.test(message)) {
    return "구글시트 조회 권한은 사용자별 공유가 아니라 Apps Script 소유자 권한으로 처리되어야 합니다. Apps Script 배포 설정에서 '실행 사용자: 나', '액세스 권한: 모든 사용자'로 새 버전을 배포해주세요.";
  }
  return message || "구글시트 데이터를 읽지 못했습니다.";
}

function salesSummary_(payload) {
  requireUser_(payload.token);
  const cached = getCacheJson_("salesSummary:v2");
  if (cached) return cached;

  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const teams = [];
  const errors = [];

  SALES_SHEETS.forEach((config) => {
    const found = findSalesSheet_(spreadsheet, config.sheets, config.fallbackKeyword);
    if (!found.sheet) {
      errors.push(`${config.name}: 시트를 찾을 수 없습니다.`);
      return;
    }

    try {
      const values = found.sheet.getRange(3, 1, 2, 17).getDisplayValues();
      teams.push({
        match: config.match,
        name: config.name,
        sheetName: found.sheetName,
        updatedAt: new Date().toISOString(),
        ...buildSalesSummary_(values),
      });
    } catch (error) {
      errors.push(`${config.name}: ${error.message || "매출 요약을 읽지 못했습니다."}`);
    }
  });

  const result = { ok: true, teams, errors };
  setCacheJson_("salesSummary:v2", result, 60);
  return result;
}

function findSalesSheet_(spreadsheet, names, fallbackKeyword) {
  for (const sheetName of names) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) return { sheet, sheetName };
  }
  if (fallbackKeyword) {
    const keyword = normalizeSheetName_(fallbackKeyword);
    const matched = spreadsheet.getSheets().find((sheet) => normalizeSheetName_(sheet.getName()).includes(keyword));
    if (matched) return { sheet: matched, sheetName: matched.getName() };
  }
  return { sheet: null, sheetName: "" };
}

function normalizeSheetName_(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function buildSalesSummary_(rows) {
  const targetRow = rows[0] || [];
  const actualRow = rows[1] || [];
  const months = SALES_MONTH_COLUMNS.map((column, index) => {
    const target = parseNumber_(targetRow[column]);
    const actual = parseNumber_(actualRow[column]);
    return {
      month: index + 1,
      target,
      actual,
      rate: target ? actual / target : 0,
    };
  });
  const annualTarget = parseNumber_(targetRow[16]);
  const annualActual = parseNumber_(actualRow[16]);
  return {
    months,
    annualTarget,
    annualActual,
    annualRate: annualTarget ? annualActual / annualTarget : 0,
  };
}

function inventorySummary_(payload) {
  requireUser_(payload.token);
  const cached = getCacheJson_("inventorySummary:v2");
  if (cached) return cached;

  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName("제품회전율");
  if (!sheet) throw new Error("제품회전율 시트를 찾을 수 없습니다.");

  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return { ok: true, products: [] };

  const rowCount = lastRow - 2;
  const productInfo = sheet.getRange(3, 6, rowCount, 4).getDisplayValues();
  const salesQuantities = sheet.getRange(3, INVENTORY_COLUMNS.salesQuantity + 1, rowCount, 1).getDisplayValues();
  const stocks = sheet.getRange(3, INVENTORY_COLUMNS.periodStock + 1, rowCount, 1).getDisplayValues();
  const amounts = sheet.getRange(3, INVENTORY_COLUMNS.periodCostAmount + 1, rowCount, 1).getDisplayValues();
  const products = productInfo
    .map((row, index) => rowToInventoryProduct_(row, salesQuantities[index][0], stocks[index][0], amounts[index][0]))
    .filter((product) =>
      isSnowlineProductCode_(product.code) &&
      product.name &&
      !isExcludedInventoryProductName_(product.name) &&
      product.stock > 0 &&
      isInventoryStatus_(product.status)
    );

  const result = { ok: true, products, updatedAt: new Date().toISOString() };
  setCacheJson_("inventorySummary:v2", result, 60);
  return result;
}

function rowToInventoryProduct_(productRow, salesQuantityValue, stockValue, amountValue) {
  const salesQuantity = parseNumber_(salesQuantityValue);
  const stock = parseNumber_(stockValue);
  const amount = parseNumber_(amountValue);
  const turnover = stock ? salesQuantity / stock : 0;
  return {
    code: cleanText_(productRow[0]),
    name: cleanText_(productRow[1]),
    salePrice: parseNumber_(productRow[3]),
    stock,
    amount,
    status: getTurnoverStatus_(turnover),
    turnover,
  };
}

function getTurnoverStatus_(turnover) {
  if (turnover < 0.8) return "처분";
  if (turnover < 0.9) return "위험";
  if (turnover < 1) return "관심";
  return "안전";
}

function isInventoryStatus_(status) {
  return ["안전", "관심", "위험", "처분"].includes(status);
}

function isSnowlineProductCode_(code) {
  return String(code || "").trim().toUpperCase().startsWith("SN");
}

function isExcludedInventoryProductName_(name) {
  return String(name || "").includes("이지캠핑");
}

function csRecords_(payload) {
  requireUser_(payload.token);
  const cached = getCacheJson_("csRecords:v1");
  if (cached) return cached;

  const sheet = csSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return { ok: true, rows: [] };

  const values = sheet.getRange(1, 1, lastRow, Math.max(sheet.getLastColumn(), 16)).getDisplayValues();
  const rows = values
    .map((row, index) => ({
      rowNumber: index + 1,
      date: row[0],
      channel: row[1],
      customer: row[2],
      category: row[3],
      code: row[4],
      product: row[5],
      content: row[8],
      totalCost: parseNumber_(row[14]),
      manager: row[15],
    }))
    .filter((row) => row.rowNumber >= 4 && (row.date || row.product || row.content));

  const result = { ok: true, rows, updatedAt: new Date().toISOString() };
  setCacheJson_("csRecords:v1", result, 30);
  return result;
}

function addCs_(payload) {
  const user = requireUser_(payload.token);
  const entry = payload.entry || {};
  const sheet = csSheet_();
  const row = buildCsRow_(entry, user);

  sheet.appendRow(row);
  removeCache_(["csRecords:v1"]);
  audit_("cs_add", user.userId, `${row[1]} / ${row[5] || row[2] || "no_subject"}`);
  return { ok: true, rowNumber: sheet.getLastRow() };
}

function updateCs_(payload) {
  const user = requireUser_(payload.token);
  const entry = payload.entry || {};
  const rowNumber = Number(entry.rowNumber || 0);

  if (!rowNumber || rowNumber < 2) throw new Error("수정할 CS 상담을 찾을 수 없습니다.");

  const sheet = csSheet_();
  const lastRow = sheet.getLastRow();
  if (rowNumber > lastRow) throw new Error("수정할 CS 상담을 찾을 수 없습니다.");

  const currentRow = sheet.getRange(rowNumber, 1, 1, Math.max(sheet.getLastColumn(), 16)).getDisplayValues()[0];
  const row = buildCsRow_(entry, user, currentRow[0], currentRow);
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  removeCache_(["csRecords:v1"]);
  audit_("cs_update", user.userId, `${rowNumber} / ${row[1]} / ${row[5] || row[2] || "no_subject"}`);
  return { ok: true, rowNumber };
}

function deleteCs_(payload) {
  const user = requireUser_(payload.token);
  const rowNumber = Number(payload.rowNumber || 0);

  if (!rowNumber || rowNumber < 4) throw new Error("삭제할 CS 상담을 찾을 수 없습니다.");

  const sheet = csSheet_();
  const lastRow = sheet.getLastRow();
  if (rowNumber > lastRow) throw new Error("삭제할 CS 상담을 찾을 수 없습니다.");

  const currentRow = sheet.getRange(rowNumber, 1, 1, Math.max(sheet.getLastColumn(), 16)).getDisplayValues()[0];
  assertCanDeleteCs_(user, currentRow);
  sheet.deleteRow(rowNumber);
  removeCache_(["csRecords:v1"]);
  audit_("cs_delete", user.userId, `${rowNumber} / ${cleanText_(currentRow[1])} / ${cleanText_(currentRow[5]) || cleanText_(currentRow[2]) || "no_subject"}`);
  return { ok: true, rowNumber };
}

function assertCanDeleteCs_(user, row) {
  if (user.role === "admin" || user.userId === CONFIG.adminUserId) return;
  const manager = cleanText_(row[15]);
  const userNames = [user.userId, user.displayName].map((value) => cleanText_(value)).filter(Boolean);
  if (manager && userNames.includes(manager)) return;
  throw new Error("본인이 등록한 상담 또는 관리자만 삭제할 수 있습니다.");
}

function csSheet_() {
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName("CS DB");
  if (!sheet) throw new Error("CS DB 시트를 찾을 수 없습니다.");
  return sheet;
}

function buildCsRow_(entry, user, fallbackDate, currentRow) {
  const channel = cleanText_(entry.channel);
  const content = cleanText_(entry.content);

  if (!channel) throw new Error("채널을 입력해주세요.");
  if (!content) throw new Error("상담내용을 입력해주세요.");

  const manager = user.displayName || user.userId;
  const row = Array.from({ length: 16 }, (_, index) => currentRow?.[index] || "");
  row[0] = cleanText_(entry.date) || fallbackDate || Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy. M. d. a h:mm:ss");
  row[1] = channel;
  row[2] = cleanText_(entry.customer);
  row[3] = cleanText_(entry.category);
  row[4] = cleanText_(entry.code);
  row[5] = cleanText_(entry.product);
  row[8] = content;
  row[14] = parseNumber_(entry.totalCost);
  row[15] = manager;
  return row;
}

function listPending_(payload) {
  requireAdmin_(payload.token);
  const users = allUsers_()
    .filter((user) => user.status === "pending")
    .map((user) => ({
      userId: user.userId,
      displayName: user.displayName,
      createdAt: user.createdAt,
    }));
  return { ok: true, users };
}

function listUsers_(payload) {
  requireAdmin_(payload.token);
  const users = allUsers_().map((user) => ({
    userId: user.userId,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    approvedAt: user.approvedAt,
    approvedBy: user.approvedBy,
    lastLoginAt: user.lastLoginAt,
  }));
  return { ok: true, users };
}

function setUserStatus_(payload) {
  const status = String(payload.status || "");
  if (!["approved", "pending", "rejected"].includes(status)) throw new Error("허용되지 않은 회원 상태입니다.");
  return reviewUser_(payload, status);
}

function reviewUser_(payload, status) {
  const admin = requireAdmin_(payload.token);
  const userId = normalizeUserId_(payload.userId);
  if (userId === CONFIG.adminUserId) throw new Error("관리자 계정 상태는 변경할 수 없습니다.");

  const found = findUserRow_(userId);
  if (!found.user) throw new Error("대상 계정을 찾을 수 없습니다.");

  const sheet = usersSheet_();
  sheet.getRange(found.rowNumber, USER_COLUMNS.indexOf("status") + 1).setValue(status);
  sheet.getRange(found.rowNumber, USER_COLUMNS.indexOf("approvedAt") + 1).setValue(new Date().toISOString());
  sheet.getRange(found.rowNumber, USER_COLUMNS.indexOf("approvedBy") + 1).setValue(admin.userId);
  audit_(status === "approved" ? "approve" : "reject", userId, admin.userId);
  return { ok: true };
}

function requireAdmin_(token) {
  const user = requireUser_(token);
  if (user.role !== "admin" || user.userId !== CONFIG.adminUserId) {
    throw new Error("관리자 권한이 필요합니다.");
  }
  return user;
}

function requireUser_(token) {
  const payload = verifyToken_(token);
  const found = findUserRow_(payload.userId);
  if (!found.user || found.user.status !== "approved") throw new Error("승인된 계정이 아닙니다.");
  return found.user;
}

function ensureAdmin_(adminPassword) {
  const found = findUserRow_(CONFIG.adminUserId);
  if (found.user) return;

  const salt = randomSecret_();
  usersSheet_().appendRow([
    new Date().toISOString(),
    CONFIG.adminUserId,
    CONFIG.adminDisplayName,
    salt,
    hashPassword_(adminPassword, salt),
    "admin",
    "approved",
    new Date().toISOString(),
    "system",
    "",
  ]);
  audit_("admin_created", CONFIG.adminUserId, "system");
}

function ensureSheets_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  ensureSheet_(spreadsheet, USERS_SHEET, USER_COLUMNS);
  ensureSheet_(spreadsheet, AUDIT_SHEET, ["createdAt", "action", "userId", "detail"]);
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
}

function usersSheet_() {
  return SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(USERS_SHEET);
}

function allUsers_() {
  const rows = usersSheet_().getDataRange().getValues();
  return rows.slice(1).map(rowToUser_);
}

function findUserRow_(userId) {
  const rows = usersSheet_().getDataRange().getValues();
  for (let index = 1; index < rows.length; index += 1) {
    const user = rowToUser_(rows[index]);
    if (user.userId === userId) return { rowNumber: index + 1, user };
  }
  return { rowNumber: 0, user: null };
}

function rowToUser_(row) {
  return USER_COLUMNS.reduce((user, column, index) => {
    user[column] = String(row[index] || "");
    return user;
  }, {});
}

function publicUser_(user) {
  return {
    userId: user.userId,
    displayName: user.displayName,
    role: user.role,
  };
}

function createToken_(user) {
  const payload = {
    userId: user.userId,
    exp: Date.now() + CONFIG.sessionHours * 60 * 60 * 1000,
  };
  const encoded = base64Url_(JSON.stringify(payload));
  return `${encoded}.${sign_(encoded)}`;
}

function verifyToken_(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) throw new Error("세션이 올바르지 않습니다.");

  const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString("UTF-8"));
  if (!payload.exp || Date.now() > payload.exp) throw new Error("세션이 만료되었습니다.");
  return payload;
}

function sign_(value) {
  const secret = PropertiesService.getScriptProperties().getProperty("SESSION_SECRET");
  const bytes = Utilities.computeHmacSha256Signature(value, secret);
  return bytesToHex_(bytes);
}

function hashPassword_(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty("PASSWORD_PEPPER");
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${salt}:${pepper}:${password}`));
}

function normalizeUserId_(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function cleanText_(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validateUserId_(value) {
  if (!/^[가-힣]{2,40}$/.test(value)) {
    throw new Error("계정 이름은 공백 없이 한글 2~40자로 입력해주세요.");
  }
}

function validateDisplayName_(value) {
  if (value.length < 2 || value.length > 40) throw new Error("본인 이름은 2~40자로 입력해주세요.");
}

function validatePassword_(value) {
  if (value.length < 4) throw new Error("비밀번호는 숫자만 사용해도 가능하며 4글자 이상으로 설정해주세요.");
}

function parseNumber_(value) {
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertLoginAllowed_(userId) {
  const cache = CacheService.getScriptCache();
  const key = loginAttemptKey_(userId);
  const count = Number(cache.get(key) || "0");
  if (count >= LOGIN_ATTEMPT_LIMIT) {
    audit_("login_blocked", userId, "too_many_attempts");
    throw new Error("로그인 실패가 반복되어 잠시 차단되었습니다. 15분 뒤 다시 시도해주세요.");
  }
}

function recordLoginFailure_(userId, detail) {
  const cache = CacheService.getScriptCache();
  const key = loginAttemptKey_(userId);
  const count = Number(cache.get(key) || "0") + 1;
  cache.put(key, String(count), LOGIN_LOCK_SECONDS);
  audit_("login_failed", userId, detail);
}

function clearLoginFailures_(userId) {
  CacheService.getScriptCache().remove(loginAttemptKey_(userId));
}

function loginAttemptKey_(userId) {
  return `login_failed_${userId || "blank"}`;
}

function randomSecret_() {
  return Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
}

function base64Url_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(value, "application/json").getBytes()).replace(/=+$/, "");
}

function bytesToHex_(bytes) {
  return bytes.map((byte) => {
    const value = byte < 0 ? byte + 256 : byte;
    return (`0${value.toString(16)}`).slice(-2);
  }).join("");
}

function toCsv_(rows) {
  return rows.map((row) => row.map(csvCell_).join(",")).join("\r\n");
}

function csvCell_(value) {
  const text = String(value == null ? "" : value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getCacheJson_(key) {
  try {
    const text = CacheService.getScriptCache().get(key);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

function setCacheJson_(key, value, seconds) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(value), seconds);
  } catch (error) {
    // Cache entries are an optimization only; ignore size or service limits.
  }
}

function removeCache_(keys) {
  try {
    CacheService.getScriptCache().removeAll(keys);
  } catch (error) {
    // Cache invalidation failure should not block data writes.
  }
}

function audit_(action, userId, detail) {
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(AUDIT_SHEET);
  if (sheet) sheet.appendRow([new Date().toISOString(), action, userId, detail || ""]);
}

function notifySignup_(userId, displayName) {
  const email = notificationEmail_();
  if (!email) return;

  const requestedAt = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  const subject = `[SNOWLINE] 신규 회원가입 승인 요청 - ${displayName}`;
  const body = [
    "SNOWLINE 대시보드에 신규 회원가입 요청이 접수되었습니다.",
    "",
    `계정 이름: ${userId}`,
    `본인 이름: ${displayName}`,
    `요청 일시: ${requestedAt}`,
    "",
    "관리자 계정으로 로그인한 뒤 Members 메뉴에서 승인 또는 반려를 처리해주세요.",
    CONFIG.dashboardUrl,
  ].join("\n");

  try {
    MailApp.sendEmail({
      to: email,
      subject,
      body,
      name: "SNOWLINE Dashboard",
    });
    audit_("signup_notify", userId, email);
  } catch (error) {
    audit_("signup_notify_failed", userId, error.message || "mail_failed");
  }
}

function notificationEmail_() {
  return String(
    PropertiesService.getScriptProperties().getProperty("ADMIN_NOTIFICATION_EMAIL") ||
    CONFIG.adminNotificationEmail ||
    ""
  ).trim();
}

function sendSignupNotificationTest() {
  ensureSheets_();
  notifySignup_("테스트계정", "테스트 사용자");
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(callback, payload) {
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: "잘못된 callback 입니다." }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(payload)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
