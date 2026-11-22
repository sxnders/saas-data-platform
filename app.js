const API = "/api";
const DEMO = true, DEMO_USER = "demo", DEMO_PASS = "demo";
const TOKEN_KEY = "token";
const getToken = () => localStorage.getItem(TOKEN_KEY);
const MOCK = {
  sources: [
    { id: "acc", name: "Бухгалтерия", tables: [
      { name: "counterparties", columns: [{ name: "id", type: "integer" }, { name: "name", type: "text" }, { name: "inn", type: "text" }, { name: "city", type: "text" }] },
      { name: "invoices", columns: [{ name: "id", type: "integer" }, { name: "counterparty_id", type: "integer" }, { name: "amount", type: "numeric" }, { name: "issued_at", type: "date" }, { name: "paid", type: "boolean" }] },
    ] },
    { id: "crm", name: "CRM", tables: [
      { name: "deals", columns: [{ name: "id", type: "integer" }, { name: "title", type: "text" }, { name: "stage", type: "text" }, { name: "value", type: "numeric" }] },
    ] },
  ],
  rows: {
    "acc/counterparties": Array.from({ length: 57 }, (_, i) => ({ id: i + 1, name: `ООО «Контрагент ${i + 1}»`, inn: String(6600000000 + i * 137), city: ["Екатеринбург", "Пермь", "Тюмень", "Челябинск"][i % 4] })),
    "acc/invoices": Array.from({ length: 120 }, (_, i) => ({ id: i + 1, counterparty_id: (i * 7) % 57 + 1, amount: 1000 + ((i * 7919) % 90000), issued_at: `2026-${String(i % 12 + 1).padStart(2, "0")}-${String(i % 27 + 1).padStart(2, "0")}`, paid: i % 3 !== 0 })),
    "crm/deals": Array.from({ length: 34 }, (_, i) => ({ id: i + 1, title: `Сделка ${i + 1}`, stage: ["Новая", "Переговоры", "Договор", "Закрыта"][i % 4], value: 5000 + i * 2500 })),
  },
};

async function api(path) {
  const r = await fetch(API + path, { headers: { Authorization: "Bearer " + getToken() } });
  if (r.status === 401) { logout(); const e = new Error("401"); e.auth = true; throw e; }
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
const loadSources = () => api("/sources").catch((e) => (e.auth ? [] : MOCK.sources));
const loadRows = (sid, t) => api(`/sources/${sid}/tables/${t}/rows`).catch((e) => (e.auth ? [] : MOCK.rows[`${sid}/${t}`] || []));




const $ = (id) => document.getElementById(id);
const state = { sources: [], open: new Set(), sel: null, tab: "data", rows: [], page: 0, sort: null, query: "" };
const PAGE = 25;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const isNum = (t) => /int|numeric|float|decimal/.test(t);

function currentTable() {
  if (!state.sel) return null;
  const s = state.sources.find((x) => x.id === state.sel.sid);
  const t = s && s.tables.find((x) => x.name === state.sel.table);
  return t ? { source: s, table: t } : null;
}




function renderTree() {
  const q = state.query.toLowerCase();
  $("tree").innerHTML = state.sources.map((s) => {
    const tables = s.tables.filter((t) => !q || s.name.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
    if (!tables.length) return "";
    const open = q || state.open.has(s.id);
    return `<div class="src"><button data-src="${esc(s.id)}" aria-expanded="${!!open}">${esc(s.name)}<small>${s.tables.length}</small></button>` +
      (open ? tables.map((t) => `<button class="tbl ${state.sel && state.sel.sid === s.id && state.sel.table === t.name ? "active" : ""}" data-sid="${esc(s.id)}" data-table="${esc(t.name)}">${esc(t.name)}</button>`).join("") : "") + "</div>";
  }).join("") || `<div class="empty">Ничего не найдено.</div>`;
}

function sortedRows() {
  if (!state.sort) return state.rows;
  const { col, dir } = state.sort;
  return [...state.rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * dir);
}

function renderMain() {
  const cur = currentTable();
  $("tabs").hidden = $("toolbar").hidden = !cur;
  if (!cur) { $("crumbs").textContent = ""; $("title").textContent = "Источники данных"; return; }
  $("crumbs").textContent = cur.source.name;
  $("title").textContent = cur.table.name;
  document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === state.tab));
  const cols = cur.table.columns;
  if (state.tab === "structure") {
    $("info").textContent = `Колонок: ${cols.length}`;
    $("content").innerHTML = `<table><thead><tr><th>Колонка</th><th>Тип</th></tr></thead><tbody>${cols.map((c) => `<tr><td>${esc(c.name)}</td><td class="type">${esc(c.type)}</td></tr>`).join("")}</tbody></table>`;
    return;
  }
  const rows = sortedRows(), pages = Math.max(1, Math.ceil(rows.length / PAGE)), slice = rows.slice(state.page * PAGE, (state.page + 1) * PAGE);
  $("info").textContent = `Строк: ${rows.length}`;
  $("content").innerHTML =
    `<table><thead><tr>${cols.map((c) => `<th class="sortable ${isNum(c.type) ? "num" : ""}" data-col="${esc(c.name)}">${esc(c.name)}${state.sort && state.sort.col === c.name ? (state.sort.dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead><tbody>` +
    slice.map((r) => `<tr>${cols.map((c) => `<td class="${isNum(c.type) ? "num" : ""}">${esc(r[c.name] ?? "")}</td>`).join("")}</tr>`).join("") + `</tbody></table>` +
    `<div class="pager"><button class="btn" data-page="-1" ${state.page === 0 ? "disabled" : ""}>Назад</button><span>Страница ${state.page + 1} из ${pages}</span><button class="btn" data-page="1" ${state.page + 1 >= pages ? "disabled" : ""}>Вперёд</button></div>`;
}




async function route() {
  const [sid, table, tab] = decodeURIComponent(location.hash.slice(2)).split("/");
  state.tab = tab === "structure" ? "structure" : "data";
  if (sid && table && (!state.sel || state.sel.sid !== sid || state.sel.table !== table)) {
    state.sel = { sid, table }; state.open.add(sid); state.page = 0; state.sort = null; state.rows = [];
    renderTree(); renderMain();
    state.rows = await loadRows(sid, table);
  } else if (!sid) state.sel = null;
  renderTree(); renderMain();
}
const go = (sid, table, tab) => (location.hash = `#/${encodeURIComponent(sid)}/${encodeURIComponent(table)}${tab && tab !== "data" ? "/" + tab : ""}`);




function save(blob, name) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click(); URL.revokeObjectURL(a.href);
}
function exportCsv() {
  const { table } = currentTable(), cols = table.columns.map((c) => c.name);
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const text = [cols.map(cell).join(";"), ...state.rows.map((r) => cols.map((c) => cell(r[c])).join(";"))].join("\r\n");
  save(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }), `${table.name}.csv`);
}
async function exportXlsx() {
  if (!window.ExcelJS) return alert("Библиотека Excel не загрузилась. Проверьте интернет или скачайте CSV.");
  const { table } = currentTable(), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(table.name);
  ws.columns = table.columns.map((c) => ({ header: c.name, key: c.name, width: 20 }));
  ws.addRows(state.rows);
  ws.getRow(1).font = { bold: true };
  save(new Blob([await wb.xlsx.writeBuffer()]), `${table.name}.xlsx`);
}




