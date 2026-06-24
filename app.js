function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function encodeImageSrc(value) {
  return encodeURI(String(value ?? "").trim());
}

function withFallback(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function cleanWorkInfoValue(value) {
  const text = String(value ?? "").trim();
  return /^(?:技法|サイズ|キャプション)：?$/.test(text) ? "" : text;
}

function uiT(key, fallback) {
  const lang = getCurrentLang();
  const dict = window.I18N?.[lang] || window.I18N?.ja || {};
  return dict[key] || fallback;
}

function getCurrentLang() {
  let lang = "ja";
  try {
    lang = localStorage.getItem("site-lang") || "ja";
  } catch (_) {
    lang = "ja";
  }
  return lang;
}

function workText(work, field) {
  const lang = getCurrentLang();
  if (lang === "en") {
    const translatedKey = `${field}_en`;
    if (Object.prototype.hasOwnProperty.call(work || {}, translatedKey)) return work[translatedKey];
  }
  return work?.[field];
}

function detectSiteBasePath() {
  const pages = [
    "index",
    "hanga",
    "hanga-wood",
    "hanga-copper",
    "digital-illustration",
    "digital-mini-chara",
    "manga",
    "manga-4koma",
    "manga-story",
    "about",
    "profile",
    "shop",
  ];
  const path = window.location.pathname;
  if (/\/work-[^/]+\.html$/.test(path)) {
    return `${path.slice(0, path.lastIndexOf("/") + 1)}`.replace(/\/+/g, "/");
  }
  for (const page of pages) {
    const patterns = [`/${page}.html`, `/${page}/`, `/${page}`];
    for (const suffix of patterns) {
      if (path.endsWith(suffix)) {
        const base = path.slice(0, -suffix.length);
        return `${base}/`.replace(/\/+/g, "/");
      }
    }
  }
  return path.endsWith("/") ? path : `${path}/`;
}

function normalizeInternalPageLinks() {
  const links = document.querySelectorAll('a[href$=".html"]');
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) return;
    const page = href.split("/").pop();
    if (!page) return;
    const base = detectSiteBasePath();
    link.setAttribute("href", appendPageVersion(`${base}${page}`));
  });
}

function setupMobileMenu() {
  const header = document.querySelector(".site-header");
  const brand = header?.querySelector(".brand");
  const nav = header?.querySelector(".nav");
  const langSwitch = document.querySelector(".lang-switch");
  const mobileQuery = window.matchMedia("(max-width: 768px)");
  if (!header || !brand || !nav) return;

  if (/\/manga(?:-4koma|-story)?\.html$/.test(window.location.pathname)) {
    document.body.classList.add("page-manga");
  }

  if (header.querySelector(".nav-menu-toggle")) return;

  const button = document.createElement("button");
  button.className = "nav-menu-toggle";
  button.type = "button";
  button.innerHTML = '<span class="nav-menu-icon" aria-hidden="true"><span></span><span></span></span><span class="sr-only">Menu</span>';
  button.setAttribute("aria-label", "メニュー");
  button.setAttribute("aria-expanded", "false");
  nav.id = nav.id || "site-nav";
  button.setAttribute("aria-controls", nav.id);
  brand.insertAdjacentElement("afterend", button);

  const placeLangSwitch = (isMobile) => {
    if (!langSwitch) return;
    if (isMobile) {
      if (button.previousElementSibling !== langSwitch) {
        button.insertAdjacentElement("beforebegin", langSwitch);
      }
    } else if (langSwitch.parentElement !== document.body) {
      document.body.insertBefore(langSwitch, header);
    }
  };

  placeLangSwitch(mobileQuery.matches);

  const closeMenu = () => {
    document.body.classList.remove("menu-open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "メニュー");
  };

  button.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("menu-open");
    button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    button.setAttribute("aria-label", isOpen ? "閉じる" : "メニュー");
  });

  nav.addEventListener("click", (event) => {
    if (event.target === nav) {
      closeMenu();
      return;
    }
    if (event.target.closest("a, button[data-lang-switch]")) closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (mobileQuery.matches && document.body.classList.contains("menu-open")) {
      if (!header.contains(event.target)) closeMenu();
    }
  });

  mobileQuery.addEventListener("change", (event) => {
    placeLangSwitch(event.matches);
    if (!event.matches) closeMenu();
  });
}

const galleryState = new Map();
let topCategoryButtonsVisible = false;
let pendingOpenWorkId = null;
let pendingOpenEnabled = false;
let workListLocationRestored = false;
const detailPageVersion = "20260624a";

