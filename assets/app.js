const app = document.querySelector("#app");

const state = {
  data: null,
  selectedDate: "",
  category: "all",
  query: "",
  visits: null
};

const categoryTone = new Map([
  ["大模型底层进展", "model"],
  ["AI 基础设施 / 工具", "infra"],
  ["AI 基础设施/工具", "infra"],
  ["AI 创业 ToC / ToB", "venture"],
  ["AI 创业方向 ToC", "venture"],
  ["AI 创业方向 ToB", "venture"],
  ["GitHub Trending 黑马", "github"],
  ["Reddit 需求洞察", "community"],
  ["安全风向标", "risk"],
  ["资本动向", "capital"]
]);

function normalizeCategoryName(value = "") {
  return value
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function formatDate(date) {
  const parsed = new Date(`${date}T00:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(parsed);
}

function formatFullDate(date) {
  const parsed = new Date(`${date}T00:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(parsed);
}

function allItems(brief) {
  return brief.sections.flatMap((section) =>
    section.items.map((item) => ({ ...item, category: section.category }))
  );
}

function getBrief() {
  return state.data.briefs.find((brief) => brief.date === state.selectedDate) || state.data.briefs[0];
}

function getCategories(brief) {
  return brief.categories.filter((category) => category.count > 0);
}

function matchesSearch(item) {
  if (!state.query.trim()) return true;
  const query = state.query.trim().toLowerCase();
  return [item.title, item.subtitle, item.summary, item.category, item.domain]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function visibleItems(brief) {
  return allItems(brief).filter((item) => {
    const categoryMatch = state.category === "all" || item.category === state.category;
    return categoryMatch && matchesSearch(item);
  });
}

function articleLink(item) {
  if (!item.url) return "";
  const label = item.sourceLabel || item.domain || "查看来源";
  return `<a class="source-link" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function statsEndpoint() {
  return window.MORNING_BRIEF_STATS_API || "./api/visit";
}

function visitorId() {
  const key = "morningBriefVisitorId";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const value =
      crypto?.randomUUID?.() ||
      `mb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
    localStorage.setItem(key, value);
    return value;
  } catch {
    return "";
  }
}

function renderTopbar() {
  return `
    <header class="topbar">
      <a class="brand" href="./" aria-label="AI Morning Brief 首页">
        <span class="brand-mark" aria-hidden="true">M</span>
        <span>
          <strong>AI Morning Brief</strong>
          <small>每日 AI 机会和技术信号</small>
        </span>
      </a>
      <nav class="top-actions" aria-label="站点操作">
        ${state.visits?.enabled ? `<a class="text-link" href="#traffic">统计</a>` : ""}
        <button class="ghost-button" type="button" data-action="latest">最新</button>
      </nav>
    </header>
  `;
}

function renderTrafficStats() {
  if (!state.visits?.enabled) return "";
  const days = state.visits.days || [];
  const maxVisitors = Math.max(...days.map((day) => day.visitors), 1);
  const lastSeven = days.slice(-7);

  return `
    <section id="traffic" class="traffic-panel">
      <h2>访问统计</h2>
      <dl class="stats-list">
        <div><dt>今日访客</dt><dd>${escapeHtml(state.visits.today?.visitors ?? 0)}</dd></div>
        <div><dt>今日访问</dt><dd>${escapeHtml(state.visits.today?.pageviews ?? 0)}</dd></div>
      </dl>
      <div class="traffic-bars" aria-label="近 7 日访客">
        ${lastSeven
          .map((day) => {
            const height = Math.max(8, Math.round((day.visitors / maxVisitors) * 54));
            return `
              <div class="traffic-day" title="${escapeHtml(day.date)} · ${escapeHtml(day.visitors)} 人">
                <span style="height:${height}px"></span>
                <small>${escapeHtml(day.date.slice(5))}</small>
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderIssueRail(briefs) {
  return `
    <aside class="issue-rail" aria-label="简报日期">
      <div class="rail-heading">
        <span>日期</span>
        <strong>${briefs.length}</strong>
      </div>
      <div class="issue-list">
        ${briefs
          .map((brief) => {
            const selected = brief.date === state.selectedDate;
            return `
              <button class="issue-button ${selected ? "is-selected" : ""}" type="button" data-date="${escapeHtml(
                brief.date
              )}" aria-pressed="${selected}">
                <span>${escapeHtml(formatDate(brief.date))}</span>
                <strong>${escapeHtml(brief.itemCount)} 条</strong>
              </button>
            `;
          })
          .join("")}
      </div>
    </aside>
  `;
}

function renderFilters(brief) {
  const categories = getCategories(brief);
  return `
    <section class="filter-bar" aria-label="筛选新闻">
      <div class="search-wrap">
        <input
          class="search-input"
          type="search"
          name="search"
          value="${escapeHtml(state.query)}"
          placeholder="搜索项目、主题或来源"
          aria-label="搜索项目、主题或来源"
        />
      </div>
      <div class="category-list" role="list">
        <button class="category-button ${state.category === "all" ? "is-selected" : ""}" type="button" data-category="all">
          全部 <span>${brief.itemCount}</span>
        </button>
        ${categories
          .map((category) => {
            const selected = state.category === category.name;
            const tone = categoryTone.get(category.name) || categoryTone.get(normalizeCategoryName(category.name)) || "default";
            return `
              <button class="category-button tone-${tone} ${selected ? "is-selected" : ""}" type="button" data-category="${escapeHtml(
                category.name
              )}">
                ${escapeHtml(category.name)} <span>${category.count}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderLead(item) {
  if (!item) return "";
  return `
    <article class="lead-article">
      <div>
        <span class="overline">今日头条</span>
        <h2>${escapeHtml(item.title)}</h2>
        ${item.subtitle ? `<p class="subtitle">${escapeHtml(item.subtitle)}</p>` : ""}
        <p>${escapeHtml(item.summary)}</p>
      </div>
      <footer>
        <span>${escapeHtml(item.category)}</span>
        ${item.signal ? `<strong>${escapeHtml(item.signal)}</strong>` : ""}
        ${articleLink(item)}
      </footer>
    </article>
  `;
}

