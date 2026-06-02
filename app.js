function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function withFallback(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function uiT(key, fallback) {
  let lang = "ja";
  try {
    lang = localStorage.getItem("site-lang") || "ja";
  } catch (_) {
    lang = "ja";
  }
  const dict = window.I18N?.[lang] || window.I18N?.ja || {};
  return dict[key] || fallback;
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
    "profile",
    "shop",
  ];
  const path = window.location.pathname;
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
  const base = detectSiteBasePath();
  const links = document.querySelectorAll('a[href$=".html"]');
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) return;
    const page = href.split("/").pop();
    if (!page) return;
    link.setAttribute("href", `${base}${page}`);
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
let pendingLayout = null;

try {
  const params = new URLSearchParams(window.location.search);
  const workId = params.get("work");
  pendingOpenWorkId = workId ? String(workId) : null;
  pendingOpenEnabled = params.get("open") === "1";
  const layout = params.get("layout");
  pendingLayout = ["compact", "standard", "large"].includes(layout || "") ? layout : null;
} catch (_) {
  pendingOpenWorkId = null;
  pendingOpenEnabled = false;
  pendingLayout = null;
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
  return Math.max(...nums.map(Number));
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

function renderFeatureImages() {
  const featureImages = document.querySelectorAll("[data-feature-image]");
  if (!featureImages.length || !works.length) return;
  const featureCaption = document.querySelector("[data-feature-caption]");

  const isCopperTechnique = (technique) => /エッチング|ドライポイント|アクアチント|銅版/.test(String(technique ?? ""));
  const woodLargePool = works.filter((work) => {
    if (work.category !== "hanga") return false;
    if (isCopperTechnique(work.technique)) return false;
    const { width, height } = parseSizeInfo(work.size);
    return Number(width) > 1000 || Number(height) > 1000;
  });

  const targetCount = 5;
  const minLargeWoodCount = 2;
  const largeWoodSelected = shuffle(woodLargePool).slice(0, Math.min(minLargeWoodCount, woodLargePool.length));
  const selectedIds = new Set(largeWoodSelected.map((work) => String(work.id)));
  const otherPool = works.filter((work) => {
    if (!work?.image) return false;
    return !selectedIds.has(String(work.id));
  });
  const othersSelected = shuffle(otherPool).slice(0, Math.max(0, targetCount - largeWoodSelected.length));
  const featured = shuffle([...largeWoodSelected, ...othersSelected]).slice(0, targetCount).map((work) => ({
    work,
    featureImage: work.image || work.images?.[0] || "",
  }));
  if (!featured.length) return;
  let activeIndex = 0;
  const setFeatured = () => {
    const active = featured[activeIndex % featured.length];
    featureImages.forEach((img) => {
      img.src = active.featureImage;
      img.alt = `${active.work.title} (${categories[active.work.category]})`;
      img.classList.add("js-work-link");
      img.dataset.workId = String(active.work.id ?? "");
      img.dataset.workPage = getWorkPagePath(active.work);
      img.dataset.workSource = "top-hero";
    });
    if (featureCaption) {
      featureCaption.textContent = `${active.work.title}｜${withFallback(active.work.year)}`;
    }
    activeIndex += 1;
  };

  setFeatured();
  if (featured.length >= 2) {
    if (window.__featureIntervalId) window.clearInterval(window.__featureIntervalId);
    window.__featureIntervalId = window.setInterval(setFeatured, 3000);
  }
}

function renderGallery() {
  const galleries = document.querySelectorAll("[data-gallery]");
  if (!galleries.length) return;

  const isCopperTechnique = (technique) => {
    const text = String(technique ?? "");
    return /エッチング|ドライポイント|アクアチント|銅版/.test(text);
  };
  const isFourPanelManga = (work) => {
    const sub = String(work.subcategory ?? "");
    if (sub) return /4koma|four|四コマ|4コマ/i.test(sub);
    const text = `${work.title ?? ""} ${work.technique ?? ""} ${work.caption ?? ""}`;
    return /4コマ|四コマ|４コマ|四齣/i.test(text);
  };
  galleries.forEach((gallery) => {
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

    const sortMode = gallery.dataset.sort;
    const arranged = sortMode === "recent"
      ? [...list].sort((a, b) => {
        if (category === "digital-mini-chara") {
          const catDiff = getMiniCharaCatPriority(b) - getMiniCharaCatPriority(a);
          if (catDiff) return catDiff;
        }
        const yearDiff = getYearScore(b.year) - getYearScore(a.year);
        if (yearDiff) return yearDiff;
        return getIdScore(b.id) - getIdScore(a.id);
      })
      : sortMode === "random"
        ? shuffle(list)
        : arrangeBySimilarity(list);
    const limit = Number.parseInt(gallery.dataset.limit || "", 10);
    const defaultCount = Number.isFinite(limit) && limit > 0 ? limit : arranged.length;
    const isLoadMore = gallery.dataset.loadMore === "true";
    const pageSize = Number.parseInt(gallery.dataset.pageSize || "", 10) || 12;
    const prev = galleryState.get(galleryId);
    const stableList = isLoadMore && prev?.arranged?.length === arranged.length ? prev.arranged : arranged;
    let shownCount = isLoadMore
      ? Math.min(prev?.shownCount || defaultCount, stableList.length)
      : defaultCount;
    const totalPages = Math.max(1, Math.ceil(stableList.length / pageSize));
    let currentPage = isLoadMore
      ? 1
      : Math.min(Math.max(prev?.currentPage || 1, 1), totalPages);

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
    const prevClicks = prev?.clicks || 0;
    galleryState.set(galleryId, {
      arranged: stableList,
      shownCount,
      step: defaultCount,
      clicks: prevClicks,
      pageSize,
      currentPage,
      totalPages,
      revealFromIndex: prev?.revealFromIndex ?? null,
    });

    if (galleryId === "top-selected") {
      gallery.classList.add("top-selected-row");
      gallery.innerHTML = outputList.map((work) => {
        const firstImage = work.images?.[0] || work.image;
        return `
      <article class="top-selected-item" data-work-id="${escapeHtml(work.id)}">
          <a class="top-selected-link js-work-link" href="${escapeHtml(firstImage)}" data-work-id="${escapeHtml(work.id)}" data-work-page="${escapeHtml(getWorkPagePath(work))}" data-work-source="top-selected">
          <span class="top-selected-image-wrap">
            <img src="${escapeHtml(firstImage)}" alt="${escapeHtml(work.title)}" loading="lazy">
          </span>
          <span class="top-selected-title">${escapeHtml(work.title)}</span>
        </a>
      </article>
    `;
      }).join("");
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

    gallery.innerHTML = outputList.map((work) => {
      const firstImage = work.images?.[0] || work.image;
      return `
      <article class="${getWorkCardClass(work)}" data-work-id="${escapeHtml(work.id)}">
        <a class="work-image-link js-work-link" href="${escapeHtml(firstImage)}" data-work-id="${escapeHtml(work.id)}" data-work-page="${escapeHtml(getWorkPagePath(work))}">
          <img src="${escapeHtml(firstImage)}" alt="${escapeHtml(work.title)}" loading="lazy">
        </a>
        <div class="caption">
          <h3 class="caption-title">${escapeHtml(work.title)}</h3>
          <div class="caption-meta-list">
            <p class="caption-meta"><span>${escapeHtml(uiT("cap_year", "制作年"))}</span><span>${escapeHtml(withFallback(work.year))}</span></p>
            <p class="caption-meta"><span>${escapeHtml(uiT("cap_technique", "技法"))}</span><span>${escapeHtml(withFallback(work.technique))}</span></p>
            <p class="caption-meta"><span>${escapeHtml(uiT("cap_size", "サイズ"))}</span><span>${escapeHtml(withFallback(work.size))}</span></p>
          </div>
          <p class="caption-text">${escapeHtml(withFallback(work.caption))}</p>
          <button class="caption-toggle" type="button" hidden>${escapeHtml(uiT("caption_more", "続きを読む"))}</button>
        </div>
      </article>
    `;
    }).join("");

    if (!isLoadMore && stableList.length > pageSize) {
      renderPaginationControls(gallery, galleryId, currentPage, totalPages);
    } else {
      removePaginationControls(gallery, galleryId);
    }
  });

  applyImageOrientationClasses();
  attachCaptionToggles();
  attachGalleryViewer();
  attachLoadMoreHandlers();
  attachPaginationHandlers();
  attachGalleryLayoutControls();
  autoOpenWorkFromQuery();
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

function attachGalleryLayoutControls() {
  const buttons = document.querySelectorAll("button[data-gallery-layout]");
  if (!buttons.length) return;
  const main = document.querySelector("main");
  if (!main) return;
  const galleries = Array.from(main.querySelectorAll(".gallery-grid[data-gallery]"));
  if (!galleries.length) return;
  const isMobile = window.matchMedia("(max-width: 760px)").matches;

  if (isMobile) {
    buttons.forEach((btn) => {
      if (btn.dataset.galleryLayout === "large") {
        btn.textContent = uiT("mini_chara_layout_standard", "標準");
        btn.setAttribute("aria-label", uiT("mini_chara_layout_standard", "標準"));
        btn.title = uiT("mini_chara_layout_standard", "標準");
      } else if (btn.dataset.galleryLayout === "compact") {
        btn.setAttribute("aria-label", uiT("mini_chara_layout_compact", "一覧"));
        btn.title = uiT("mini_chara_layout_compact", "一覧");
      }
    });
  }

  const applyLayout = (layout) => {
    let next = ["compact", "standard", "large"].includes(layout) ? layout : "compact";
    if (isMobile && next === "standard") next = "large";
    galleries.forEach((gallery) => {
      gallery.dataset.galleryLayout = next;
    });
    buttons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.galleryLayout === next);
    });
  };

  const initialLayout = pendingLayout || galleries[0].dataset.galleryLayout || "large";
  applyLayout(initialLayout);
  pendingLayout = null;
  buttons.forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      applyLayout(button.dataset.galleryLayout || "large");
    });
  });
}