function appendPageVersion(href) {
  const text = String(href ?? "").trim();
  if (!text) return text;
  if (/^(?:https?:|mailto:|tel:|#|javascript:)/i.test(text)) return text;
  try {
    const url = new URL(text, window.location.href);
    if (/\.html(?:$|[?#])/.test(url.pathname)) {
      url.searchParams.set("v", detailPageVersion);
      return url.toString();
    }
  } catch (_) {
    // keep original href on parse failures
  }
  return text;
}

function ensureVersionedLocation() {
  if (!/\.html(?:$|[?#])/.test(window.location.pathname)) return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("v") === detailPageVersion) return;
    url.searchParams.set("v", detailPageVersion);
    window.history.replaceState({}, "", url.toString());
  } catch (_) {
    // ignore URL rewrite failures
  }
}

ensureVersionedLocation();

try {
  const params = new URLSearchParams(window.location.search);
  const workId = params.get("work");
  pendingOpenWorkId = workId ? String(workId) : null;
  pendingOpenEnabled = params.get("open") === "1";
} catch (_) {
  pendingOpenWorkId = null;
  pendingOpenEnabled = false;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseSizeInfo(sizeText) {
  const text = String(sizeText ?? "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[×xX]\s*(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (!match) return { width: null, height: null, ratio: null, area: null };
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!w || !h) return { width: null, height: null, ratio: null, area: null };
  return { width: w, height: h, ratio: w / h, area: w * h };
}

function isCopperTechnique(technique) {
  const text = String(technique ?? "");
  return /エッチング|ドライポイント|アクアチント|銅版/.test(text);
}

function getWorkRatio(work) {
  const { ratio } = parseSizeInfo(work.size);
  return ratio ?? 1;
}

function getWorkArea(work) {
  const { area } = parseSizeInfo(work.size);
  return area ?? 0;
}

function getYearScore(value) {
  const nums = String(value ?? "").match(/\d{4}/g);
  if (!nums || !nums.length) return 0;
  const years = nums.map(Number).filter(Number.isFinite);
  const latestYear = Math.max(...years);
  const isRange = years.length > 1;
  return latestYear * 10 + (isRange ? 0 : 1);
}

function getIdScore(value) {
  const num = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(num) ? num : 0;
}

function getMiniCharaCatPriority(work) {
  if (work?.subcategory !== "mini-chara") return 0;
  const title = String(work?.title ?? "");
  return /猫|ねこ|ネコ|とら|トラ|きじ|キジ|みけ|ミケ|鯖|さば/.test(title) ? 1 : 0;
}

function arrangementKey(work) {
  const ratio = getWorkRatio(work);
  if (ratio < 0.85) return 0;
  if (ratio > 1.2) return 2;
  return 1;
}

function similarityScore(a, b) {
  const ratioDiff = Math.abs(getWorkRatio(a) - getWorkRatio(b));
  const areaDiff = Math.abs(Math.log10((getWorkArea(a) || 1) / (getWorkArea(b) || 1)));
  return ratioDiff * 4 + areaDiff;
}

function isMainScaleWork(work) {
  const { width, height } = parseSizeInfo(work.size);
  return Number(width) > 1000 || Number(height) > 1000;
}

function isFourPanelMangaWork(work) {
  const sub = String(work?.subcategory ?? "");
  if (sub) return /4koma|four|四コマ|4コマ/i.test(sub);
  const text = `${work?.title ?? ""} ${work?.technique ?? ""} ${work?.caption ?? ""}`;
  return /4コマ|四コマ|４コマ|四齣/i.test(text);
}

function isStoryMangaWork(work) {
  return work?.category === "manga" && !isFourPanelMangaWork(work);
}

function getWorkPagePath(work) {
  if (work.category === "digital") {
    return work.subcategory === "mini-chara" ? "digital-mini-chara.html" : "digital-illustration.html";
  }
  if (work.category === "manga") return isFourPanelMangaWork(work) ? "manga-4koma.html" : "manga-story.html";
  if (work.category === "hanga") {
    const isCopper = /エッチング|ドライポイント|アクアチント|銅版/.test(String(work.technique ?? ""));
    return isCopper ? "hanga-copper.html" : "hanga-wood.html";
  }
  return "index.html";
}

function getWorkListPagePath(work) {
  return getWorkPagePath(work);
}

function getWorkShopUrl(work) {
  const url = String(work?.shopUrl ?? work?.shop_url ?? "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function getWorkShopStatus(work) {
  const raw = String(work?.shopStatus ?? work?.shop_status ?? "").trim().toLowerCase();
  if (["sold_out", "sold-out", "soldout", "sold"].includes(raw)) return "sold_out";
  if (["available", "on_sale", "sale", "public"].includes(raw)) return "available";
  if (["preparing", "private", "hidden", "none"].includes(raw)) return "preparing";
  return getWorkShopUrl(work) ? "available" : "preparing";
}

function getVersionedWorkPagePath(work) {
  return appendPageVersion(getWorkPagePath(work));
}

function getWorkListImagePath(imagePath) {
  const path = String(imagePath || "");
  return path.replace(/^assets\/works\//, "assets/works/list/");
}

function getWorkDetailPagePath(work, workIds = null, source = "") {
  const id = String(work?.id ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
  const basePath = id ? `work-${id}.html` : getWorkPagePath(work);
  const orderedIds = Array.isArray(workIds)
    ? workIds.map((item) => String(item ?? "")).filter(Boolean)
    : [];
  const params = new URLSearchParams();
  params.set("v", detailPageVersion);
  if (orderedIds.length) params.set("list", orderedIds.join(","));
  const sourceText = String(source ?? "").trim();
  if (sourceText) params.set("source", sourceText);
  return `${basePath}?${params.toString()}`;
}

function renderWorkDetailPage() {
  const article = document.querySelector(".work-detail[data-work-id]");
  if (!article || !Array.isArray(works) || !works.length) return;
  const workId = String(article.dataset.workId || "");
  const work = works.find((item) => String(item?.id ?? "") === workId);
  if (!work) return;
  article.classList.toggle("is-four-panel-manga-detail", isFourPanelMangaWork(work));
  article.classList.toggle("is-story-manga-detail", isStoryMangaWork(work));

  const title = workText(work, "title");
  const year = cleanWorkInfoValue(workText(work, "year"));
  const technique = cleanWorkInfoValue(workText(work, "technique"));
  const size = cleanWorkInfoValue(workText(work, "size"));
  const caption = cleanWorkInfoValue(workText(work, "caption"));
  const categoryLabel = getWorkDetailCategoryLabel(work);
  const listPage = getWorkListPagePath(work);
  const categoryHref = appendPageVersion(listPage);

  const titleText = withFallback(title);
  const metaValues = [year, technique, size, categoryLabel];

  const pageTitle = document.querySelector("title");
  if (pageTitle) pageTitle.textContent = `${titleText} | Kome Ume`;

  const captionTitle = article.querySelector(".caption-title");
  if (captionTitle) captionTitle.textContent = titleText;

  const metaRows = article.querySelectorAll(".caption-meta");
  metaRows.forEach((row, index) => {
    const cells = row.querySelectorAll("span, a");
    if (!cells.length) return;
    if (index < metaValues.length - 1) {
      if (cells[1]) cells[1].textContent = withFallback(metaValues[index]);
      return;
    }
    const labelCell = row.querySelector("[data-work-category-link]") || row.querySelector("[data-work-category-label]");
    const categoryText = withFallback(categoryLabel);
    if (labelCell) {
      if (labelCell.tagName === "A") {
        labelCell.href = categoryHref;
        labelCell.textContent = categoryText;
      } else {
        labelCell.innerHTML = `<a data-work-category-link href="${escapeHtml(categoryHref)}">${escapeHtml(categoryText)}</a>`;
      }
    }
  });

  const captionText = article.querySelector(".caption-text");
  if (captionText) captionText.textContent = withFallback(caption);

  const returnState = getWorkListReturnState(workId);
  renderSelectedWorksCategoryCta(article, work, returnState);
  renderWorkShopCta(article, work);

  const images = Array.isArray(work.images) && work.images.length
    ? work.images.map((image) => String(image ?? "")).filter(Boolean)
    : [work.image].map((image) => String(image ?? "")).filter(Boolean);
  const media = article.querySelector(".work-detail-media");
  if (media && images.length) {
    const thumbnailLabel = uiT("detail_thumbnails", "作品画像一覧");
    const isStoryViewer = isStoryMangaWork(work) && images.length > 1;
    const pageControls = isStoryViewer
      ? `
      <div class="story-page-controls" data-story-page-controls aria-label="${escapeHtml(uiT("story_page_select", "ページ選択"))}">
        <button class="story-page-button" type="button" data-story-page-prev aria-label="${escapeHtml(uiT("story_page_prev", "前のページ"))}">‹</button>
        <label class="story-page-picker">
          <span class="sr-only">${escapeHtml(uiT("story_page_select", "ページ選択"))}</span>
          <select class="story-page-select" data-story-page-select>
            ${images.map((_, index) => `<option value="${index}">${index + 1}</option>`).join("")}
          </select>
          <span class="story-page-total">/ ${images.length}</span>
        </label>
        <button class="story-page-button" type="button" data-story-page-next aria-label="${escapeHtml(uiT("story_page_next", "次のページ"))}">›</button>
      </div>
      `
      : "";
    media.innerHTML = `
      <figure class="work-detail-main">
        <img class="work-detail-main-image" data-work-detail-main-image src="${escapeHtml(encodeImageSrc(images[0]))}" alt="${escapeHtml(images.length > 1 ? `${titleText} 1` : titleText)}">
      </figure>
      ${pageControls}
      <div class="work-detail-thumbnails" data-work-detail-thumbnails aria-label="${escapeHtml(thumbnailLabel)}">
        ${images.map((imagePath, index) => `
          <button class="work-detail-thumb${index === 0 ? " is-active" : ""}" type="button" data-work-detail-thumb data-work-index="${index}" aria-pressed="${index === 0 ? "true" : "false"}">
            <img src="${escapeHtml(encodeImageSrc(imagePath))}" alt="${escapeHtml(`${titleText} ${index + 1}`)}" loading="lazy">
          </button>
        `).join("")}
      </div>
    `;

    const mainImage = media.querySelector("[data-work-detail-main-image]");
    const thumbButtons = Array.from(media.querySelectorAll("[data-work-detail-thumb]"));
    const thumbnailList = media.querySelector("[data-work-detail-thumbnails]");
    const storyPrevButton = media.querySelector("[data-story-page-prev]");
    const storyNextButton = media.querySelector("[data-story-page-next]");
    const storyPageSelect = media.querySelector("[data-story-page-select]");
    const activateIndex = (index) => {
      const safeIndex = Math.min(Math.max(Number(index) || 0, 0), images.length - 1);
      if (mainImage) {
        mainImage.setAttribute("src", encodeImageSrc(images[safeIndex]));
        mainImage.setAttribute("alt", images.length > 1 ? `${titleText} ${safeIndex + 1}` : titleText);
      }
      thumbButtons.forEach((button) => {
        const isActive = Number(button.dataset.workIndex || "-1") === safeIndex;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      if (storyPageSelect) storyPageSelect.value = String(safeIndex);
      if (storyPrevButton) storyPrevButton.disabled = safeIndex === 0;
      if (storyNextButton) storyNextButton.disabled = safeIndex === images.length - 1;
      const activeThumb = thumbButtons.find((button) => Number(button.dataset.workIndex || "-1") === safeIndex);
      if (activeThumb) activeThumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    };
    const stepStoryPage = (offset) => {
      const current = Number(storyPageSelect?.value || 0);
      activateIndex(current + offset);
    };
    const activateThumbFromEvent = (event) => {
      const button = event.target instanceof Element
        ? event.target.closest("[data-work-detail-thumb]")
        : null;
      if (!button || !media.contains(button)) return;
      event.preventDefault();
      activateIndex(button.dataset.workIndex || 0);
    };

    thumbButtons.forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        activateIndex(button.dataset.workIndex || 0);
      });
    });
    if (thumbnailList && thumbnailList.dataset.bound !== "true") {
      thumbnailList.dataset.bound = "true";
      thumbnailList.addEventListener("pointerup", activateThumbFromEvent);
      thumbnailList.addEventListener("click", activateThumbFromEvent);
      thumbnailList.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        activateThumbFromEvent(event);
      });
    }
    if (storyPrevButton) storyPrevButton.addEventListener("click", () => stepStoryPage(-1));
    if (storyNextButton) storyNextButton.addEventListener("click", () => stepStoryPage(1));
    if (storyPageSelect) storyPageSelect.addEventListener("change", () => activateIndex(storyPageSelect.value));
    if (isStoryViewer && mainImage) {
      let swipeStartX = null;
      mainImage.addEventListener("pointerdown", (event) => {
        swipeStartX = event.clientX;
      });
      mainImage.addEventListener("pointerup", (event) => {
        if (swipeStartX === null) return;
        const deltaX = event.clientX - swipeStartX;
        swipeStartX = null;
        if (Math.abs(deltaX) < 44) return;
        stepStoryPage(deltaX < 0 ? 1 : -1);
      });
      mainImage.addEventListener("pointercancel", () => {
        swipeStartX = null;
      });
    }
    activateIndex(0);
  }

  updateWorkDetailPager(work, returnState);
}

function getCategoryListLabel(key, fallback) {
  const listKey = String(key || "").replace(/^category_/, "category_list_");
  return uiT(listKey, fallback);
}

function getMoreCategoryWorksLabel(work, categoryLabel) {
  const key = getWorkDetailCategoryKey(work);
  const categoryListLabel = getCategoryListLabel(key, categoryLabel);
  return getCurrentLang() === "en"
    ? `More ${withFallback(categoryListLabel)}`
    : `${withFallback(categoryLabel)}の作品一覧を見る`;
}

function renderSelectedWorksCategoryCta(article, work, returnState) {
  const caption = article.querySelector(".caption");
  if (!caption) return;

  const existing = caption.querySelector("[data-selected-category-cta]");
  if (!isTopPageWorkDetailContext(returnState)) {
    if (existing) existing.remove();
    return;
  }

  const categoryLabel = getWorkDetailCategoryLabel(work);
  const href = appendPageVersion(getWorkListPagePath(work));
  const label = getMoreCategoryWorksLabel(work, categoryLabel);
  const link = existing || document.createElement("a");
  link.className = "work-detail-category-cta";
  link.dataset.selectedCategoryCta = "true";
  link.href = href;
  link.textContent = `${label} →`;

  const captionText = caption.querySelector(".caption-text");
  if (!existing) {
    if (captionText) captionText.insertAdjacentElement("afterend", link);
    else caption.appendChild(link);
  }
}

function renderWorkShopCta(article, work) {
  const caption = article.querySelector(".caption");
  if (!caption) return;

  article.querySelectorAll(".caption-shop-meta, .work-detail-caption > [data-work-shop]").forEach((node) => {
    node.remove();
  });

  let shopBlock = caption.querySelector(":scope > [data-work-shop]");
  if (!shopBlock) {
    shopBlock = document.createElement("div");
    shopBlock.className = "work-detail-shop";
    shopBlock.dataset.workShop = "true";
  }

  const shopUrl = getWorkShopUrl(work);
  const shopStatus = getWorkShopStatus(work);
  shopBlock.innerHTML = "";
  const placeShopBlock = () => {
    const categoryCta = caption.querySelector("[data-selected-category-cta]");
    const captionText = caption.querySelector(".caption-text");
    if (categoryCta) categoryCta.insertAdjacentElement("afterend", shopBlock);
    else if (captionText) captionText.insertAdjacentElement("afterend", shopBlock);
    else caption.appendChild(shopBlock);
  };

  if (shopStatus === "sold_out") {
    const status = document.createElement("span");
    status.className = "work-detail-shop-status is-sold-out";
    status.dataset.workShopCta = "true";
    status.dataset.i18n = "work_shop_sold_out";
    status.textContent = uiT("work_shop_sold_out", "Sold out");
    shopBlock.appendChild(status);
    placeShopBlock();
    return;
  }

  if (shopStatus !== "available" || !shopUrl) {
    const status = document.createElement("span");
    status.className = "work-detail-shop-status is-preparing";
    status.dataset.workShopCta = "true";
    status.dataset.i18n = "work_shop_preparing";
    status.textContent = uiT("work_shop_preparing", "販売準備中");
    shopBlock.appendChild(status);
    placeShopBlock();
    return;
  }

  const link = document.createElement("a");
  link.className = "work-detail-shop-cta";
  link.dataset.workShopCta = "true";
  link.dataset.i18n = "work_shop_available";
  link.href = shopUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = uiT("work_shop_available", "販売ページ →");
  shopBlock.appendChild(link);
  placeShopBlock();
}

function attachWorkDetailThumbnailControls() {
  document.querySelectorAll(".work-detail-media").forEach((media) => {
    const thumbnailList = media.querySelector("[data-work-detail-thumbnails]");
    const mainImage = media.querySelector("[data-work-detail-main-image]");
    const thumbButtons = Array.from(media.querySelectorAll("[data-work-detail-thumb]"));
    if (!thumbnailList || !mainImage || !thumbButtons.length) return;

    const activateButton = (button) => {
      const thumbImage = button.querySelector("img");
      const nextSrc = thumbImage?.getAttribute("src");
      if (!nextSrc) return;
      mainImage.setAttribute("src", nextSrc);
      mainImage.setAttribute("alt", thumbImage.getAttribute("alt") || mainImage.getAttribute("alt") || "");
      thumbButtons.forEach((thumbButton) => {
        const isActive = thumbButton === button;
        thumbButton.classList.toggle("is-active", isActive);
        thumbButton.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    };

    const activateFromEvent = (event) => {
      const button = event.target instanceof Element
        ? event.target.closest("[data-work-detail-thumb]")
        : null;
      if (!button || !media.contains(button)) return;
      event.preventDefault();
      activateButton(button);
    };

    if (thumbnailList.dataset.fallbackBound === "true") return;
    thumbnailList.dataset.fallbackBound = "true";
    thumbnailList.addEventListener("pointerup", activateFromEvent);
    thumbnailList.addEventListener("click", activateFromEvent);
    thumbnailList.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      activateFromEvent(event);
    });
  });
}

function updateWorkDetailPager(work, returnState) {
  const pager = document.querySelector(".work-detail-pager");
  if (!pager) return;

  const pagerLinks = pager.querySelectorAll("a");
  if (!pagerLinks.length) return;

  const urlWorkIds = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("list") || "";
      if (!raw) return [];
      return raw.split(",").map((id) => String(id ?? "")).filter(Boolean);
    } catch (_) {
      return [];
    }
  })();
  const workIds = urlWorkIds.length
    ? urlWorkIds
    : Array.isArray(returnState?.workIds) && returnState.workIds.length
      ? returnState.workIds.map((id) => String(id ?? "")).filter(Boolean)
      : getTopSelectedWorkIds();
  if (!workIds.length) return;

  const currentId = String(work?.id ?? "");
  const currentIndex = workIds.indexOf(currentId);
  if (currentIndex < 0) return;

  const prevId = currentIndex > 0 ? workIds[currentIndex - 1] : "";
  const nextId = currentIndex < workIds.length - 1 ? workIds[currentIndex + 1] : "";
  const prevSlot = pager.querySelector(".work-detail-pager-prev");
  const nextSlot = pager.querySelector(".work-detail-pager-next");
  const prevLink = prevSlot?.querySelector("a");
  const nextLink = nextSlot?.querySelector("a");

  if (prevLink) {
    if (prevId) {
      const prevWork = works.find((item) => String(item?.id ?? "") === prevId);
      if (prevWork) {
        prevLink.setAttribute("href", getWorkDetailPagePath(prevWork));
        const key = getMangaSeriesPagerLabelKey(work, prevWork, "prev_work");
        prevLink.dataset.i18n = key;
        prevLink.textContent = getPagerLabelText(key);
      }
      prevLink.hidden = false;
      prevLink.style.visibility = "visible";
      prevLink.style.pointerEvents = "";
      prevLink.tabIndex = 0;
    } else {
      prevLink.hidden = false;
      prevLink.style.visibility = "hidden";
      prevLink.style.pointerEvents = "none";
      prevLink.tabIndex = -1;
    }
  }

  if (nextLink) {
    if (nextId) {
      const nextWork = works.find((item) => String(item?.id ?? "") === nextId);
      if (nextWork) {
        nextLink.setAttribute("href", getWorkDetailPagePath(nextWork));
        const key = getMangaSeriesPagerLabelKey(work, nextWork, "next_work");
        nextLink.dataset.i18n = key;
        nextLink.textContent = getPagerLabelText(key);
      }
      nextLink.hidden = false;
      nextLink.style.visibility = "visible";
      nextLink.style.pointerEvents = "";
      nextLink.tabIndex = 0;
    } else {
      nextLink.hidden = false;
      nextLink.style.visibility = "hidden";
      nextLink.style.pointerEvents = "none";
      nextLink.tabIndex = -1;
    }
  }
}

function renderAboutPage() {
  const snsCard = document.querySelector("[data-about-sns]");
  const contactCard = document.querySelector("[data-about-contact]");
  if (!snsCard && !contactCard) return;

  const instagramPrint = "https://www.instagram.com/komeume1121/";
  const instagramDigital = "https://www.instagram.com/unomori1121/";
  const email = "komeume1121@gmail.com";

  if (snsCard) {
    snsCard.innerHTML = `
      <h2 data-i18n="card_sns_title">${uiT("card_sns_title", "SNS")}</h2>
      <p data-i18n="card_sns_desc">${uiT("card_sns_desc", "主にInstagramで告知・発表をしています。")}</p>
      <div class="sns-actions">
        <div class="sns-row">
          <span class="sns-label" data-i18n="sns_print">${uiT("sns_print", "版画など")}</span>
          <a class="button secondary" href="${instagramPrint}" target="_blank" rel="noopener noreferrer">@komeume1121</a>
        </div>
        <div class="sns-row">
          <span class="sns-label" data-i18n="sns_digital">${uiT("sns_digital", "デジタル・漫画など")}</span>
          <a class="button secondary" href="${instagramDigital}" target="_blank" rel="noopener noreferrer">@unomori1121</a>
        </div>
      </div>
    `;
  }

  if (contactCard) {
    contactCard.innerHTML = `
      <h2 data-i18n="card_contact_title">${uiT("card_contact_title", "Contact")}</h2>
      <p data-i18n="card_contact_desc">${uiT("card_contact_desc", "お仕事の依頼などは、下記のメールまでお問い合わせ下さい。")}</p>
      <div class="actions contact-actions-inline">
        <a class="button secondary" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
        <button class="button-copy-inline" type="button" data-copy-email="${escapeHtml(email)}" aria-label="メールアドレスをコピー">
          <span class="copy-done-label">${uiT("copy_done", "コピー完了！")}</span>
        </button>
      </div>
    `;
  }

  setupCopyEmailButtons();
}

function setupCopyEmailButtons() {
  const buttons = document.querySelectorAll("[data-copy-email]");
  buttons.forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    const email = button.dataset.copyEmail || "";
    button.addEventListener("click", async () => {
      if (!email) return;
      try {
        await navigator.clipboard.writeText(email);
      } catch (_) {
        return;
      }
      button.classList.add("is-copied");
      window.setTimeout(() => button.classList.remove("is-copied"), 1400);
    });
  });
}

function rememberWorkListLocation(workId, link = null) {
  try {
    const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const scroll = String(Math.max(0, Math.round(window.scrollY || 0)));
    sessionStorage.setItem("work-list-return-url", url);
    sessionStorage.setItem("work-list-return-scroll", scroll);
    if (workId) sessionStorage.setItem(`work-list-return-url:${workId}`, url);
    if (workId) sessionStorage.setItem(`work-list-return-scroll:${workId}`, scroll);

    const gallery = link?.closest?.("[data-gallery]");
    const galleryId = gallery?.dataset.galleryId || gallery?.dataset.gallery || "";
    const source = String(link?.dataset?.workSource || "").trim();
    const state = galleryId ? galleryState.get(galleryId) : null;
    if ((galleryId && state) || isTopPageWorkSource(source)) {
      const payload = {
        url,
        workId: String(workId || ""),
        galleryId,
        source,
        currentPage: state?.currentPage || 1,
        shownCount: state?.shownCount || 0,
        scroll: Number(scroll) || 0,
      };
      if (Array.isArray(state?.arranged)) {
        payload.workIds = state.arranged.map((work) => String(work?.id ?? "")).filter(Boolean);
      } else if (isTopPageWorkSource(source)) {
        payload.workIds = getTopSelectedWorkIds();
      }
      const serialized = JSON.stringify(payload);
      sessionStorage.setItem("work-list-return-state", serialized);
      if (workId) sessionStorage.setItem(`work-list-return-state:${workId}`, serialized);
    }
  } catch (_) {
    // ignore storage failures
  }
}

function getWorkListReturnState(workId = "") {
  try {
    const raw = (workId && sessionStorage.getItem(`work-list-return-state:${workId}`))
      || sessionStorage.getItem("work-list-return-state")
      || "";
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (!state || typeof state !== "object") return null;
    return state;
  } catch (_) {
    return null;
  }
}

function getWorkDetailSourceParam() {
  try {
    return new URLSearchParams(window.location.search).get("source") || "";
  } catch (_) {
    return "";
  }
}

function isTopPageWorkSource(source) {
  return source === "top-selected" || source === "top-hero";
}

function isTopPageWorkDetailContext(returnState) {
  return returnState?.galleryId === "top-selected"
    || isTopPageWorkSource(String(returnState?.source || ""))
    || isTopPageWorkSource(getWorkDetailSourceParam());
}

function getTopSelectedWorkIds() {
  try {
    const raw = sessionStorage.getItem("top-selected-work-ids") || "";
    if (!raw) return [];
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return [];
    return ids.map((id) => String(id ?? "")).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function setupWorkDetailBackLink() {
  const backLink = document.querySelector(".work-detail-back");
  const workId = document.querySelector(".work-detail")?.dataset.workId || "";
  if (!backLink) return;
  try {
    const returnState = getWorkListReturnState(workId);
    if (returnState?.galleryId === "top-selected") {
      backLink.dataset.i18n = "back_to_selected_works";
      backLink.textContent = uiT("back_to_selected_works", "Selected Worksへ");
    }
    const saved = (workId && sessionStorage.getItem(`work-list-return-url:${workId}`))
      || sessionStorage.getItem("work-list-return-url")
      || "";
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const isSameOriginReferrer = referrer && referrer.origin === window.location.origin;
    const referrerPath = isSameOriginReferrer ? `${referrer.pathname}${referrer.search}${referrer.hash}` : "";
    const referrerIsWorkDetail = /\/work-[^/]+\.html(?:[?#].*)?$/.test(referrerPath);
    const target = saved || (!referrerIsWorkDetail ? referrerPath : "");
    if (target) backLink.setAttribute("href", appendPageVersion(target));
    if (isSameOriginReferrer && !referrerIsWorkDetail) {
      backLink.addEventListener("click", (event) => {
        event.preventDefault();
        window.history.back();
      });
    }
  } catch (_) {
    // keep generated fallback href
  }
}

function restoreWorkListLocation() {
  if (workListLocationRestored) return;
  if (/\/work-[^/]+\.html(?:[?#].*)?$/.test(window.location.pathname)) return;
  try {
    const saved = sessionStorage.getItem("work-list-return-url") || "";
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!saved || saved !== current) return;
    const returnState = getWorkListReturnState();
    const scroll = Number.parseInt(String(returnState?.scroll ?? sessionStorage.getItem("work-list-return-scroll") ?? ""), 10);
    if (!Number.isFinite(scroll) || scroll <= 0) return;
    workListLocationRestored = true;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scroll, behavior: "auto" });
    });
  } catch (_) {
    // ignore storage failures
  }
}

function getReturnStateForGallery(galleryId) {
  const state = getWorkListReturnState();
  if (!state || state.galleryId !== galleryId) return null;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (state.url !== current) return null;
  return state;
}

function arrangeBySimilarityInGroup(list) {
  const base = [...list].sort((a, b) => {
    const keyDiff = arrangementKey(a) - arrangementKey(b);
    if (keyDiff) return keyDiff;
    return getWorkRatio(a) - getWorkRatio(b);
  });
  const result = [];
  while (base.length) {
    const current = base.shift();
    result.push(current);
    if (!base.length) break;
    let bestIndex = 0;
    let bestScore = similarityScore(current, base[0]);
    for (let i = 1; i < base.length; i += 1) {
      const score = similarityScore(current, base[i]);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    result.push(base.splice(bestIndex, 1)[0]);
  }
  return result;
}

function arrangeBySimilarity(list) {
  const mainWorks = list.filter(isMainScaleWork);
  const otherWorks = list.filter((work) => !isMainScaleWork(work));
  return [...arrangeBySimilarityInGroup(mainWorks), ...arrangeBySimilarityInGroup(otherWorks)];
}

function hasGallerySortControls(galleryId) {
  return Boolean(document.querySelector(`[data-gallery-sort-for="${CSS.escape(galleryId)}"]`));
}

function syncGalleryAvailability(gallery, galleryId, hasWorks) {
  if (!gallery || !galleryId) return;
  gallery.hidden = !hasWorks;
  document.querySelectorAll(`[data-gallery-sort-for="${CSS.escape(galleryId)}"]`).forEach((control) => {
    control.hidden = !hasWorks;
  });
  if (!hasWorks) {
    removePaginationControls(gallery, galleryId);
  }
}

function getGallerySortMode(gallery, galleryId, prev) {
  if (prev?.sortMode) return prev.sortMode;
  if (galleryId === "hanga" || galleryId.startsWith("hanga-")) return "size";
  if (hasGallerySortControls(galleryId)) return "year";
  return gallery.dataset.sort || "default";
}

function getSeriesOrderScore(work) {
  const value = Number(work?.seriesOrder);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function getMangaGroupPriority(work) {
  return getMangaGroupKey(work) === "sisters" ? 0 : 1;
}

function isSameMangaSeriesNavigation(currentWork, targetWork) {
  if (!currentWork || !targetWork) return false;
  if (!isFourPanelMangaWork(currentWork) || !isFourPanelMangaWork(targetWork)) return false;
  const currentSeries = String(currentWork?.series ?? "").trim();
  const targetSeries = String(targetWork?.series ?? "").trim();
  return Boolean(currentSeries) && currentSeries === targetSeries;
}

function getSeriesOrderValue(work) {
  const value = Number(work?.seriesOrder);
  return Number.isFinite(value) ? value : null;
}

function getMangaSeriesPagerLabelKey(currentWork, targetWork, fallbackKey) {
  if (!isSameMangaSeriesNavigation(currentWork, targetWork)) return fallbackKey;
  const currentOrder = getSeriesOrderValue(currentWork);
  const targetOrder = getSeriesOrderValue(targetWork);
  if (currentOrder !== null && targetOrder !== null && currentOrder !== targetOrder) {
    return targetOrder < currentOrder ? "prev_episode" : "next_episode";
  }
  return fallbackKey === "prev_work" ? "prev_episode" : "next_episode";
}

function getPagerLabelText(key) {
  const fallbackMap = {
    prev_episode: "前の話",
    next_episode: "次の話",
    prev_work: "前の作品",
    next_work: "次の作品",
  };
  return uiT(key, fallbackMap[key] || "作品");
}

function sortWorks(list, sortMode, category) {
  if (sortMode === "page") {
    if (category === "manga-4koma") {
      return [...list].sort((a, b) => {
        const groupDiff = getMangaGroupPriority(a) - getMangaGroupPriority(b);
        if (groupDiff) return groupDiff;
        const orderDiff = getSeriesOrderScore(a) - getSeriesOrderScore(b);
        if (orderDiff) return orderDiff;
        return getIdScore(a.id) - getIdScore(b.id);
      });
    }
    if (category === "manga-story") {
      return [...list].sort((a, b) => {
        const pageDiff = getWorkPageCount(b) - getWorkPageCount(a);
        if (pageDiff) return pageDiff;
        const yearDiff = getYearScore(b.year) - getYearScore(a.year);
        if (yearDiff) return yearDiff;
        return getIdScore(b.id) - getIdScore(a.id);
      });
    }
  }
  if (sortMode === "story-asc" || sortMode === "story-desc") {
    const direction = sortMode === "story-desc" ? -1 : 1;
    return [...list].sort((a, b) => {
      const groupDiff = getMangaGroupPriority(a) - getMangaGroupPriority(b);
      if (groupDiff) return groupDiff;
      const orderDiff = getSeriesOrderScore(a) - getSeriesOrderScore(b);
      if (orderDiff) return orderDiff * direction;
      return getIdScore(a.id) - getIdScore(b.id);
    });
  }
  if (sortMode === "year" || sortMode === "recent") {
    return [...list].sort((a, b) => {
      if (sortMode === "recent" && category === "digital-mini-chara") {
        const catDiff = getMiniCharaCatPriority(b) - getMiniCharaCatPriority(a);
        if (catDiff) return catDiff;
      }
      const yearDiff = getYearScore(b.year) - getYearScore(a.year);
      if (yearDiff) return yearDiff;
      const areaDiff = getWorkArea(b) - getWorkArea(a);
      if (areaDiff) return areaDiff;
      return getIdScore(b.id) - getIdScore(a.id);
    });
  }
  if (sortMode === "size") {
    return [...list].sort((a, b) => {
      const areaDiff = getWorkArea(b) - getWorkArea(a);
      if (areaDiff) return areaDiff;
      const yearDiff = getYearScore(b.year) - getYearScore(a.year);
      if (yearDiff) return yearDiff;
      return getIdScore(b.id) - getIdScore(a.id);
    });
  }
  if (sortMode === "random") return shuffle(list);
  return arrangeBySimilarity(list);
}

function getGallerySortLabel(sortMode) {
  if (sortMode === "page") return uiT("sort_page", "ページ順");
  if (sortMode === "story-asc") return uiT("sort_story_asc", "第一話から");
  if (sortMode === "story-desc") return uiT("sort_story_desc", "最新話から");
  if (sortMode === "size") return uiT("sort_size", "作品サイズ順");
  return uiT("sort_year", "制作年度順");
}

function getWorkPageCount(work) {
  if (Array.isArray(work?.images) && work.images.length) return work.images.length;
  return work?.image ? 1 : 0;
}

function getWorkCardClass(work) {
  const classes = ["work"];
  const { ratio, area } = parseSizeInfo(work.size);
  if (ratio === null || area === null) {
    // Unknown size should not be forced into compact mode.
    if (work.category !== "digital") classes.push("is-compact");
    return classes.join(" ");
  }
  if (ratio !== null && area !== null && area <= 12000 && ratio >= 0.9 && ratio <= 1.1) {
    classes.push("is-compact");
  }
  return classes.join(" ");
}

function getMangaGroupKey(work) {
  return String(work?.series ?? "") === "sisters" ? "sisters" : "single";
}

function getMangaGroupLabel(groupKey) {
  return groupKey === "sisters"
    ? uiT("manga_group_sisters", "姉妹")
    : uiT("manga_group_single", "単作");
}

function groupMangaWorks(list) {
  const groups = [
    { key: "sisters", works: [] },
    { key: "single", works: [] },
  ];
  const groupMap = new Map(groups.map((group) => [group.key, group]));
  list.forEach((work) => {
    const group = groupMap.get(getMangaGroupKey(work)) || groupMap.get("single");
    group.works.push(work);
  });
  return groups.filter((group) => group.works.length);
}

function renderGalleryWorkCard(work, orderedIds) {
  const firstImage = work.images?.[0] || work.image;
  const listImage = getWorkListImagePath(firstImage);
  const title = workText(work, "title");
  const year = cleanWorkInfoValue(workText(work, "year"));
  const technique = cleanWorkInfoValue(workText(work, "technique"));
  const size = cleanWorkInfoValue(workText(work, "size"));
  const caption = cleanWorkInfoValue(workText(work, "caption"));
  const detailPath = getWorkDetailPagePath(work, orderedIds);
  return `
      <article class="${getWorkCardClass(work)}" data-work-id="${escapeHtml(work.id)}">
        <a class="work-image-link js-work-link" href="${escapeHtml(detailPath)}" data-work-id="${escapeHtml(work.id)}" data-work-page="${escapeHtml(detailPath)}" data-work-detail-link="true">
          <img src="${escapeHtml(listImage)}" alt="${escapeHtml(title)}" loading="lazy">
        </a>
        <div class="caption">
          <h3 class="caption-title">${escapeHtml(title)}</h3>
          <div class="caption-meta-list">
            <p class="caption-meta"><span>${escapeHtml(uiT("cap_year", "制作年"))}</span><span>${escapeHtml(withFallback(year))}</span></p>
            <p class="caption-meta"><span>${escapeHtml(uiT("cap_technique", "技法"))}</span><span>${escapeHtml(withFallback(technique))}</span></p>
            <p class="caption-meta"><span>${escapeHtml(uiT("cap_size", "サイズ"))}</span><span>${escapeHtml(withFallback(size))}</span></p>
          </div>
          <p class="caption-text">${escapeHtml(withFallback(caption))}</p>
          <button class="caption-toggle" type="button" hidden>${escapeHtml(uiT("caption_more", "続きを読む"))}</button>
        </div>
      </article>
    `;
}

function getWorkDetailCategoryKey(work) {
  if (work?.category === "hanga") {
    return isCopperTechnique(work.technique) ? "category_copper" : "category_wood";
  }
  if (work?.category === "digital") {
    return work?.subcategory === "mini-chara" ? "category_digital_mini_chara" : "category_digital_illustration";
  }
  if (work?.category === "manga") {
    return isFourPanelMangaWork(work) ? "category_manga_4koma" : "category_manga_story";
  }
  return "category_wood";
}

function getWorkDetailCategoryLabel(work) {
  const key = getWorkDetailCategoryKey(work);
  const fallbackMap = {
    category_wood: "木版画",
    category_copper: "銅版画",
    category_digital_illustration: "デジタル",
    category_digital_mini_chara: "ミニキャラ",
    category_manga_4koma: "四コマ",
    category_manga_story: "ストーリー",
  };
  return uiT(key, fallbackMap[key] || "—");
}

const shopWorkCategoryOrder = [
  "category_wood",
  "category_copper",
  "category_digital_illustration",
  "category_digital_mini_chara",
  "category_manga_4koma",
  "category_manga_story",
];

const shopGoodsCategoryOrder = [
  "wood-accessory",
  "acrylic-keychain",
  "other",
];

function getShopUrlScore(url) {
  const match = String(url ?? "").match(/\/items\/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function getShopWorkItems() {
  if (!Array.isArray(works)) return [];
  return works
    .map((work) => {
      const shopUrl = getWorkShopUrl(work);
      const shopStatus = getWorkShopStatus(work);
      return {
        type: "work",
        id: String(work?.id ?? ""),
        title: workText(work, "title"),
        image: getWorkListImagePath(work.images?.[0] || work.image || ""),
        url: shopUrl,
        detailUrl: getWorkDetailPagePath(work),
        status: shopStatus,
        categoryKey: getWorkDetailCategoryKey(work),
        area: getWorkArea(work),
        sortScore: getShopUrlScore(shopUrl),
      };
    })
    .filter((item) => item.title && item.image);
}

function getShopGoodsItems() {
  const items = Array.isArray(typeof shopItems !== "undefined" ? shopItems : null) ? shopItems : [];
  return items.map((item) => ({
    type: "goods",
    id: String(item?.id ?? item?.shopUrl ?? item?.title ?? ""),
    title: workText(item, "title"),
    image: getWorkListImagePath(item?.image || item?.images?.[0] || ""),
    url: String(item?.shopUrl ?? item?.shop_url ?? "").trim(),
    categoryKey: String(item?.goodsCategory ?? item?.goods_category ?? "other").trim() || "other",
    sortScore: getShopUrlScore(item?.shopUrl ?? item?.shop_url),
  })).filter((item) => item.title && item.image && /^https?:\/\//i.test(item.url));
}

function getShopGoodsCategoryLabel(key) {
  const labels = {
    "wood-accessory": uiT("shop_goods_wood_accessory", "木版画アクセサリー"),
    "acrylic-keychain": uiT("shop_goods_acrylic_keychain", "アクリルキーホルダー"),
    other: uiT("shop_goods_other", "その他"),
  };
  return labels[key] || labels.other;
}

function renderShopCard(item) {
  const imageMarkup = `
          <span class="shop-item-image-wrap">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy">
          </span>
          <span class="shop-item-title">${escapeHtml(item.title)}</span>`;
  if (!item.url) {
    return `
      <article class="shop-item is-${escapeHtml(item.status || "preparing")}" data-shop-item-id="${escapeHtml(item.id)}">
        <span class="shop-item-link is-disabled">
${imageMarkup}
        </span>
      </article>`;
  }
  return `
      <article class="shop-item is-${escapeHtml(item.status || "available")}" data-shop-item-id="${escapeHtml(item.id)}">
        <a class="shop-item-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
${imageMarkup}
        </a>
      </article>`;
}

function renderShopGroups(container, items, getLabel, order) {
  if (!items.length) {
    container.innerHTML = `<p class="shop-empty" data-i18n="shop_empty">${escapeHtml(uiT("shop_empty", "現在表示できる商品はありません。"))}</p>`;
    return;
  }
  const orderMap = new Map(order.map((key, index) => [key, index]));
  const groups = new Map();
  items.forEach((item) => {
    const key = item.categoryKey || "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  const sortGroupItems = (groupItems) => [...groupItems].sort((a, b) => {
    const areaDiff = (Number(b.area) || 0) - (Number(a.area) || 0);
    if (areaDiff) return areaDiff;
    return String(a.title || "").localeCompare(String(b.title || ""), "ja");
  });
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
    const orderDiff = (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999);
    if (orderDiff) return orderDiff;
    return a.localeCompare(b);
  });
  container.innerHTML = sortedGroups.map(([key, groupItems]) => `
    <section class="shop-category-group">
      <h2>${escapeHtml(getLabel(key))}</h2>
      <div class="shop-item-grid">
${sortGroupItems(groupItems).map(renderShopCard).join("")}
      </div>
    </section>
  `).join("");
}

function renderShopFlat(container, items) {
  if (!items.length) {
    container.innerHTML = `<p class="shop-empty" data-i18n="shop_empty">${escapeHtml(uiT("shop_empty", "現在表示できる商品はありません。"))}</p>`;
    return;
  }
  container.innerHTML = `<div class="shop-item-grid shop-item-grid-flat">
${items.map(renderShopCard).join("")}
    </div>`;
}

function applyShopItemOrientationClasses(root = document) {
  root.querySelectorAll(".shop-item img").forEach((img) => {
    const setClass = () => {
      const item = img.closest(".shop-item");
      if (!item) return;
      const naturalWidth = Number(img.naturalWidth) || 0;
      const naturalHeight = Number(img.naturalHeight) || 0;
      item.classList.remove("is-wide-landscape", "is-extreme-landscape", "is-extreme-portrait");
      if (!naturalWidth || !naturalHeight) return;
      const imageRatio = naturalWidth / naturalHeight;
      item.classList.toggle("is-extreme-portrait", imageRatio < 0.42);
      item.classList.toggle("is-extreme-landscape", imageRatio > 2.4);
      item.classList.toggle("is-wide-landscape", imageRatio > 1.2);
    };
    if (img.complete) {
      setClass();
    } else {
      img.addEventListener("load", setClass, { once: true });
    }
  });
}

function renderShopPage() {
  const page = document.querySelector("[data-shop-page]");
  if (!page) return;
  const worksContainer = page.querySelector("[data-shop-works]");
  const goodsContainer = page.querySelector("[data-shop-goods]");
  const filterMode = page.dataset.shopFilter || "available";
  const activePanel = page.dataset.shopPanel || "works";

  page.querySelectorAll("[data-shop-tab]").forEach((button) => {
    const isActive = button.dataset.shopTab === activePanel;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    if (button.dataset.bound !== "true") {
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        page.dataset.shopPanel = button.dataset.shopTab || "works";
        renderShopPage();
      });
    }
  });
  page.querySelectorAll("[data-shop-panel]").forEach((panel) => {
    const isActive = panel.dataset.shopPanel === activePanel;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
  const setupShopDropdown = (controlSelector, toggleSelector, menuSelector, optionSelector, currentSelector, value, datasetKey) => {
    page.querySelectorAll(controlSelector).forEach((control) => {
      const toggle = control.querySelector(toggleSelector);
      const menu = control.querySelector(menuSelector);
      const current = control.querySelector(currentSelector);
      if (!(toggle instanceof HTMLButtonElement) || !menu) return;
      const options = Array.from(control.querySelectorAll(optionSelector));
      const activeOption = options.find((option) => option.dataset[datasetKey] === value) || options[0];
      options.forEach((option) => {
        const isActive = option === activeOption;
        option.classList.toggle("is-active", isActive);
        option.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      if (current && activeOption) current.textContent = activeOption.textContent || "";
      if (toggle.dataset.bound !== "true") {
        toggle.dataset.bound = "true";
        toggle.addEventListener("click", () => {
          const isOpen = control.dataset.sortOpen === "true";
          page.querySelectorAll("[data-shop-sort-control], [data-shop-filter-control]").forEach((item) => {
            item.dataset.sortOpen = "false";
            const itemMenu = item.querySelector("[data-shop-sort-menu], [data-shop-filter-menu]");
            const itemToggle = item.querySelector("[data-shop-sort-toggle], [data-shop-filter-toggle]");
            if (itemMenu) itemMenu.hidden = true;
            if (itemToggle) itemToggle.setAttribute("aria-expanded", "false");
          });
          control.dataset.sortOpen = isOpen ? "false" : "true";
          menu.hidden = isOpen;
          toggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
        });
      }
      options.forEach((option) => {
        if (option.dataset.bound === "true") return;
        option.dataset.bound = "true";
        option.addEventListener("click", () => {
          const selected = option.dataset[datasetKey] || value;
          if (datasetKey === "shopSortOption") page.dataset.shopSort = selected;
          if (datasetKey === "shopFilterOption") page.dataset.shopFilter = selected;
          control.dataset.sortOpen = "false";
          menu.hidden = true;
          toggle.setAttribute("aria-expanded", "false");
          renderShopPage();
        });
      });
    });
  };

  setupShopDropdown("[data-shop-filter-control]", "[data-shop-filter-toggle]", "[data-shop-filter-menu]", "[data-shop-filter-option]", "[data-shop-filter-current]", filterMode, "shopFilterOption");

  if (worksContainer) {
    const workItems = getShopWorkItems().filter((item) => (
      filterMode === "all" ? true : item.status === "available"
    ));
    renderShopGroups(
      worksContainer,
      workItems,
      (key) => getCategoryListLabel(key, getWorkDetailCategoryLabel({ category: "hanga" })),
      shopWorkCategoryOrder,
    );
  }

  if (goodsContainer) {
    renderShopGroups(goodsContainer, getShopGoodsItems(), getShopGoodsCategoryLabel, shopGoodsCategoryOrder);
  }
  applyShopItemOrientationClasses(page);
}

function renderFeatureImages() {
  const featureImages = document.querySelectorAll("[data-feature-image]");
  const featureImageLinks = document.querySelectorAll("[data-feature-image-link]");
  const featureDetailLinks = document.querySelectorAll("[data-feature-detail-link]");
  if ((!featureImages.length && !featureImageLinks.length && !featureDetailLinks.length) || !works.length) return;
  const selectedSection = document.querySelector('[data-gallery-id="top-selected"]');
  const selectedIds = String(selectedSection?.dataset.selectedWorks || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const selectedPool = selectedIds.length
    ? selectedIds.map((id) => works.find((work) => String(work?.id ?? "") === id)).filter((work) => work && (work.image || work.images?.[0]))
    : works.filter((work) => work && (work.image || work.images?.[0]));
  const active = shuffle(selectedPool)[0];
  if (!active) return;
  const featureImage = getWorkListImagePath(active.image || active.images?.[0] || "");
  const title = workText(active, "title");
  const href = getWorkDetailPagePath(active, null, "top-hero");
  featureImages.forEach((img) => {
    img.src = featureImage;
    img.alt = title || "";
  });
  featureImageLinks.forEach((link) => {
    link.href = href;
    link.dataset.workId = String(active.id ?? "");
    link.dataset.workPage = href;
    link.dataset.workSource = "top-hero";
    link.dataset.workDetailLink = "true";
    link.onclick = () => {
      rememberWorkListLocation(active.id, link);
    };
  });
  featureDetailLinks.forEach((link) => {
    link.href = href;
    link.dataset.workId = String(active.id ?? "");
    link.dataset.workPage = href;
    link.dataset.workSource = "top-hero";
    link.dataset.workDetailLink = "true";
    link.onclick = () => {
      rememberWorkListLocation(active.id, link);
    };
  });
}

function renderGallery() {
  const galleries = document.querySelectorAll("[data-gallery]");
  if (!galleries.length) return;
  const isFourPanelManga = (work) => {
    const sub = String(work.subcategory ?? "");
    if (sub) return /4koma|four|四コマ|4コマ/i.test(sub);
    const text = `${work.title ?? ""} ${work.technique ?? ""} ${work.caption ?? ""}`;
    return /4コマ|四コマ|４コマ|四齣/i.test(text);
  };
  galleries.forEach((gallery) => {
    if (gallery.dataset.galleryId !== "top-selected") {
      gallery.dataset.galleryLayout = "compact";
    }
    const category = gallery.dataset.gallery;
    const galleryId = gallery.dataset.galleryId || category;
    let list = [];

    if (category === "all") {
      list = works;
    } else if (category === "hanga-wood") {
      list = works.filter((work) => work.category === "hanga" && !isCopperTechnique(work.technique));
    } else if (category === "hanga-copper") {
      list = works.filter((work) => work.category === "hanga" && isCopperTechnique(work.technique));
    } else if (category === "manga-4koma") {
      list = works.filter((work) => work.category === "manga" && isFourPanelManga(work));
    } else if (category === "manga-story") {
      list = works.filter((work) => work.category === "manga" && !isFourPanelManga(work));
    } else if (category === "digital-illustration") {
      list = works.filter((work) => work.category === "digital" && work.subcategory !== "mini-chara");
    } else if (category === "digital-mini-chara") {
      list = works.filter((work) => work.category === "digital" && work.subcategory === "mini-chara");
    } else {
      list = works.filter((work) => work.category === category);
    }

    const selectedIds = String(gallery.dataset.selectedWorks || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (selectedIds.length) {
      const byId = new Map(list.map((work) => [String(work.id), work]));
      list = selectedIds.map((id) => byId.get(id)).filter(Boolean);
    }

    syncGalleryAvailability(gallery, galleryId, list.length > 0);
    if (!list.length) {
      gallery.innerHTML = "";
      galleryState.delete(galleryId);
      return;
    }

    const limit = Number.parseInt(gallery.dataset.limit || "", 10);
    const prev = galleryState.get(galleryId);
    const sortMode = selectedIds.length ? "selected" : getGallerySortMode(gallery, galleryId, prev);
    const arranged = selectedIds.length ? list : sortWorks(list, sortMode, category);
    const defaultCount = Number.isFinite(limit) && limit > 0 ? limit : arranged.length;
    const isLoadMore = gallery.dataset.loadMore === "true";
    const pageSize = Number.parseInt(gallery.dataset.pageSize || "", 10) || 12;
    const returnState = getReturnStateForGallery(galleryId);
    const stableList = isLoadMore && prev?.sortMode === sortMode && prev?.arranged?.length === arranged.length ? prev.arranged : arranged;
    let shownCount = isLoadMore
      ? Math.min(prev?.shownCount || defaultCount, stableList.length)
      : defaultCount;
    const totalPages = Math.max(1, Math.ceil(stableList.length / pageSize));
    let currentPage = isLoadMore
      ? 1
      : Math.min(Math.max(prev?.currentPage || 1, 1), totalPages);

    if (!prev && returnState) {
      if (isLoadMore && Number.isFinite(Number(returnState.shownCount))) {
        shownCount = Math.min(Math.max(Number(returnState.shownCount), defaultCount), stableList.length);
      } else if (Number.isFinite(Number(returnState.currentPage))) {
        currentPage = Math.min(Math.max(Number(returnState.currentPage), 1), totalPages);
      }
    }

    // If this page was opened from Selected Works, prioritize showing that work.
    if (pendingOpenWorkId) {
      const targetIndex = stableList.findIndex((work) => String(work.id) === pendingOpenWorkId);
      if (targetIndex >= 0) {
        if (isLoadMore) {
          shownCount = Math.max(shownCount, targetIndex + 1);
        } else {
          currentPage = Math.floor(targetIndex / pageSize) + 1;
        }
      }
    }
    const outputList = isLoadMore
      ? stableList.slice(0, shownCount)
      : stableList.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const compactRatio = outputList.reduce((minRatio, work) => {
      const ratio = getWorkRatio(work);
      return Number.isFinite(ratio) && ratio > 0 ? Math.min(minRatio, ratio) : minRatio;
    }, Infinity);
    if (galleryId !== "top-selected" && Number.isFinite(compactRatio) && compactRatio > 0) {
      gallery.style.setProperty("--compact-card-ratio", String(compactRatio));
    }
    const prevClicks = prev?.clicks || 0;
    galleryState.set(galleryId, {
      arranged: stableList,
      shownCount,
      step: defaultCount,
      clicks: prevClicks,
      pageSize,
      currentPage,
      totalPages,
      sortMode,
      revealFromIndex: prev?.revealFromIndex ?? null,
    });

    if (galleryId === "top-selected") {
      gallery.classList.add("top-selected-row");
      gallery.innerHTML = outputList.map((work) => {
        const firstImage = getWorkListImagePath(work.images?.[0] || work.image);
        const title = workText(work, "title");
        const orderedIds = stableList.map((item) => String(item?.id ?? "")).filter(Boolean);
        const detailPath = getWorkDetailPagePath(work, orderedIds, "top-selected");
        return `
      <article class="top-selected-item" data-work-id="${escapeHtml(work.id)}">
        <a class="top-selected-link js-work-link" href="${escapeHtml(detailPath)}" data-work-id="${escapeHtml(work.id)}" data-work-page="${escapeHtml(detailPath)}" data-work-source="top-selected" data-work-detail-link="true">
          <span class="top-selected-image-wrap">
            <img src="${escapeHtml(firstImage)}" alt="${escapeHtml(title)}" loading="lazy">
          </span>
          <span class="top-selected-title">${escapeHtml(title)}</span>
        </a>
      </article>
    `;
      }).join("");
      try {
        sessionStorage.setItem(
          "top-selected-work-ids",
          JSON.stringify(stableList.map((work) => String(work?.id ?? "")).filter(Boolean))
        );
      } catch (_) {
        // ignore storage failures
      }
      const currentState = galleryState.get(galleryId);
      if (currentState && Number.isFinite(currentState.revealFromIndex)) {
        const target = gallery.querySelector(`.top-selected-item:nth-child(${currentState.revealFromIndex + 1})`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
        }
        currentState.revealFromIndex = null;
        galleryState.set(galleryId, currentState);
      }
      removePaginationControls(gallery, galleryId);
      return;
    }

    const orderedIds = stableList.map((item) => String(item?.id ?? "")).filter(Boolean);
    if (category === "manga-4koma") {
      gallery.classList.add("gallery-grid-sectioned");
      gallery.innerHTML = groupMangaWorks(outputList).map((group) => `
        <div class="gallery-group-heading">
          <h2>${escapeHtml(getMangaGroupLabel(group.key))}</h2>
        </div>
        ${group.works.map((work) => renderGalleryWorkCard(work, orderedIds)).join("")}
      `).join("");
    } else {
      gallery.classList.remove("gallery-grid-sectioned");
      gallery.innerHTML = outputList.map((work) => renderGalleryWorkCard(work, orderedIds)).join("");
    }

    if (!isLoadMore && stableList.length > pageSize) {
      renderPaginationControls(gallery, galleryId, currentPage, totalPages);
    } else {
      removePaginationControls(gallery, galleryId);
    }
  });

  applyImageOrientationClasses();
  attachCaptionToggles();
  attachGalleryViewer();
  attachWorkDetailLinkMemory();
  attachLoadMoreHandlers();
  attachPaginationHandlers();
  attachGalleryLayoutControls();
  attachGallerySortControls();
  autoOpenWorkFromQuery();
  restoreWorkListLocation();
}

function autoOpenWorkFromQuery() {
  if (!pendingOpenEnabled || !pendingOpenWorkId) return;
  const link = document.querySelector(`.js-work-link[data-work-id="${CSS.escape(pendingOpenWorkId)}"]`);
  if (!link) return;
  const card = link.closest(".work, .top-selected-item");
  if (card) {
    card.scrollIntoView({ block: "center", behavior: "auto" });
  }
  pendingOpenEnabled = false;
  pendingOpenWorkId = null;
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function removePaginationControls(gallery, galleryId) {
  const existing = document.querySelector(`.gallery-pagination[data-pagination-for="${galleryId}"]`);
  if (existing) existing.remove();
}

function renderPaginationControls(gallery, galleryId, currentPage, totalPages) {
  removePaginationControls(gallery, galleryId);
  const nav = document.createElement("nav");
  nav.className = "gallery-pagination";
  nav.dataset.paginationFor = galleryId;
  nav.setAttribute("aria-label", "pagination");
  nav.innerHTML = Array.from({ length: totalPages }, (_, i) => {
    const page = i + 1;
    const isActive = page === currentPage;
    return `<button class="page-dot${isActive ? " is-active" : ""}" type="button" data-page-for="${escapeHtml(galleryId)}" data-page="${page}">${page}</button>`;
  }).join("");
  gallery.insertAdjacentElement("afterend", nav);
}

function attachPaginationHandlers() {
  const pagers = document.querySelectorAll(".gallery-pagination");
  pagers.forEach((pager) => {
    if (pager.dataset.bound === "true") return;
    pager.dataset.bound = "true";
    pager.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-page-for][data-page]");
      if (!button) return;
      const galleryId = button.dataset.pageFor;
      const page = Number.parseInt(button.dataset.page || "", 10);
      if (!galleryId || !Number.isFinite(page) || page < 1) return;
      const state = galleryState.get(galleryId);
      if (!state) return;
      state.currentPage = Math.min(page, state.totalPages || page);
      galleryState.set(galleryId, state);
      renderGallery();
      const targetGallery = document.querySelector(
        `[data-gallery-id="${CSS.escape(galleryId)}"], [data-gallery="${CSS.escape(galleryId)}"]`
      );
      if (targetGallery) {
        targetGallery.scrollIntoView({ block: "start", behavior: "auto" });
      }
    });
  });
}

function attachGallerySortControls() {
  const controls = document.querySelectorAll("[data-gallery-sort-for]");
  const closeTimers = new WeakMap();
  const finishClose = (control, immediate = false) => {
    const button = control.querySelector("[data-gallery-sort-toggle]");
    const menu = control.querySelector("[data-gallery-sort-menu]");
    if (!button || !menu) return;
    const isOpen = control.dataset.sortOpen === "true";
    const isClosing = control.dataset.sortClosing === "true";
    if (!isOpen && !isClosing) return;
    const timer = closeTimers.get(control);
    if (timer) {
      window.clearTimeout(timer);
      closeTimers.delete(control);
    }
    control.dataset.sortOpen = "false";
    control.dataset.sortClosing = immediate ? "false" : "true";
    button.setAttribute("aria-expanded", "false");
    if (immediate) {
      control.dataset.sortClosing = "false";
      menu.hidden = true;
      return;
    }
    if (menu.hidden) {
      control.dataset.sortClosing = "false";
      return;
    }
    const closeTimer = window.setTimeout(() => {
      menu.hidden = true;
      control.dataset.sortClosing = "false";
      closeTimers.delete(control);
    }, 180);
    closeTimers.set(control, closeTimer);
  };
  const closeAll = (except = null) => {
    controls.forEach((control) => {
      if (except && control === except) return;
      finishClose(control);
    });
  };

  controls.forEach((control) => {
    const galleryId = control.dataset.gallerySortFor || "";
    const state = galleryState.get(galleryId);
    const activeSort = state?.sortMode || "year";
    const button = control.querySelector("[data-gallery-sort-toggle]");
    const menu = control.querySelector("[data-gallery-sort-menu]");
    const current = control.querySelector("[data-gallery-sort-current]");
    if (!button || !menu || !current) return;

    current.textContent = getGallerySortLabel(activeSort);
    const label = `${uiT("label_gallery_sort", "表示順")} ${getGallerySortLabel(activeSort)}`;
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    menu.querySelectorAll("[data-gallery-sort-option]").forEach((option) => {
      const optionMode = option.dataset.gallerySortOption || "";
      const isActive = optionMode === activeSort;
      option.classList.toggle("is-active", isActive);
      option.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (button.dataset.bound !== "true") {
      button.dataset.bound = "true";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = control.dataset.sortOpen === "true";
        if (isOpen) {
          finishClose(control);
          return;
        }
        closeAll(control);
        control.dataset.sortOpen = "true";
        control.dataset.sortClosing = "false";
        button.setAttribute("aria-expanded", "true");
        const timer = closeTimers.get(control);
        if (timer) {
          window.clearTimeout(timer);
          closeTimers.delete(control);
        }
        menu.hidden = false;
      });
    }

    if (menu.dataset.bound !== "true") {
      menu.dataset.bound = "true";
      menu.addEventListener("click", (event) => {
        const option = event.target.closest("[data-gallery-sort-option]");
        if (!option) return;
        const sortMode = option.dataset.gallerySortOption || "year";
        const latest = galleryState.get(galleryId) || {};
        if ((latest.sortMode || "year") === sortMode) {
          closeAll();
          return;
        }
        const scrollY = window.scrollY || 0;
        galleryState.set(galleryId, {
          ...latest,
          sortMode,
          currentPage: 1,
          revealFromIndex: null,
        });
        closeAll();
        renderGallery();
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: scrollY, behavior: "auto" });
        });
      });
    }
  });

  if (document.body.dataset.gallerySortBound !== "true") {
    document.body.dataset.gallerySortBound = "true";
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-gallery-sort-for]")) return;
      closeAll();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      controls.forEach((control) => finishClose(control, true));
    });
  }
}

function attachGalleryLayoutControls() {
  const main = document.querySelector("main");
  if (!main) return;
  const galleries = Array.from(main.querySelectorAll(".gallery-grid[data-gallery]"));
  if (!galleries.length) return;
  galleries.forEach((gallery) => {
    if (gallery.dataset.galleryId === "top-selected") return;
    gallery.dataset.galleryLayout = "compact";
  });
}

function applyImageOrientationClasses() {
  const images = document.querySelectorAll(".work img");
  images.forEach((img) => {
    const setClass = () => {
      const work = img.closest(".work");
      if (!work) return;
      const naturalWidth = Number(img.naturalWidth) || 0;
      const naturalHeight = Number(img.naturalHeight) || 0;
      if (naturalWidth > 0 && naturalHeight > 0) {
        const imageRatio = naturalWidth / naturalHeight;
        const frameRatio = Math.min(2, Math.max(0.62, imageRatio));
        work.style.setProperty("--work-image-ratio", String(imageRatio));
        work.style.setProperty("--work-frame-ratio", String(frameRatio));
        work.classList.toggle("is-extreme-portrait", imageRatio < 0.42);
        work.classList.toggle("is-extreme-landscape", imageRatio > 2.4);
        work.classList.toggle("is-wide-landscape", imageRatio > 1.2);
      }
      work.classList.remove("is-portrait", "is-landscape");
      if (img.naturalHeight > img.naturalWidth) {
        work.classList.add("is-portrait");
      } else {
        work.classList.add("is-landscape");
      }
    };

    if (img.complete) {
      setClass();
    } else {
      img.addEventListener("load", setClass, { once: true });
    }
  });
}

function attachWorkDetailLinkMemory() {
  const links = document.querySelectorAll('[data-work-detail-link="true"][data-work-id]');
  links.forEach((link) => {
    if (link.dataset.returnBound === "true") return;
    link.dataset.returnBound = "true";
    link.addEventListener("click", () => {
      rememberWorkListLocation(link.dataset.workId || "", link);
    });
  });
}

function attachGalleryViewer() {
  const map = new Map(works.map((work) => [String(work.id), work]));
  const links = document.querySelectorAll('.js-work-link[data-work-id]:not([data-work-detail-link="true"])');
  if (!links.length) return;

  let viewer = document.querySelector(".image-viewer");
  if (viewer?.__openWork) {
    links.forEach((link) => {
      if (link.dataset.viewerBound === "true") return;
      link.dataset.viewerBound = "true";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const work = map.get(link.dataset.workId);
        if (!work) return;
        viewer.__openWork(work, link);
      });
    });
    return;
  }
  const isNewViewer = !viewer;
  if (!viewer) {
    viewer = document.createElement("div");
    viewer.className = "image-viewer";
    viewer.innerHTML = `
      <button class="viewer-close" type="button" aria-label="close">×</button>
      <button class="viewer-detail" type="button" hidden>${uiT("viewer_detail", "詳細を見る")}</button>
      <button class="viewer-prev" type="button" aria-label="previous">‹</button>
      <img class="viewer-image" alt="">
      <div class="viewer-loading">${uiT("loading_updating", "更新中")}</div>
      <button class="viewer-next" type="button" aria-label="next">›</button>
      <div class="viewer-meta"></div>
    `;
    document.body.appendChild(viewer);
  }

  const image = viewer.querySelector(".viewer-image");
  const meta = viewer.querySelector(".viewer-meta");
  const loading = viewer.querySelector(".viewer-loading");
  const detailBtn = viewer.querySelector(".viewer-detail");
  let loadingTimer = null;
  const closeBtn = viewer.querySelector(".viewer-close");
  const prevBtn = viewer.querySelector(".viewer-prev");
  const nextBtn = viewer.querySelector(".viewer-next");
  let currentImages = [];
  let currentTitle = "";
  let index = 0;
  let isZoomed = false;
  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let pointerDown = false;
  let hasMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panStartX = 0;
  let panStartY = 0;
  let swipePointerId = null;
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeMoved = false;
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  const touchPointers = new Map();
  let isPinching = false;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let currentWorkId = "";
  let currentWorkPage = "";
  const savedViewerState = viewer.__viewerState;
  if (savedViewerState && Array.isArray(savedViewerState.currentImages)) {
    currentImages = savedViewerState.currentImages;
    currentTitle = savedViewerState.currentTitle || "";
    index = Number.isFinite(savedViewerState.index) ? savedViewerState.index : 0;
  }

  const applyImageTransform = () => {
    const tx = Math.round(panX);
    const ty = Math.round(panY);
    image.style.transform = isZoomed
      ? `translate(${tx}px, ${ty}px) scale(${zoomScale})`
      : "";
  };

  const clampZoomScale = (scale) => Math.min(4, Math.max(1, scale));

  const setZoom = (zoomed, scale = 2.5) => {
    zoomScale = zoomed ? clampZoomScale(scale) : 1;
    isZoomed = zoomScale > 1.01;
    if (!isZoomed) {
      panX = 0;
      panY = 0;
      isPanning = false;
      isPinching = false;
      image.classList.remove("is-pinching");
    }
    image.classList.toggle("is-zoomed", isZoomed);
    image.classList.toggle("is-panning", isPanning && isZoomed);
    if (closeBtn) closeBtn.hidden = isZoomed;
    applyImageTransform();
  };

  const trackTouchPointer = (event) => {
    if (event.pointerType !== "touch") return false;
    touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPointers.size === 2) {
      const points = Array.from(touchPointers.values());
      pinchStartDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      pinchStartScale = zoomScale;
      isPinching = pinchStartDistance > 0;
      image.classList.toggle("is-pinching", isPinching);
      pointerDown = false;
      isPanning = false;
      image.classList.remove("is-panning");
      return true;
    }
    return isPinching;
  };

  const releaseTouchPointer = (event) => {
    if (event.pointerType !== "touch") return false;
    touchPointers.delete(event.pointerId);
    if (isPinching && touchPointers.size < 2) {
      isPinching = false;
      image.classList.remove("is-pinching");
      if (zoomScale <= 1.01) setZoom(false);
      return true;
    }
    return false;
  };

  const draw = () => {
    if (!currentImages.length) return;
    setZoom(false);
    if (loading) {
      loading.textContent = uiT("loading_updating", "更新中");
      loading.classList.remove("is-visible");
    }
    if (loadingTimer) window.clearTimeout(loadingTimer);
    loadingTimer = window.setTimeout(() => {
      if (loading) loading.classList.add("is-visible");
    }, 500);
    image.src = currentImages[index];
    image.alt = currentTitle;
    meta.textContent = `${currentTitle}  ${index + 1}/${currentImages.length}`;
    viewer.__viewerState = { currentImages: [...currentImages], currentTitle, index };
  };
  const open = () => {
    setZoom(false);
    viewer.classList.add("is-open");
    document.body.classList.add("viewer-open");
    document.body.style.overflow = "hidden";
    draw();
  };
  const close = () => {
    setZoom(false);
    viewer.classList.remove("is-open");
    document.body.classList.remove("viewer-open");
    document.body.style.overflow = "";
    if (currentWorkId) {
      const activeLink = document.querySelector(`.js-work-link[data-work-id="${CSS.escape(currentWorkId)}"]`);
      const card = activeLink?.closest(".work, .top-selected-item");
      if (card) {
        card.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  };
  const next = () => {
    if (!currentImages.length) return;
    index = (index + 1) % currentImages.length;
    draw();
  };
  const prev = () => {
    if (!currentImages.length) return;
    index = (index - 1 + currentImages.length) % currentImages.length;
    draw();
  };

  const openWork = (work, link) => {
    currentWorkId = String(work.id ?? "");
    currentWorkPage = link.dataset.workPage || getVersionedWorkPagePath(work);
    currentImages = work.images?.length ? work.images : [work.image];
    currentTitle = workText(work, "title") || "";
    index = 0;
    viewer.classList.toggle("is-mini-chara", work.subcategory === "mini-chara");
    const layout = link.closest(".gallery-grid[data-gallery]")?.dataset.galleryLayout || "";
    if (detailBtn) {
      const workSource = link.dataset.workSource || "";
      const isTopContext = workSource === "top-selected" || workSource === "top-hero";
      detailBtn.hidden = layout !== "compact" && !isTopContext;
      detailBtn.textContent = uiT("viewer_detail", "詳細を見る");
    }
    viewer.__viewerState = { currentImages: [...currentImages], currentTitle, index };
    open();
  };
  viewer.__openWork = openWork;

  links.forEach((link) => {
    if (link.dataset.viewerBound === "true") return;
    link.dataset.viewerBound = "true";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const work = map.get(link.dataset.workId);
      if (!work) return;
      openWork(work, link);
    });
  });

  if (detailBtn) {
    detailBtn.addEventListener("click", () => {
      if (!currentWorkId || !currentWorkPage) return;
      window.location.href = currentWorkPage;
    });
  }

  image.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setZoom(!isZoomed, 2.5);
  });
  image.addEventListener("click", (event) => {
    if (hasMoved) {
      hasMoved = false;
      return;
    }
    if (isZoomed) return;
    event.preventDefault();
    event.stopPropagation();
    setZoom(true);
  });
  image.addEventListener("pointerdown", (event) => {
    if (trackTouchPointer(event)) return;
    if (!isZoomed || isPinching) return;
    event.preventDefault();
    event.stopPropagation();
    pointerDown = true;
    hasMoved = false;
    isPanning = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    panStartX = panX;
    panStartY = panY;
    image.setPointerCapture(event.pointerId);
  });
  image.addEventListener("pointermove", (event) => {
    if (!pointerDown || !isZoomed || isPinching) return;
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      hasMoved = true;
      isPanning = true;
      image.classList.add("is-panning");
    }
    if (!hasMoved) return;
    panX = panStartX + dx;
    panY = panStartY + dy;
    applyImageTransform();
  });
  image.addEventListener("pointerup", (event) => {
    releaseTouchPointer(event);
    if (!pointerDown) return;
    if (image.hasPointerCapture(event.pointerId)) {
      image.releasePointerCapture(event.pointerId);
    }
    pointerDown = false;
    isPanning = false;
    image.classList.remove("is-panning");
  });
  image.addEventListener("pointercancel", (event) => {
    releaseTouchPointer(event);
    pointerDown = false;
    isPanning = false;
    hasMoved = false;
    image.classList.remove("is-panning");
  });
  viewer.addEventListener("pointerdown", (event) => {
    if (trackTouchPointer(event)) return;
    if (isPinching) return;
    if (isZoomed || event.pointerType !== "touch") return;
    if (event.target.closest("button")) return;
    swipePointerId = event.pointerId;
    swipeStartX = event.clientX;
    swipeStartY = event.clientY;
    swipeMoved = false;
    if (viewer.setPointerCapture) viewer.setPointerCapture(event.pointerId);
  });
  viewer.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" && touchPointers.has(event.pointerId)) {
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (isPinching && touchPointers.size >= 2) {
        const points = Array.from(touchPointers.values()).slice(0, 2);
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (pinchStartDistance > 0) {
          zoomScale = clampZoomScale(pinchStartScale * (distance / pinchStartDistance));
          isZoomed = zoomScale > 1.01;
          if (!isZoomed) {
            panX = 0;
            panY = 0;
          }
          image.classList.toggle("is-zoomed", isZoomed);
          if (closeBtn) closeBtn.hidden = isZoomed;
          applyImageTransform();
        }
        return;
      }
    }
    if (swipePointerId !== event.pointerId || isZoomed) return;
    const dx = event.clientX - swipeStartX;
    const dy = event.clientY - swipeStartY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) swipeMoved = true;
  });
  viewer.addEventListener("pointerup", (event) => {
    if (event.pointerType === "touch") {
      if (releaseTouchPointer(event)) {
        swipePointerId = null;
        swipeMoved = false;
        hasMoved = true;
        return;
      }
      const now = Date.now();
      const tapDistance = Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY);
      if (!swipeMoved && now - lastTapTime < 300 && tapDistance < 32) {
        if (isZoomed) setZoom(false);
        else setZoom(true, 2.5);
        hasMoved = true;
        lastTapTime = 0;
        return;
      }
      if (!swipeMoved) {
        lastTapTime = now;
        lastTapX = event.clientX;
        lastTapY = event.clientY;
      }
    }
    if (swipePointerId !== event.pointerId) return;
    if (viewer.hasPointerCapture?.(event.pointerId)) {
      viewer.releasePointerCapture(event.pointerId);
    }
    const dx = event.clientX - swipeStartX;
    const dy = event.clientY - swipeStartY;
    const isHorizontalSwipe = Math.abs(dx) > 54 && Math.abs(dx) > Math.abs(dy) * 1.35;
    if (swipeMoved && isHorizontalSwipe && currentImages.length > 1) {
      hasMoved = true;
      if (dx < 0) next();
      else prev();
    }
    swipePointerId = null;
    swipeMoved = false;
  });
  viewer.addEventListener("pointercancel", (event) => {
    releaseTouchPointer(event);
    if (swipePointerId !== event.pointerId) return;
    swipePointerId = null;
    swipeMoved = false;
  });
  image.addEventListener("load", () => {
    if (loadingTimer) window.clearTimeout(loadingTimer);
    if (loading) loading.classList.remove("is-visible");
  });
  image.addEventListener("error", () => {
    if (loadingTimer) window.clearTimeout(loadingTimer);
    if (loading) loading.classList.add("is-visible");
    if (loading) loading.textContent = uiT("loading_failed", "読み込み失敗");
  });
  nextBtn.onclick = next;
  prevBtn.onclick = prev;
  closeBtn.onclick = close;
  viewer.addEventListener("click", (event) => {
    if (event.target !== viewer) return;
    if (isZoomed) {
      setZoom(false);
      return;
    }
    close();
  });
  viewer.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (event.deltaY > 0) next();
    else prev();
  }, { passive: false });
  if (isNewViewer) {
    window.addEventListener("keydown", (event) => {
      if (!viewer.classList.contains("is-open")) return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") prev();
    });
  }
}

