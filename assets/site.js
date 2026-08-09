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

    /* The skill-tree map is a canvas far wider and taller than its box, so a
       fresh stage would otherwise open on an empty corner of the tree. Park
       the scroll on the middle of what this stage allocates. Nothing is built
       or measured from data here: it reads the laid-out DOM. */
    function centreMap(section) {
      all(".tmap-scroll", section).forEach(function (box) {
        var canvas = box.querySelector(".tcanvas");
        /* a box inside a hidden tab panel has no layout yet: leave it alone
           and centre it when its tab is opened */
        if (!canvas || !box.clientWidth) { return; }
        if (box.getAttribute("data-centred") === "1") { return; }
        var lit = all(".tn.lit", canvas);
        var x = canvas.offsetWidth / 2;
        var y = canvas.offsetHeight / 2;
        if (lit.length) {
          var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          lit.forEach(function (node) {
            minX = Math.min(minX, node.offsetLeft);
            maxX = Math.max(maxX, node.offsetLeft);
            minY = Math.min(minY, node.offsetTop);
            maxY = Math.max(maxY, node.offsetTop);
          });
          x = (minX + maxX) / 2;
          y = (minY + maxY) / 2;
        }
        box.scrollLeft = Math.max(0, x - box.clientWidth / 2);
        box.scrollTop = Math.max(0, y - box.clientHeight / 2);
        box.setAttribute("data-centred", "1");
      });
    }

    function applyStage(key) {
      sections.forEach(function (section) {
        section.hidden = section.getAttribute("data-stage") !== key;
        if (!section.hidden) { centreMap(section); }
      });
      triggers.forEach(function (trigger) {
        trigger.hidden = trigger.getAttribute("data-stage") !== key;
      });
    }

    if (select) {
      select.addEventListener("change", function () { applyStage(select.value); });

      /* the page opens on its endgame stage (the generator marks that option
         `selected`); an explicit ?stage= still wins when it names a real one */
      var wantedStage = new URLSearchParams(window.location.search).get("stage");
      if (wantedStage) {
        all("option", select).forEach(function (option) {
          if (option.value === wantedStage) { select.value = wantedStage; }
        });
      }
      applyStage(select.value);

      /* "Paragon opens at endgame" -> switch the select and fire its handler */
      all(".stage-jump").forEach(function (button) {
        button.addEventListener("click", function () {
          var key = button.getAttribute("data-jump");
          if (!key) { return; }
          select.value = key;
          if (typeof window.Event === "function") {
            select.dispatchEvent(new window.Event("change", { bubbles: true }));
          } else {
            applyStage(key);
          }
          select.focus();
        });
      });
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
        if (!panel.hidden) {
          all(".stage-section", panel).forEach(function (section) {
            if (!section.hidden) { centreMap(section); }
          });
        }
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

    /* `di`/`pos` keep the generator's own ordering (domains in the order the
       shard list declares them, entries in the order it wrote them, so items
       still lead with mythics and uniques). That is what an empty search box
       shows; a typed query sorts by match quality instead. */
    function prepare(entry, position, shardIndex) {
      var text = [entry.name, entry.kind].concat(entry.chips || []);
      (entry.detail || []).forEach(function (pair) { text.push(pair[1]); });
      entry.lname = String(entry.name || "").toLowerCase();
      entry.hay = text.join(" \u2014 ").toLowerCase();
      entry.pos = position;
      entry.di = shardIndex;
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
      /* an affix with no prefix/suffix is named by its own rolled attribute,
         so a name can carry a value slot too */
      withSlots(name, entry.name);
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
        withSlots(blurb, String(entry.detail[0][1]).replace(/\s*\n+\s*/g, " "));
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
      withSlots(title, entry.name);
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
      var browsing = !tokens.length;
      hits.sort(function (a, b) {
        if (browsing) {
          if (a[1].di !== b[1].di) { return a[1].di - b[1].di; }
          return a[1].pos - b[1].pos;
        }
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

    /* coalesce a burst of keystrokes into one render. setTimeout rather than
       requestAnimationFrame: rAF never fires while the tab is hidden, which
       would leave a restored tab showing results for an older query. */
    function schedule() {
      if (frame) { window.clearTimeout(frame); }
      frame = window.setTimeout(function () { frame = null; run(); }, 0);
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

    shards.forEach(function (shard, shardIndex) {
      window.fetch(shard.file, { credentials: "same-origin" })
        .then(function (response) {
          if (!response.ok) { throw new Error(String(response.status)); }
          return response.json();
        })
        .then(function (payload) {
          (payload.entries || []).forEach(function (entry, position) {
            prepare(entry, position, shardIndex);
          });
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

  /* ------------------- Task 31: node-graph viewports ---------------------- */
  /* One behaviour for three canvases: the class skill tree, the mercenary tree
     and every paragon board. Each gets a search box, a zoom stepper, a
     fullscreen button and (where it applies) a rotate or allocation toggle.

     Nothing in here builds markup from data. The search only adds and removes
     class names, and the one string it writes -- the hit count -- goes in via
     textContent. Panning is ordinary scrolling that a pointer drag nudges, so
     the canvases stay usable with a keyboard, on a phone, and with this file
     absent entirely. */
  (function viewports() {
    var MIN = 0.4, MAX = 2.5, STEP = 0.2;

    function clamp(z) { return Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100)); }

    /* --- drag to pan: scrollLeft/scrollTop, so native scrolling still owns
       the axis and momentum, focus and keyboard paging keep working --- */
    function dragToPan(box) {
      var live = false, id = null, sx = 0, sy = 0, ox = 0, oy = 0;
      box.addEventListener("pointerdown", function (event) {
        /* let the controls, links and focusable node plates behave normally */
        if (event.button !== 0 || event.target.closest("a, button, input")) { return; }
        live = true;
        id = event.pointerId;
        sx = event.clientX;
        sy = event.clientY;
        ox = box.scrollLeft;
        oy = box.scrollTop;
        box.classList.add("dragging");
      });
      box.addEventListener("pointermove", function (event) {
        if (!live || event.pointerId !== id) { return; }
        var dx = event.clientX - sx, dy = event.clientY - sy;
        if (!box.hasPointerCapture(id) && Math.abs(dx) + Math.abs(dy) > 4) {
          try { box.setPointerCapture(id); } catch (err) { /* not capturable */ }
        }
        box.scrollLeft = ox - dx;
        box.scrollTop = oy - dy;
      });
      function stop(event) {
        if (!live || (event && event.pointerId !== id)) { return; }
        live = false;
        box.classList.remove("dragging");
        try { box.releasePointerCapture(id); } catch (err) { /* already gone */ }
      }
      box.addEventListener("pointerup", stop);
      box.addEventListener("pointercancel", stop);
    }

    /* --- fullscreen: the API when it is granted, a fixed overlay when not --- */
    function wireFullscreen(view, btn) {
      function paint() {
        var on = document.fullscreenElement === view || view.classList.contains("is-fs");
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.textContent = on ? "Exit" : "Fullscreen";
      }
      function fallbackOn() { view.classList.add("is-fs"); paint(); }
      btn.addEventListener("click", function () {
        var on = document.fullscreenElement === view || view.classList.contains("is-fs");
        if (on) {
          view.classList.remove("is-fs");
          if (document.fullscreenElement === view && document.exitFullscreen) {
            document.exitFullscreen().catch(function () { /* already out */ });
          }
          paint();
          return;
        }
        if (view.requestFullscreen) {
          var result = view.requestFullscreen();
          if (result && result.catch) { result.catch(fallbackOn); }
          window.setTimeout(paint, 0);
        } else {
          fallbackOn();
        }
      });
      document.addEventListener("fullscreenchange", paint);
      /* Escape leaves the fallback overlay, matching what the real API does */
      view.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && view.classList.contains("is-fs")) {
          view.classList.remove("is-fs");
          paint();
          btn.focus();
        }
      });
      paint();
    }

    /* --- search: dim everything, ring the matches, count them out loud --- */
    function wireSearch(input, hits, canvas, nodes, noun) {
      function apply() {
        var q = (input.value || "").trim().toLowerCase();
        if (!q) {
          canvas.classList.remove("searching");
          nodes.forEach(function (n) { n.classList.remove("hit"); });
          hits.textContent = "";
          return;
        }
        var found = 0;
        nodes.forEach(function (n) {
          var hay = (n.getAttribute("title") || "").toLowerCase();
          var on = hay.indexOf(q) !== -1;
          n.classList.toggle("hit", on);
          if (on) { found++; }
        });
        canvas.classList.add("searching");
        hits.textContent = found + (found === 1 ? " match" : " matches");
        if (!found) { hits.textContent = "no " + noun + " matched"; }
      }
      input.addEventListener("input", apply);
      input.addEventListener("search", apply);
      apply();
    }

    /* --- zoom: one CSS custom property drives the whole canvas geometry --- */
    function wireZoom(view, box, target, prop, base) {
      var zoom = 1;
      var label = view.querySelector("[data-zoomlabel]");
      function paint() {
        /* keep whatever was in the middle of the box in the middle of the box:
           zooming a canvas that then jumps to a corner loses the reader's place */
        var w = box.scrollWidth - box.clientWidth;
        var h = box.scrollHeight - box.clientHeight;
        var fx = w > 0 ? (box.scrollLeft + box.clientWidth / 2) / box.scrollWidth : 0.5;
        var fy = h > 0 ? (box.scrollTop + box.clientHeight / 2) / box.scrollHeight : 0.5;
        target.style.setProperty(prop, String(zoom * base));
        if (label) { label.textContent = Math.round(zoom * 100) + "%"; }
        box.scrollLeft = Math.max(0, fx * box.scrollWidth - box.clientWidth / 2);
        box.scrollTop = Math.max(0, fy * box.scrollHeight - box.clientHeight / 2);
      }
      function by(delta) { zoom = clamp(zoom + delta); paint(); }
      Array.prototype.slice.call(view.querySelectorAll("[data-zoom]"))
        .forEach(function (btn) {
          var kind = btn.getAttribute("data-zoom");
          btn.addEventListener("click", function () {
            if (kind === "reset") { zoom = 1; paint(); }
            else { by(kind === "in" ? STEP : -STEP); }
          });
        });
      /* ctrl/meta + wheel is the trackpad pinch gesture; a bare wheel is left
         alone so the page still scrolls past a canvas on the way down */
      box.addEventListener("wheel", function (event) {
        if (!event.ctrlKey && !event.metaKey) { return; }
        event.preventDefault();
        by(event.deltaY < 0 ? STEP : -STEP);
      }, { passive: false });
      paint();
    }

    function wireToggle(btn, target, cls) {
      if (!btn) { return; }
      btn.addEventListener("click", function () {
        var on = btn.getAttribute("aria-pressed") !== "true";
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        target.classList.toggle(cls, on);
      });
    }

    all("[data-pview]").forEach(function (view) {
      var box = view.querySelector(".pgrid-scroll");
      var grid = view.querySelector(".pgrid");
      var rot = view.querySelector(".pgrid-rot");
      if (!box || !grid || !rot) { return; }
      var input = view.querySelector("[data-find]");
      var hits = view.querySelector("[data-hits]");
      var nodes = all(".pnode", grid);
      if (input && hits) { wireSearch(input, hits, grid, nodes, "nodes"); }
      wireZoom(view, box, grid, "--pz", 1);
      dragToPan(box);
      var fs = view.querySelector("[data-fullscreen]");
      if (fs) { wireFullscreen(view, fs); }
      var turn = view.querySelector("[data-rotate]");
      if (turn) {
        turn.addEventListener("click", function () {
          var on = turn.getAttribute("aria-pressed") !== "true";
          turn.setAttribute("aria-pressed", on ? "true" : "false");
          rot.setAttribute("data-rot", on ? "45" : "0");
          /* A rotated box overflows its layout box, and overflow above and to
             the left of a scroll container cannot be scrolled to. So give the
             wrapper the rotated bounding box as its own size and let it centre
             the grid: rotating a W x H box by 45deg gives a square bounding
             box of (W + H) * cos(45deg) a side, and the stylesheet then scales
             that by cos(45deg) again -- so the side is (W + H) / 2. */
          if (!on) {
            rot.style.width = "";
            rot.style.height = "";
            return;
          }
          var side = (grid.offsetWidth + grid.offsetHeight) / 2;
          rot.style.width = side + "px";
          rot.style.height = side + "px";
        });
      }
    });

    all("[data-tview]").forEach(function (view) {
      var box = view.querySelector(".tmap-scroll");
      var canvas = view.querySelector(".tcanvas");
      if (!box || !canvas) { return; }
      var input = view.querySelector("[data-find]");
      var hits = view.querySelector("[data-hits]");
      var nodes = all(".tn", canvas);
      if (input && hits) { wireSearch(input, hits, canvas, nodes, "nodes"); }
      /* the stylesheet already zooms the canvas out on a narrow screen; read
         that starting value so the stepper counts from what is on screen */
      var start = parseFloat(window.getComputedStyle(canvas).getPropertyValue("--tz")) || 1;
      wireZoom(view, box, canvas, "--tz", start);
      dragToPan(box);
      var fs = view.querySelector("[data-fullscreen]");
      if (fs) { wireFullscreen(view, fs); }
      wireToggle(view.querySelector("[data-alloconly]"), canvas, "alloc-only");
    });
  })();
})();