function applyImageOrientationClasses() {
  const images = document.querySelectorAll(".work img");
  images.forEach((img) => {
    const setClass = () => {
      const work = img.closest(".work");
      if (!work) return;
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

function attachGalleryViewer() {
  const map = new Map(works.map((work) => [String(work.id), work]));
  const links = document.querySelectorAll(".js-work-link[data-work-id]");
  if (!links.length) return;

  let viewer = document.querySelector(".image-viewer");
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
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let pointerDown = false;
  let hasMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panStartX = 0;
  let panStartY = 0;
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
      ? `translate(${tx}px, ${ty}px) scale(2.5)`
      : "";
  };

  const setZoom = (zoomed) => {
    isZoomed = zoomed;
    if (!isZoomed) {
      panX = 0;
      panY = 0;
      isPanning = false;
    }
    image.classList.toggle("is-zoomed", isZoomed);
    image.classList.toggle("is-panning", isPanning && isZoomed);
    if (closeBtn) closeBtn.hidden = isZoomed;
    applyImageTransform();
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

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const work = map.get(link.dataset.workId);
      if (!work) return;
      currentWorkId = String(work.id ?? "");
      currentWorkPage = link.dataset.workPage || getWorkPagePath(work);
      currentImages = work.images?.length ? work.images : [work.image];
      currentTitle = work.title || "";
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
    });
  });

  if (detailBtn) {
    detailBtn.addEventListener("click", () => {
      if (!currentWorkId || !currentWorkPage) return;
      const params = new URLSearchParams({
        work: currentWorkId,
        open: "1",
        layout: "large",
      });
      window.location.href = `${currentWorkPage}?${params.toString()}`;
    });
  }

  image.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setZoom(!isZoomed);
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
    if (!isZoomed) return;
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
    if (!pointerDown || !isZoomed) return;
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
    if (!pointerDown) return;
    if (image.hasPointerCapture(event.pointerId)) {
      image.releasePointerCapture(event.pointerId);
    }
    pointerDown = false;
    isPanning = false;
    image.classList.remove("is-panning");
  });
  image.addEventListener("pointercancel", () => {
    pointerDown = false;
    isPanning = false;
    hasMoved = false;
    image.classList.remove("is-panning");
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
    if (target.closest(".work-image-link img, .viewer-image")) {
      event.preventDefault();
    }
  });

  document.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".work-image-link img, .viewer-image")) {
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

normalizeInternalPageLinks();
setupMobileMenu();
attachImageProtection();
renderFeatureImages();
renderGallery();
attachBackToTopButtons();