$("tree").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.table) return go(b.dataset.sid, b.dataset.table, state.tab);
  const id = b.dataset.src; state.open.has(id) ? state.open.delete(id) : state.open.add(id); renderTree();
});
$("search").addEventListener("input", (e) => { state.query = e.target.value; renderTree(); });
$("tabs").addEventListener("click", (e) => { const t = e.target.dataset.tab; if (t && state.sel) go(state.sel.sid, state.sel.table, t); });
$("content").addEventListener("click", (e) => {
  const th = e.target.closest("th[data-col]"), pg = e.target.closest("[data-page]");
  if (th) { const col = th.dataset.col; state.sort = { col, dir: state.sort && state.sort.col === col ? -state.sort.dir : 1 }; state.page = 0; renderMain(); }
  if (pg) { state.page += Number(pg.dataset.page); renderMain(); }
});
$("dl-csv").addEventListener("click", exportCsv);
$("dl-xlsx").addEventListener("click", exportXlsx);
window.addEventListener("hashchange", () => getToken() && route());




// ---------- ИИ-помощник (пока только интерфейс) ----------
// Подсказки, которые видны в пустом чате
const SUGGESTIONS = [
  "Какие источники подключены?",
  "Опиши структуру выбранной таблицы",
  "С чего мне начать?",
];

// Состояние чата. Хранится только в памяти: после обновления страницы чат пустой.
// role: "user" (сообщение пользователя) или "bot" (ответ помощника)
const chat = { messages: [], busy: false, session: 0 };

// ЗАГЛУШКА. Когда появится бэкенд, замените тело функции на запрос, например:
//   const r = await fetch(API + "/assistant", {
//     method: "POST",
//     headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
//     body: JSON.stringify({ messages, context: state.sel }),   // state.sel = выбранная таблица
//   });
//   return (await r.json()).reply;
async function askAssistant(messages) {
  await new Promise((resolve) => setTimeout(resolve, 900));
  return "Это макет: ИИ-помощник ещё не подключён, поэтому настоящего ответа пока нет.";
}

const div = (cls) => Object.assign(document.createElement("div"), { className: cls });