function renderArticle(item) {
  return `
    <article class="article-row">
      <div class="rank">${String(item.rank).padStart(2, "0")}</div>
      <div class="article-main">
        <div class="article-meta">
          <span>${escapeHtml(item.category)}</span>
          ${item.signal ? `<strong>${escapeHtml(item.signal)}</strong>` : ""}
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        ${item.subtitle ? `<p class="subtitle">${escapeHtml(item.subtitle)}</p>` : ""}
        <p>${escapeHtml(item.summary)}</p>
      </div>
      <div class="article-source">
        ${articleLink(item)}
        ${item.domain ? `<span>${escapeHtml(item.domain)}</span>` : ""}
      </div>
    </article>
  `;
}

function renderGroupedArticles(brief) {
  if (state.category !== "all" || state.query.trim()) {
    const items = visibleItems(brief);
    if (!items.length) {
      return `<div class="empty-state">没有匹配的条目。</div>`;
    }
    return `<section class="article-stack">${items.map(renderArticle).join("")}</section>`;
  }

  return brief.sections
    .filter((section) => section.items.length)
    .map(
      (section) => `
        <section class="article-section">
          <header class="section-heading">
            <h2>${escapeHtml(section.category)}</h2>
            <span>${section.items.length} 条</span>
          </header>
          <div class="article-stack">
            ${section.items.map((item) => renderArticle({ ...item, category: section.category })).join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function renderDigest(brief, selectedItems) {
  const opportunities = brief.opportunities?.length ? brief.opportunities : [];
  const domains = brief.sourceDomains.slice(0, 8);
  return `
    <aside class="digest-panel" aria-label="今日归纳">
      <section>
        <h2>今日归纳</h2>
        <p>${escapeHtml(brief.summary || "今天的简报已整理为结构化新闻列表。")}</p>
      </section>
      ${
        opportunities.length
          ? `<section>
              <h2>机会线索</h2>
              <ul class="plain-list">${opportunities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </section>`
          : ""
      }
      <section>
        <h2>阅读状态</h2>
        <dl class="stats-list">
          <div><dt>当前筛选</dt><dd>${selectedItems.length}</dd></div>
          <div><dt>全部条目</dt><dd>${brief.itemCount}</dd></div>
          <div><dt>信息源</dt><dd>${brief.sourceDomains.length || "-"}</dd></div>
        </dl>
      </section>
      ${renderTrafficStats()}
      ${
        domains.length
          ? `<section>
              <h2>来源</h2>
              <div class="domain-list">${domains.map((domain) => `<span>${escapeHtml(domain)}</span>`).join("")}</div>
            </section>`
          : ""
      }
    </aside>
  `;
}

function renderBriefHeader(brief, items) {
  return `
    <section class="brief-header">
      <div>
        <p class="date-line">${escapeHtml(formatFullDate(brief.date))}</p>
        <h1>${escapeHtml(brief.title)}</h1>
        <p>${escapeHtml(brief.summary || "从本地 Morning-Brief Markdown 自动生成的每日 AI 新闻阅读页。")}</p>
      </div>
      <dl class="brief-metrics">
        <div>
          <dt>条目</dt>
          <dd>${brief.itemCount}</dd>
        </div>
        <div>
          <dt>分类</dt>
          <dd>${brief.categories.length}</dd>
        </div>
        <div>
          <dt>匹配</dt>
          <dd>${items.length}</dd>
        </div>
      </dl>
    </section>
  `;
}

function render() {
  if (!state.data?.briefs?.length) {
    app.innerHTML = `${renderTopbar()}<main class="empty-state">还没有可展示的简报数据。</main>`;
    return;
  }

  const brief = getBrief();
  const items = visibleItems(brief);
  const lead = state.category === "all" && !state.query.trim() ? allItems(brief)[0] : items[0];

  app.innerHTML = `
    ${renderTopbar()}
    <main class="workspace">
      ${renderIssueRail(state.data.briefs)}
      <div class="content-column">
        ${renderBriefHeader(brief, items)}
        ${renderFilters(brief)}
        ${renderLead(lead)}
        ${renderGroupedArticles(brief)}
      </div>
      ${renderDigest(brief, items)}
    </main>
  `;
}

async function init() {
  try {
    const response = await fetch("./public/data/briefs.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.selectedDate = state.data.briefs[0]?.date || "";
    render();
    recordVisit();
  } catch (error) {
    app.innerHTML = `
      ${renderTopbar()}
      <main class="error-state">
        <h1>数据还没有生成</h1>
        <p>请先在站点目录运行 <code>npm run build:data</code>，生成 <code>public/data/briefs.json</code>。</p>
        <pre>${escapeHtml(error instanceof Error ? error.message : String(error))}</pre>
      </main>
    `;
  }
}

async function recordVisit() {
  try {
    const response = await fetch(statsEndpoint(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitorId: visitorId(), path: location.pathname }),
      cache: "no-store"
    });
    if (!response.ok) return;
    const visits = await response.json();
    if (visits?.enabled) {
      state.visits = visits;
      render();
    }
  } catch {
    state.visits = null;
  }
}

app.addEventListener("click", (event) => {
  const dateButton = event.target.closest("[data-date]");
  if (dateButton) {
    state.selectedDate = dateButton.dataset.date;
    state.category = "all";
    state.query = "";
    render();
    return;
  }

  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    state.category = categoryButton.dataset.category;
    render();
    return;
  }

  const latestButton = event.target.closest('[data-action="latest"]');
  if (latestButton && state.data?.briefs?.length) {
    state.selectedDate = state.data.briefs[0].date;
    state.category = "all";
    state.query = "";
    render();
  }
});

app.addEventListener("input", (event) => {
  if (event.target.matches(".search-input")) {
    state.query = event.target.value;
    render();
    const input = app.querySelector(".search-input");
    input?.focus();
    input?.setSelectionRange(state.query.length, state.query.length);
  }
});

init();