function attachLoadMoreHandlers() {
  const buttons = document.querySelectorAll("[data-load-more-for]");
  buttons.forEach((button) => {
    const galleryId = button.dataset.loadMoreFor;
    const state = galleryState.get(galleryId);
    const categoryActions = document.querySelector("[data-after-all-categories]");
    if (!state) {
      button.style.display = "none";
      if (categoryActions) categoryActions.hidden = true;
      return;
    }
    const completed = state.shownCount >= state.arranged.length;
    button.style.display = completed ? "none" : "";
    if (categoryActions) categoryActions.hidden = !topCategoryButtonsVisible;
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const latest = galleryState.get(galleryId);
      if (!latest) return;
      latest.clicks = (latest.clicks || 0) + 1;
      if (latest.clicks >= 2) topCategoryButtonsVisible = true;
      const prevShownCount = latest.shownCount;
      latest.shownCount = Math.min(latest.shownCount + latest.step, latest.arranged.length);
      latest.revealFromIndex = latest.shownCount > prevShownCount ? prevShownCount : null;
      galleryState.set(galleryId, latest);
      renderGallery();
    });
  });
}

function attachCaptionToggles() {
  const captions = document.querySelectorAll(".caption");
  captions.forEach((caption) => {
    const text = caption.querySelector(".caption-text");
    const button = caption.querySelector(".caption-toggle");
    if (!text || !button) return;

    const compactThreshold = 80;
    const isLong = text.scrollHeight > text.clientHeight + 4 || text.textContent.length > compactThreshold;
    if (!isLong) {
      button.hidden = true;
      text.classList.remove("is-collapsed");
      text.classList.remove("is-collapsed-mobile-standard");
      return;
    }

    text.classList.add("is-collapsed");
      text.classList.add("is-collapsed-mobile-standard");
    button.hidden = false;
    button.textContent = uiT("caption_more", "続きを読む");

    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const expanded = text.classList.toggle("is-collapsed");
      if (expanded) {
        text.classList.add("is-collapsed-mobile-standard");
      } else {
        text.classList.remove("is-collapsed-mobile-standard");
      }
      button.textContent = expanded
        ? uiT("caption_more", "続きを読む")
        : uiT("caption_less", "閉じる");
    });
  });
}