// Перерисовывает список сообщений
function renderChat() {
  const log = $("chat-log");
  log.replaceChildren();

  if (!chat.messages.length) {
    const empty = div("chat-empty");
    empty.append(Object.assign(document.createElement("p"), { textContent: "Задайте вопрос о ваших источниках и данных. Например:" }));
    SUGGESTIONS.forEach((text) => {
      const b = Object.assign(document.createElement("button"), { className: "btn chip", textContent: text });
      b.dataset.prompt = text;
      empty.append(b);
    });
    log.append(empty);
  }

  chat.messages.forEach((m) => {
    const row = div("msg msg-" + m.role), bubble = div("msg-bubble");
    bubble.textContent = m.text;   // textContent: текст не может превратиться в HTML
    row.append(bubble);
    log.append(row);
  });

  if (chat.busy) {   // индикатор «помощник печатает»
    const row = div("msg msg-bot"), dots = div("msg-bubble typing");
    dots.setAttribute("aria-label", "Помощник печатает");
    dots.innerHTML = "<span></span><span></span><span></span>";
    row.append(dots);
    log.append(row);
  }

  log.scrollTop = log.scrollHeight;   // прокрутка к последнему сообщению
  $("chat-send").disabled = chat.busy;
}

// Отправляет сообщение и добавляет ответ помощника
async function sendMessage(text) {
  text = text.trim();
  if (!text || chat.busy) return;
  const session = chat.session;
  chat.messages.push({ role: "user", text });
  chat.busy = true;
  renderChat();

  let reply;
  try { reply = await askAssistant(chat.messages); }
  catch { reply = "Не удалось получить ответ. Попробуйте ещё раз."; }

  if (session !== chat.session) return;   // чат очистили или вышли из аккаунта, пока шёл ответ
  chat.messages.push({ role: "bot", text: reply });
  chat.busy = false;
  renderChat();
}

// Открывает или закрывает панель чата
function setChat(open) {
  $("chat").hidden = !open;
  $("app").classList.toggle("chat-open", open);
  $("chat-toggle").setAttribute("aria-expanded", open);
  if (open) { renderChat(); $("chat-input").focus(); }
}

// Очищает переписку (кнопка «Очистить» и выход из аккаунта)
function resetChat() {
  chat.messages = [];
  chat.busy = false;
  chat.session++;
  renderChat();
}

$("chat-toggle").addEventListener("click", () => setChat($("chat").hidden));
$("chat-close").addEventListener("click", () => setChat(false));
$("chat-clear").addEventListener("click", resetChat);

$("chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("chat-input");
  sendMessage(input.value);
  input.value = "";
  input.style.height = "auto";
});
// Enter отправляет сообщение, Shift+Enter переносит строку
$("chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("chat-form").requestSubmit(); }
});
// Поле ввода растёт вместе с текстом (до 120px)
$("chat-input").addEventListener("input", (e) => {
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
});
// Клик по подсказке в пустом чате отправляет её как вопрос
$("chat-log").addEventListener("click", (e) => {
  const b = e.target.closest("[data-prompt]");
  if (b) sendMessage(b.dataset.prompt);
});




function showAuth() {
  const authed = !!getToken();
  $("login").hidden = authed;
  $("app").hidden = !authed;
  if (!authed) $("login-user").focus();
}
async function login(username, password) {
  try {
    const r = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if ([400, 401, 422].includes(r.status)) return "Неверный логин или пароль.";
    if (!r.ok) throw new Error(r.status);
    const { token } = await r.json();
    localStorage.setItem(TOKEN_KEY, token);
    return null;
  } catch {
    if (DEMO && username === DEMO_USER && password === DEMO_PASS) {
      localStorage.setItem(TOKEN_KEY, "demo");
      return null;
    }
    return "Сервер недоступен. Попробуйте позже.";
  }
}
function logout() {
  localStorage.removeItem(TOKEN_KEY);
  Object.assign(state, { sources: [], sel: null, rows: [], open: new Set(), query: "" });
  $("search").value = "";
  resetChat(); setChat(false);
  history.replaceState(null, "", location.pathname);
  renderTree(); renderMain();
  showAuth();
}
async function start() {
  showAuth();
  state.sources = await loadSources();
  renderTree(); route();
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-btn").disabled = true;
  $("login-error").textContent = "";
  const err = await login($("login-user").value.trim(), $("login-pass").value);
  $("login-btn").disabled = false;
  if (err) { $("login-error").textContent = err; return; }
  $("login-pass").value = "";
  start();
});
$("logout").addEventListener("click", logout);
if (DEMO) { $("login-hint").hidden = false; $("login-hint").textContent = `Демо-доступ: ${DEMO_USER} / ${DEMO_PASS}`; }

getToken() ? start() : showAuth();
