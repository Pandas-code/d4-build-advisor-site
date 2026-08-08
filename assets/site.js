/* ==========================================================================
   Diablo 4 Build Advisor - shared page behaviour for the multi-page site.

   Every page is fully rendered server-side by scripts/build_site.py; this
   file only *toggles* what is already in the DOM (season, section, stage,
   tab) and writes a handful of relative-date strings. It never builds DOM
   from data with innerHTML: the few data-driven strings go in via
   textContent. No external requests of any kind.

   #page-data carries the page's own JSON (see PAGE_DATA contract in
   .claude/agents/web-dev.md).
   ========================================================================== */
(function () {
  "use strict";

  var DATA = {};
  try {
    var holder = document.getElementById("page-data");
    if (holder) { DATA = JSON.parse(holder.textContent || "{}") || {}; }
  } catch (err) {
    DATA = {};
  }
  window.PAGE_DATA = DATA;

  /* --------------------------------- utils ------------------------------- */
  function byId(id) { return document.getElementById(id); }
  function all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* days between an ISO date string (YYYY-MM-DD) and today, both taken as UTC
     midnight so local timezone offsets never shift the count by a day */
  function daysSince(dateStr) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ""));
    if (!m) { return null; }
    var then = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var now = new Date();
    var today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((today - then) / 86400000);
  }

  function relativeDays(n) {
    if (n === null || n === undefined || isNaN(n)) { return "unknown"; }
    if (n <= 0) { return "today"; }
    return n + (n === 1 ? " day ago" : " days ago");
  }

  /* ------------------------------ top nav -------------------------------- */
  var menus = [];

  function closeAllMenus(except) {
    menus.forEach(function (m) { if (m !== except) { m.close(); } });
  }

  function makeMenu(btnId, menuId) {
    var btn = byId(btnId);
    var box = byId(menuId);
    if (!btn || !box) { return null; }
    var api = {
      btn: btn,
      box: box,
      items: function () { return all('[role="menuitem"]', box); },
      isOpen: function () { return btn.getAttribute("aria-expanded") === "true"; },
      open: function (focusIndex) {
        closeAllMenus(api);
        box.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        var items = api.items();
        if (focusIndex !== undefined && items.length) {
          items[focusIndex < 0 ? items.length - 1 : focusIndex].focus();
        }
      },
      close: function (refocus) {
        if (!api.isOpen()) { return; }
        box.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        if (refocus) { btn.focus(); }
      }
    };

    btn.addEventListener("click", function () {
      if (api.isOpen()) { api.close(); } else { api.open(); }
    });

    btn.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        api.open(0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        api.open(-1);
      } else if (event.key === "Escape") {
        api.close();
      } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        var idx = menus.indexOf(api);
        var delta = event.key === "ArrowRight" ? 1 : -1;
        menus[(idx + delta + menus.length) % menus.length].btn.focus();
        closeAllMenus();
      }
    });

    box.addEventListener("keydown", function (event) {
      var items = api.items();
      var pos = items.indexOf(document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(pos + 1) % items.length].focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(pos - 1 + items.length) % items.length].focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        items[0].focus();
      } else if (event.key === "End") {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        api.close(true);
      } else if (event.key === "Tab") {
        api.close();
      }
    });

    menus.push(api);
    return api;
  }

  var tierMenu = makeMenu("menu-tier-btn", "menu-tier");
  var buildsMenu = makeMenu("menu-builds-btn", "menu-builds");

  document.addEventListener("click", function (event) {
    if (!event.target.closest || !event.target.closest(".menu-wrap")) { closeAllMenus(); }
  });
  document.addEventListener("focusin", function (event) {
    if (!event.target.closest || !event.target.closest(".menu-wrap")) { closeAllMenus(); }
  });

  /* ------------------------------- history ------------------------------- */
  (function historyDrawer() {
    var toggle = byId("history-toggle");
    var drawer = byId("history");
    if (!toggle || !drawer) { return; }
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", open ? "false" : "true");
      drawer.hidden = open;
    });
    all(".run-details-toggle").forEach(function (btn) {
      var list = byId(btn.getAttribute("aria-controls"));
      if (!list) { return; }
      var count = list.children.length;
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        btn.textContent = (open ? "Details (" : "Hide details (") + count + ")";
        list.hidden = open;
      });
    });
  })();

  /* staleness: recomputed in the browser so the warning stays honest as the
     published page ages (spec section 7 + section 9) */
  (function staleness() {
    var boxes = [byId("stale-warning"), byId("history-stale-warning")]
      .filter(function (el) { return !!el; });
    if (!boxes.length) { return; }
    var last = DATA.last_success_date || null;
    var isStale, message;
    if (last) {
      var staleDays = daysSince(last);
      isStale = staleDays !== null && staleDays > 10;
      message = "Last successful run " + relativeDays(staleDays) +
        " \u2014 check the weekly routine";
    } else {
      isStale = true;
      message = "No successful run recorded \u2014 check the weekly routine";
    }
    boxes.forEach(function (el) {
      el.hidden = !isStale;
      el.textContent = message;
    });
  })();

  /* -------------------------------- index -------------------------------- */
  (function indexPage() {
    if (DATA.kind !== "index") { return; }

    var seasons = Array.isArray(DATA.seasons) ? DATA.seasons : [];
    var blocks = all(".season-block");
    if (!seasons.length || !blocks.length) { return; }

    var params = new URLSearchParams(window.location.search);
    var wanted = params.get("season");
    var state = { season: 0, section: params.get("section") || "meta" };

    for (var i = 0; i < seasons.length; i++) {
      if (!seasons[i].ptr) { state.season = i; break; }
    }
    if (wanted !== null) {
      for (var j = 0; j < seasons.length; j++) {
        if (String(seasons[j].season) === String(wanted)) { state.season = j; break; }
      }
    }

    var seasonLine = byId("season-line");
    var foot = byId("foot");
    var navSeason = byId("nav-season");
    var ptrBanner = byId("ptr-banner");
    var generatedText = "generated " + relativeDays(daysSince(DATA.generated));

    function applySeason() {
      var s = seasons[state.season] || {};

      blocks.forEach(function (block, index) {
        block.hidden = index !== state.season;
      });

      if (seasonLine) {
        seasonLine.textContent = (s.label || "") + "  \u2022  " + generatedText;
      }
      if (foot) { foot.textContent = s.foot || ""; }
      if (navSeason) {
        navSeason.replaceChildren();
        navSeason.appendChild(document.createTextNode(s.short_label || s.label || ""));
        if (s.ptr) {
          var badge = document.createElement("span");
          badge.className = "badge-ptr";
          badge.textContent = "PTR";
          navSeason.appendChild(badge);
        }
      }
      if (ptrBanner) { ptrBanner.hidden = !s.ptr; }

      if (tierMenu) {
        tierMenu.items().forEach(function (item) {
          item.setAttribute("aria-current",
            item.getAttribute("data-season") === String(s.season) ? "true" : "false");
        });
      }
      applySection();
    }

    function applySection() {
      var block = blocks[state.season];
      if (!block) { return; }
      all("[data-section]", block).forEach(function (tab) {
        var on = tab.getAttribute("data-section") === state.section;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.setAttribute("tabindex", on ? "0" : "-1");
      });
      all("[data-panel]", block).forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-panel") !== state.section;
      });
      if (buildsMenu) {
        buildsMenu.items().forEach(function (item) {
          item.setAttribute("aria-current",
            item.getAttribute("data-section") === state.section ? "true" : "false");
        });
      }
      syncUrl();
    }

    function syncUrl() {
      if (!window.history || !window.history.replaceState) { return; }
      var s = seasons[state.season] || {};
      var next = window.location.pathname + "?season=" + encodeURIComponent(s.season) +
        "&section=" + encodeURIComponent(state.section);
      window.history.replaceState(null, "", next + window.location.hash);
    }

    function scrollToEl(el) {
      if (el) { el.scrollIntoView({ block: "start", behavior: "auto" }); }
    }

    /* section tabs inside every season block */
    blocks.forEach(function (block) {
      var tabs = all("[data-section]", block);
      tabs.forEach(function (tab, index) {
        tab.addEventListener("click", function () {
          state.section = tab.getAttribute("data-section");
          applySection();
        });
        tab.addEventListener("keydown", function (event) {
          var delta = event.key === "ArrowRight" ? 1
            : event.key === "ArrowLeft" ? -1 : 0;
          if (!delta) { return; }
          event.preventDefault();
          var next = tabs[(index + delta + tabs.length) % tabs.length];
          state.section = next.getAttribute("data-section");
          applySection();
          next.focus();
        });
      });
    });

    /* nav menu links switch in place on this page instead of reloading it */
    if (tierMenu) {
      tierMenu.items().forEach(function (item) {
        item.addEventListener("click", function (event) {
          var idx = -1;
          for (var k = 0; k < seasons.length; k++) {
            if (String(seasons[k].season) === item.getAttribute("data-season")) { idx = k; }
          }
          if (idx < 0) { return; }
          event.preventDefault();
          closeAllMenus();
          state.season = idx;
          applySeason();
          scrollToEl(blocks[idx].querySelector(".rule"));
        });
      });
    }
    if (buildsMenu) {
      buildsMenu.items().forEach(function (item) {
        item.addEventListener("click", function (event) {
          var key = item.getAttribute("data-section");
          if (!key) { return; }
          event.preventDefault();
          closeAllMenus();
          state.section = key;
          applySection();
          scrollToEl(blocks[state.season].querySelector(".builds-h"));
        });
      });
    }

    applySeason();
  })();

  /* ----------------------------- build page ------------------------------ */
  (function buildPage() {
    if (DATA.kind !== "build") { return; }

    var select = byId("stage-select");
    var sections = all(".stage-section");
    var triggers = all(".stage-trigger");

    function applyStage(key) {
      sections.forEach(function (section) {
        section.hidden = section.getAttribute("data-stage") !== key;
      });
      triggers.forEach(function (trigger) {
        trigger.hidden = trigger.getAttribute("data-stage") !== key;
      });
    }

    if (select) {
      select.addEventListener("change", function () { applyStage(select.value); });
      applyStage(select.value);
    }

    var tabs = all(".btab");
    var panels = all(".bpanel");

    function selectTab(index) {
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.setAttribute("tabindex", on ? "0" : "-1");
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-tab") !== tabs[index].getAttribute("data-tab");
      });
      var scroller = tabs[index].parentNode.parentNode;
      if (scroller && scroller.getBoundingClientRect) {
        var box = scroller.getBoundingClientRect();
        var rect = tabs[index].getBoundingClientRect();
        if (rect.left < box.left) { scroller.scrollLeft += rect.left - box.left; }
        else if (rect.right > box.right) { scroller.scrollLeft += rect.right - box.right; }
      }
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () { selectTab(index); });
      tab.addEventListener("keydown", function (event) {
        var next = null;
        if (event.key === "ArrowRight") { next = (index + 1) % tabs.length; }
        else if (event.key === "ArrowLeft") { next = (index - 1 + tabs.length) % tabs.length; }
        else if (event.key === "Home") { next = 0; }
        else if (event.key === "End") { next = tabs.length - 1; }
        if (next === null) { return; }
        event.preventDefault();
        selectTab(next);
        tabs[next].focus();
      });
    });

    if (tabs.length) { selectTab(0); }
  })();

  /* ---------------------------- boss loot page ---------------------------- */
  /* Everything on this page is pre-rendered, including one cross-reference
     panel per drop: the generator already resolved which bosses carry an item
     and which builds ask for it. This only toggles hidden/class state. */
  (function bossPage() {
    if (DATA.kind !== "bosses") { return; }

    var bossSel = byId("f-boss");
    var classSel = byId("f-class");
    var search = byId("f-item");
    var reset = byId("f-reset");
    var status = byId("f-status");
    var focusWrap = byId("item-focus");
    var focusClear = byId("focus-clear");
    if (!bossSel || !classSel || !search) { return; }

    var cards = all(".boss");
    var lootItems = all(".loot");
    var focusCards = all(".focus-card");
    var selected = null;

    /* data-name is the generator's loose name key (lowercased, punctuation
       folded), so "100,000" and "Ae'grom" match what the reader types */
    function loose(text) {
      return String(text || "").toLowerCase()
        .replace(/[^a-z0-9]+/g, " ").replace(/^ +/, "").replace(/ +$/, "");
    }

    function applyFilters() {
      var boss = bossSel.value;
      var cls = classSel.value;
      var query = loose(search.value);
      var filtering = !!(cls || query);
      var shownCards = 0;
      var shownItems = 0;

      cards.forEach(function (card) {
        var onBoss = !boss || card.id === boss;
        var visible = 0;
        all(".loot", card).forEach(function (row) {
          var ok = true;
          if (cls) {
            ok = (" " + (row.getAttribute("data-classes") || "") + " ")
              .indexOf(" " + cls + " ") >= 0;
          }
          if (ok && query) {
            ok = (row.getAttribute("data-name") || "").indexOf(query) >= 0;
          }
          row.hidden = !ok;
          if (ok) { visible++; }
        });
        var show = onBoss && (!filtering || visible > 0 || card.id === boss);
        card.hidden = !show;
        var none = card.querySelector(".no-hits");
        if (none) { none.hidden = !(show && filtering && visible === 0); }
        if (show) { shownCards++; shownItems += visible; }
      });

      if (status) {
        status.textContent = shownCards + (shownCards === 1 ? " table" : " tables")
          + ", " + shownItems + (shownItems === 1 ? " drop" : " drops")
          + (filtering ? " match these filters" : " listed");
      }
    }

    function setHash(value) {
      if (!window.history || !window.history.replaceState) { return; }
      window.history.replaceState(null, "",
        window.location.pathname + window.location.search + (value || ""));
    }

    function select(key, scroll) {
      var found = null;
      focusCards.forEach(function (card) {
        var on = card.getAttribute("data-item") === key;
        card.hidden = !on;
        if (on) { found = card; }
      });
      selected = found ? key : null;
      if (focusWrap) { focusWrap.hidden = !found; }
      lootItems.forEach(function (row) {
        var on = !!found && row.getAttribute("data-item") === key;
        row.classList.toggle("hit", on);
        var btn = row.querySelector(".loot-btn");
        if (btn) { btn.setAttribute("aria-pressed", on ? "true" : "false"); }
      });
      cards.forEach(function (card) {
        card.classList.toggle("hit", !!found && !!card.querySelector(".loot.hit"));
      });
      if (found) {
        setHash("#" + found.id);
        if (scroll) { found.scrollIntoView({ block: "nearest", behavior: "auto" }); }
      }
    }

    function clear() {
      focusCards.forEach(function (card) { card.hidden = true; });
      lootItems.forEach(function (row) {
        row.classList.remove("hit");
        var btn = row.querySelector(".loot-btn");
        if (btn) { btn.setAttribute("aria-pressed", "false"); }
      });
      cards.forEach(function (card) { card.classList.remove("hit"); });
      if (focusWrap) { focusWrap.hidden = true; }
      selected = null;
      setHash("");
    }

    all(".loot-btn").forEach(function (btn) {
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-item");
        if (selected === key) { clear(); } else { select(key, true); }
      });
    });

    /* "dropped by" links jump to a boss card, lifting the boss filter that
       would otherwise be hiding the card being jumped to */
    all("[data-goto]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        var target = byId(link.getAttribute("data-goto"));
        if (!target) { return; }
        event.preventDefault();
        if (bossSel.value && bossSel.value !== target.id) {
          bossSel.value = "";
          applyFilters();
        }
        target.scrollIntoView({ block: "start", behavior: "auto" });
        target.classList.add("flash");
        window.setTimeout(function () { target.classList.remove("flash"); }, 900);
      });
    });

    bossSel.addEventListener("change", applyFilters);
    classSel.addEventListener("change", applyFilters);
    search.addEventListener("input", applyFilters);
    if (reset) {
      reset.addEventListener("click", function () {
        bossSel.value = "";
        classSel.value = "";
        search.value = "";
        applyFilters();
        clear();
      });
    }
    if (focusClear) { focusClear.addEventListener("click", clear); }

    applyFilters();
    var hash = window.location.hash;
    if (hash.indexOf("#item-") === 0) {
      var card = byId(hash.slice(1));
      if (card) { select(card.getAttribute("data-item"), true); }
    }
  })();

  /* ------------------------------ codex page ------------------------------ */
  /* The only page whose rows are built in the browser: 14k entries cannot be
     pre-rendered. Every string still goes in through textContent - nothing on
     this page is ever assigned to innerHTML - and the index is fetched from
     this site's own origin, one shard per domain. */
  (function codexPage() {
    if (DATA.kind !== "codex") { return; }

    var input = byId("q");
    var domainSel = byId("c-domain");
    var classSel = byId("c-class");
    var reset = byId("c-reset");
    var status = byId("c-status");
    var results = byId("c-results");
    var detail = byId("c-detail");
    if (!input || !results || !detail) { return; }

    var LIMIT = 120;
    var ICON_BASE = DATA.icon_base || "../assets/icons/";
    var entries = [];
    var index = {};
    var shards = Array.isArray(DATA.shards) ? DATA.shards : [];
    var done = 0;
    var failed = 0;
    var frame = null;

    function key(domain, id) { return domain + "/" + id; }

    function prepare(entry) {
      var text = [entry.name, entry.kind].concat(entry.chips || []);
      (entry.detail || []).forEach(function (pair) { text.push(pair[1]); });
      entry.lname = String(entry.name || "").toLowerCase();
      entry.hay = text.join(" \u2014 ").toLowerCase();
      entries.push(entry);
      index[key(entry.domain, entry.id)] = entry;
    }

    function initial(name) {
      var text = String(name || "");
      for (var i = 0; i < text.length; i++) {
        if (/[a-z0-9]/i.test(text.charAt(i))) { return text.charAt(i).toUpperCase(); }
      }
      return "\u25c6";
    }

    function iconNode(entry, size) {
      var plate = document.createElement("span");
      plate.setAttribute("aria-hidden", "true");
      if (entry.icon) {
        plate.className = "icon " + size;
        var img = document.createElement("img");
        img.setAttribute("src", ICON_BASE + entry.icon);
        img.setAttribute("alt", "");
        img.setAttribute("loading", "lazy");
        img.setAttribute("decoding", "async");
        plate.appendChild(img);
      } else {
        plate.className = "icon " + size + " ph";
        plate.textContent = initial(entry.name);
      }
      return plate;
    }

    /* the feed's runtime placeholders ({x}, {value1}) are kept verbatim and
       shown as value slots -- the number behind them is not in the data and is
       never guessed here */
    function withSlots(target, text) {
      var lines = String(text == null ? "" : text).split("\n");
      lines.forEach(function (line, i) {
        if (i) { target.appendChild(document.createElement("br")); }
        var pattern = /\{(?:x|value\d+)\}/g;
        var last = 0;
        var match;
        while ((match = pattern.exec(line)) !== null) {
          if (match.index > last) {
            target.appendChild(document.createTextNode(line.slice(last, match.index)));
          }
          var slot = document.createElement("span");
          slot.className = "vslot";
          slot.textContent = match[0];
          slot.title = "a value the game supplies at runtime";
          target.appendChild(slot);
          last = pattern.lastIndex;
        }
        if (last < line.length) {
          target.appendChild(document.createTextNode(line.slice(last)));
        }
      });
      return target;
    }

    function chipNode(text, extra) {
      var chip = document.createElement("span");
      chip.className = extra ? "chip " + extra : "chip";
      chip.textContent = text;
      return chip;
    }

    function rowNode(entry) {
      var row = document.createElement("a");
      row.className = "cx-row";
      row.setAttribute("href", "#" + entry.domain + "/" + encodeURIComponent(entry.id));
      row.appendChild(iconNode(entry, "sm"));

      var body = document.createElement("span");
      body.className = "cx-body";
      var name = document.createElement("span");
      name.className = "cx-name";
      name.textContent = entry.name;
      body.appendChild(name);

      var meta = document.createElement("span");
      meta.className = "cx-meta";
      meta.textContent = [entry.domain, entry.kind]
        .concat(entry.classes || []).join(" \u00b7 ");
      body.appendChild(meta);
      row.appendChild(body);

      if (entry.detail && entry.detail.length) {
        var blurb = document.createElement("span");
        blurb.className = "cx-blurb";
        withSlots(blurb, entry.detail[0][1]);
        row.appendChild(blurb);
      }
      return row;
    }

    function detailNode(entry) {
      var frag = document.createDocumentFragment();
      var head = document.createElement("div");
      head.className = "cx-dhead";
      head.appendChild(iconNode(entry, "lg"));

      var titles = document.createElement("div");
      var title = document.createElement("h2");
      title.textContent = entry.name;
      titles.appendChild(title);
      var chips = document.createElement("div");
      chips.className = "chips";
      chips.appendChild(chipNode(entry.domain, "dom"));
      if (entry.kind) { chips.appendChild(chipNode(entry.kind)); }
      (entry.classes || []).forEach(function (cls) {
        var chip = chipNode(cls, "cls");
        chip.setAttribute("style", "--cls: var(--c-" + cls + ", var(--c-unknown));");
        chips.appendChild(chip);
      });
      (entry.chips || []).forEach(function (text) { chips.appendChild(chipNode(text)); });
      titles.appendChild(chips);
      head.appendChild(titles);

      var close = document.createElement("button");
      close.className = "back";
      close.setAttribute("type", "button");
      close.textContent = "Close";
      close.addEventListener("click", function () { show(null); });
      head.appendChild(close);
      frag.appendChild(head);

      (entry.detail || []).forEach(function (pair) {
        var block = document.createElement("div");
        block.className = "cx-line";
        var label = document.createElement("span");
        label.className = "cx-label";
        label.textContent = pair[0];
        block.appendChild(label);
        var text = document.createElement("div");
        text.className = "cx-text";
        withSlots(text, pair[1]);
        block.appendChild(text);
        frag.appendChild(block);
      });

      var foot = document.createElement("p");
      foot.className = "cx-id";
      foot.textContent = "game database id: " + entry.id;
      frag.appendChild(foot);
      return frag;
    }

    function show(entry, keepHash) {
      detail.replaceChildren();
      detail.hidden = !entry;
      if (entry) {
        detail.appendChild(detailNode(entry));
        if (!keepHash && window.history && window.history.replaceState) {
          window.history.replaceState(null, "", "#" + entry.domain + "/"
            + encodeURIComponent(entry.id));
        }
        detail.scrollIntoView({ block: "nearest", behavior: "auto" });
      } else if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "",
          window.location.pathname + window.location.search);
      }
    }

    function matches(entry, tokens, domain, cls) {
      if (domain && entry.domain !== domain) { return -1; }
      if (cls && (entry.classes || []).indexOf(cls) < 0) { return -1; }
      if (!tokens.length) { return 2; }
      var rank = 2;
      for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        if (entry.lname.indexOf(token) === 0) { rank = Math.min(rank, 0); }
        else if (entry.lname.indexOf(token) >= 0) { rank = Math.min(rank, 1); }
        else if (entry.hay.indexOf(token) >= 0) { rank = Math.min(rank, 2); }
        else { return -1; }
      }
      return rank;
    }

    function run() {
      var tokens = input.value.trim().toLowerCase().split(/\s+/)
        .filter(function (t) { return !!t; });
      var domain = domainSel ? domainSel.value : "";
      var cls = classSel ? classSel.value : "";
      var hits = [];
      for (var i = 0; i < entries.length; i++) {
        var rank = matches(entries[i], tokens, domain, cls);
        if (rank >= 0) { hits.push([rank, entries[i]]); }
      }
      hits.sort(function (a, b) {
        if (a[0] !== b[0]) { return a[0] - b[0]; }
        return a[1].lname < b[1].lname ? -1 : a[1].lname > b[1].lname ? 1 : 0;
      });

      var frag = document.createDocumentFragment();
      var shown = Math.min(hits.length, LIMIT);
      for (var j = 0; j < shown; j++) { frag.appendChild(rowNode(hits[j][1])); }
      results.replaceChildren(frag);

      if (status) {
        var loading = done < shards.length
          ? " \u2014 loading the index (" + done + "/" + shards.length + ")" : "";
        if (!entries.length) {
          status.textContent = failed && done >= shards.length
            ? "The codex index could not be loaded."
            : "Loading the index\u2026";
        } else if (!hits.length) {
          status.textContent = "Nothing matches" + loading;
        } else {
          status.textContent = "Showing " + shown + " of " + hits.length
            + (hits.length === 1 ? " entry" : " entries") + loading;
        }
      }
    }

    function schedule() {
      if (frame) { window.cancelAnimationFrame(frame); }
      frame = window.requestAnimationFrame(function () { frame = null; run(); });
    }

    function fromHash(quiet) {
      var hash = window.location.hash.slice(1);
      var cut = hash.indexOf("/");
      if (cut < 0) { return false; }
      var entry = index[key(hash.slice(0, cut), decodeURIComponent(hash.slice(cut + 1)))];
      if (!entry) { return false; }
      show(entry, quiet);
      return true;
    }

    input.addEventListener("input", schedule);
    if (domainSel) { domainSel.addEventListener("change", schedule); }
    if (classSel) { classSel.addEventListener("change", schedule); }
    if (reset) {
      reset.addEventListener("click", function () {
        input.value = "";
        if (domainSel) { domainSel.value = ""; }
        if (classSel) { classSel.value = ""; }
        show(null);
        run();
        input.focus();
      });
    }
    all(".dbtn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (domainSel) { domainSel.value = btn.getAttribute("data-domain"); }
        run();
        if (results.scrollIntoView) {
          results.scrollIntoView({ block: "start", behavior: "auto" });
        }
      });
    });
    results.addEventListener("click", function (event) {
      var row = event.target.closest ? event.target.closest(".cx-row") : null;
      if (!row) { return; }
      event.preventDefault();
      var hash = row.getAttribute("href").slice(1);
      var cut = hash.indexOf("/");
      var entry = index[key(hash.slice(0, cut), decodeURIComponent(hash.slice(cut + 1)))];
      if (entry) { show(entry); }
    });
    window.addEventListener("hashchange", function () {
      if (!fromHash(true)) { show(null, true); }
    });

    shards.forEach(function (shard) {
      window.fetch(shard.file, { credentials: "same-origin" })
        .then(function (response) {
          if (!response.ok) { throw new Error(String(response.status)); }
          return response.json();
        })
        .then(function (payload) {
          (payload.entries || []).forEach(prepare);
          done++;
          run();
          fromHash(true);
        })
        .catch(function () {
          done++;
          failed++;
          run();
        });
    });

    run();
  })();
})();