function attachImageProtection() {
  document.addEventListener("contextmenu", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".work-image-link img, .work-detail-main-image, .work-detail-thumb img, .viewer-image")) {
      event.preventDefault();
    }
  });

  document.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".work-image-link img, .work-detail-main-image, .work-detail-thumb img, .viewer-image")) {
      event.preventDefault();
    }
  });
}

function attachBackToTopButtons() {
  const buttons = document.querySelectorAll("[data-back-to-top]");
  buttons.forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function getMailchimpJsonpUrl(action, email, callbackName) {
  const rawAction = String(action ?? "").trim().replace(/&amp;/g, "&");
  if (!rawAction) return "";
  const jsonpAction = rawAction.includes("/post-json")
    ? rawAction
    : rawAction.replace("/post?", "/post-json?");
  if (!jsonpAction.includes("/post-json")) return "";
  try {
    const url = new URL(jsonpAction);
    url.searchParams.set("EMAIL", email);
    url.searchParams.set("c", callbackName);
    return url.toString();
  } catch (_) {
    return "";
  }
}

function requestMailchimpSubscribe(action, email) {
  return new Promise((resolve, reject) => {
    const callbackName = `mailchimpCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let script = null;
    let finished = false;
    const cleanup = () => {
      finished = true;
      if (script) script.remove();
      try {
        delete window[callbackName];
      } catch (_) {
        window[callbackName] = undefined;
      }
    };
    const timeout = window.setTimeout(() => {
      if (finished) return;
      cleanup();
      reject(new Error("timeout"));
    }, 10000);

    window[callbackName] = (response) => {
      if (finished) return;
      window.clearTimeout(timeout);
      cleanup();
      if (response?.result === "success") {
        resolve(response);
        return;
      }
      const error = new Error(response?.msg || "mailchimp_error");
      error.name = "MailchimpResponseError";
      reject(error);
    };

    const url = getMailchimpJsonpUrl(action, email, callbackName);
    if (!url) {
      window.clearTimeout(timeout);
      cleanup();
      reject(new Error("missing_mailchimp_action"));
      return;
    }

    script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onerror = () => {
      if (finished) return;
      window.clearTimeout(timeout);
      cleanup();
      reject(new Error("network_error"));
    };
    document.body.appendChild(script);
  });
}

function setupNewsletterSignup() {
  const forms = document.querySelectorAll("[data-mailchimp-form]");
  forms.forEach((form) => {
    if (!(form instanceof HTMLFormElement) || form.dataset.bound === "true") return;
    form.dataset.bound = "true";
    const input = form.querySelector('input[name="EMAIL"]');
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector("[data-newsletter-status]");
    const setStatus = (key, fallback, type = "") => {
      if (!status) return;
      status.textContent = uiT(key, fallback);
      status.classList.toggle("is-success", type === "success");
      status.classList.toggle("is-error", type === "error");
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!(input instanceof HTMLInputElement)) return;
      const email = input.value.trim();
      if (!email || !input.checkValidity()) {
        setStatus("newsletter_invalid", "メールアドレスを確認してください。", "error");
        return;
      }

      if (button instanceof HTMLButtonElement) button.disabled = true;
      setStatus("", "", "");
      try {
        await requestMailchimpSubscribe(form.dataset.mailchimpAction || form.action, email);
        form.reset();
        setStatus("newsletter_success", "登録ありがとうございます。", "success");
      } catch (error) {
        const key = error?.name === "MailchimpResponseError" ? "newsletter_invalid" : "newsletter_error";
        const fallback = key === "newsletter_invalid"
          ? "メールアドレスを確認してください。"
          : "登録できませんでした。時間をおいて再度お試しください。";
        setStatus(key, fallback, "error");
      } finally {
        if (button instanceof HTMLButtonElement) button.disabled = false;
      }
    });
  });
}

window.renderWorkDetailPage = renderWorkDetailPage;
window.renderAboutPage = renderAboutPage;
window.setupCopyEmailButtons = setupCopyEmailButtons;
window.renderFeatureImages = renderFeatureImages;
window.renderGallery = renderGallery;
window.renderShopPage = renderShopPage;
window.attachWorkDetailThumbnailControls = attachWorkDetailThumbnailControls;

function runStartupStep(step) {
  try {
    step();
  } catch (error) {
    console.error("Site startup step failed:", error);
  }
}

function initializeSite() {
  [
    normalizeInternalPageLinks,
    setupMobileMenu,
    setupWorkDetailBackLink,
    attachImageProtection,
    renderWorkDetailPage,
    attachWorkDetailThumbnailControls,
    renderFeatureImages,
    renderGallery,
    renderShopPage,
    setupNewsletterSignup,
    attachBackToTopButtons,
  ].forEach(runStartupStep);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSite, { once: true });
} else {
  initializeSite();
}
