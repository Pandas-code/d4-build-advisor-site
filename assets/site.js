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
})();
