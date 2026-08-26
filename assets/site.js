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
      if (!items.length) { return; }
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

  /* ------------------------------- home page ------------------------------
     The news feed is entirely pre-rendered; the only thing left to do in the
     browser is age the "generated" stamp, exactly as every other page does. */
  (function newsPage() {
    if (DATA.kind !== "news") { return; }
    var seasonLine = byId("season-line");
    if (!seasonLine) { return; }
    seasonLine.textContent = (DATA.label || "") + "  \u2022  generated " +
      relativeDays(daysSince(DATA.generated));
  })();

  /* ------------------------------ tier list ------------------------------ */
  (function tierListPage() {
    if (DATA.kind !== "tierlist") { return; }

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
          var to = null;
          if (event.key === "ArrowRight") { to = (index + 1) % tabs.length; }
          else if (event.key === "ArrowLeft") { to = (index - 1 + tabs.length) % tabs.length; }
          else if (event.key === "Home") { to = 0; }
          else if (event.key === "End") { to = tabs.length - 1; }
          if (to === null) { return; }
          event.preventDefault();
          var next = tabs[to];
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

    /* Task 47: the stage switcher is the reference's "Build Variants"
       dropdown, a real <select>. Every stage is pre-rendered; the control
       only chooses which sections are shown. (The pill form of the same
       control is still honoured, so a page built either way switches.) */
    var pills = all(".stage-pill");
    var selects = all(".stage-select");
    var sections = all(".stage-section");
    var triggers = all(".stage-trigger");

    /* the skill-tree planner fits itself to the stage's allocation (its
       `data-fit` box) the moment its section has layout: see wirePlanner */

    function hasStage(key) {
      return sections.some(function (section) {
        return section.getAttribute("data-stage") === key;
      });
    }

    /* the URL carries the stage and the tab, so the Share button copies
       the reader's place and a pasted link opens on it. replaceState: a
       stage or tab is a view of one page, not a page in the history */
    function syncUrl(stage, tab) {
      if (!window.history || !window.history.replaceState) { return; }
      var params = new URLSearchParams(window.location.search);
      if (stage) { params.set("stage", stage); }
      var query = params.toString();
      var hash = tab ? "#" + tab : window.location.hash;
      window.history.replaceState(null, "",
        window.location.pathname + (query ? "?" + query : "") + hash);
    }

    function applyStage(key) {
      syncUrl(key, null);
      sections.forEach(function (section) {
        section.hidden = section.getAttribute("data-stage") !== key;
      });
      triggers.forEach(function (trigger) {
        trigger.hidden = trigger.getAttribute("data-stage") !== key;
      });
      pills.forEach(function (pill) {
        pill.setAttribute("aria-pressed",
                          pill.getAttribute("data-stage") === key ? "true" : "false");
      });
      selects.forEach(function (select) {
        if (select.value !== key) { select.value = key; }
      });
    }

    if (pills.length || selects.length) {
      pills.forEach(function (pill) {
        pill.addEventListener("click", function () {
          applyStage(pill.getAttribute("data-stage"));
        });
      });
      selects.forEach(function (select) {
        select.addEventListener("change", function () {
          applyStage(select.value);
        });
      });

      /* the page opens on its endgame stage (the generator selects that
         option); an explicit ?stage= still wins when it names a real one */
      var current = selects.length ? selects[0].value
                                   : pills[0].getAttribute("data-stage");
      pills.forEach(function (pill) {
        if (pill.getAttribute("aria-pressed") === "true") {
          current = pill.getAttribute("data-stage");
        }
      });
      var wantedStage = new URLSearchParams(window.location.search).get("stage");
      if (wantedStage && hasStage(wantedStage)) { current = wantedStage; }
      applyStage(current);

      /* "Paragon opens at endgame" -> switch to that stage and focus the control */
      all(".stage-jump").forEach(function (button) {
        button.addEventListener("click", function () {
          var key = button.getAttribute("data-jump");
          if (!key || !hasStage(key)) { return; }
          applyStage(key);
          pills.forEach(function (pill) {
            if (pill.getAttribute("data-stage") === key) { pill.focus(); }
          });
          if (selects.length) { selects[0].focus(); }
        });
      });
    }

    var tabs = all(".btab");
    var panels = all(".bpanel");

    function selectTab(index) {
      syncUrl(null, tabs[index].id);
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.setAttribute("tabindex", on ? "0" : "-1");
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-tab") !== tabs[index].getAttribute("data-tab");
        if (!panel.hidden) {
          all(".stage-section", panel).forEach(function (section) {
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

    if (tabs.length) {
      var wantedTab = window.location.hash.slice(1);
      var start = 0;
      tabs.forEach(function (tab, i) { if (tab.id === wantedTab) { start = i; } });
      selectTab(start);
    }
  })();

  /* ------------------------- in-game item tooltips ------------------------ */
  /* Task 45. Every card is already in the page, rendered server-side by
     build_site.py; this only positions one and toggles `hidden`. Nothing is
     built from data here.

     Three ways in, because the reference has three: hover with a mouse, tap
     on a touch screen, Tab + Enter/Space on a keyboard. Escape always closes,
     and hands focus back when focus was inside the tooltip to begin with.
     Below SHEET_WIDTH the card stops floating beside a
     fingertip and becomes a bottom sheet (the .sheet rules in site.css). */

  /* Task 46 published the controller to the rest of the file, because two
     pages carry item names that are not build-page gear slots and cannot use
     a plain `.tt-anchor` button:

       * the boss page's loot buttons already own a click (they open the
         cross-reference panel) and already say `aria-controls`;
       * the codex builds its result rows in the browser, so its anchors do
         not exist when this runs.

     Both call TT.attach() with the element they already have. It is set below
     and both callers run after it. */
  var TT = null;

  (function itemTooltips() {
    var SHEET_WIDTH = 720;   /* px; matches the 44rem/62rem CSS stack points */
    var GAP = 10;            /* px of air between the anchor and the card */
    var GRACE = 120;         /* ms the card stays after the anchor is left */
    var open = null;
    var pinned = false;
    /* Set only while Escape hands focus back to its anchor. Without it the
       programmatic focus() fires the focus handler, which sees
       :focus-visible and re-opens (and pins) the card Escape just closed. */
    var restoring = false;
    /* Owner defect: a card (400px tall at most, scrollable) closed the
       instant the pointer left its anchor, so nothing in it could be
       scrolled. The card is interactive, as the reference's is: leaving the
       anchor towards the card keeps it (relatedTarget, or a grace timer the
       card's own pointerenter cancels), leaving the card closes it. */
    var overCard = false;
    var graceTimer = 0;

    function cancelGrace() {
      if (graceTimer) { window.clearTimeout(graceTimer); graceTimer = 0; }
    }
    function scheduleClose() {
      cancelGrace();
      graceTimer = window.setTimeout(function () {
        graceTimer = 0;
        if (!pinned && !overCard) { close(); }
      }, GRACE);
    }
    function focusInside(card) {
      var active = document.activeElement;
      return !!(active && card.contains(active));
    }
    /* the reference's scroll hint: the fade shows only while there is more
       card below the fold */
    function hint(card) {
      var more = card.scrollHeight - card.clientHeight - card.scrollTop > 2;
      card.classList.toggle("scroll-hint", more);
    }
    function wireCard(card) {
      if (card.__ttWired) { return; }
      card.__ttWired = true;
      function enter(event) {
        if (event && event.pointerType && event.pointerType !== "mouse") { return; }
        overCard = true;
        cancelGrace();
      }
      function leave(event) {
        if (event && event.pointerType && event.pointerType !== "mouse") { return; }
        overCard = false;
        if (pinned || !open || open.card !== card) { return; }
        var to = event && event.relatedTarget;
        /* back onto the anchor: its own enter keeps the card, no flicker */
        if (to && to.nodeType === 1 && open.anchor.contains(to)) { return; }
        if (focusInside(card)) { return; }
        close();
      }
      card.addEventListener("pointerenter", enter);
      card.addEventListener("mouseenter", enter);
      card.addEventListener("pointerleave", leave);
      card.addEventListener("mouseleave", leave);
      /* a wheel over the card scrolls the card and nothing underneath it:
         not the page, not a planner's wheel-zoom */
      card.addEventListener("wheel", function (event) {
        event.stopPropagation();
        var atTop = card.scrollTop <= 0 && event.deltaY < 0;
        var atEnd = card.scrollTop + card.clientHeight >= card.scrollHeight - 1 &&
                    event.deltaY > 0;
        if (card.scrollHeight <= card.clientHeight + 1 || atTop || atEnd) {
          event.preventDefault();
        }
      }, { passive: false });
      card.addEventListener("scroll", function () { hint(card); });
    }

    function place() {
      if (!open) { return; }
      var card = open.card;
      if (window.innerWidth <= SHEET_WIDTH) {
        card.classList.add("sheet");
        card.style.left = "";
        card.style.top = "";
        return;
      }
      card.classList.remove("sheet");
      /* positioned against `box`, which is the anchor itself everywhere
         except the codex, where the anchor is the whole result row: a card
         placed beside a row that spans the page has nowhere to go but on top
         of it, so that page hands over the row's name instead. */
      var anchor = open.box.getBoundingClientRect();
      var box = card.getBoundingClientRect();
      /* flip to the other side when the card would leave the viewport, and
         clamp rather than overflow when neither side fits */
      var left = anchor.right + GAP;
      if (left + box.width > window.innerWidth - GAP) {
        left = anchor.left - box.width - GAP;
      }
      if (left < GAP) {
        left = Math.max(GAP, (window.innerWidth - box.width) / 2);
      }
      var top = anchor.top;
      if (top + box.height > window.innerHeight - GAP) {
        top = window.innerHeight - box.height - GAP;
      }
      if (top < GAP) { top = GAP; }
      card.style.left = Math.round(left) + "px";
      card.style.top = Math.round(top) + "px";
    }

    function close() {
      cancelGrace();
      overCard = false;
      if (!open) { return; }
      open.card.hidden = true;
      open.card.classList.remove("sheet", "scroll-hint");
      open.card.style.left = "";
      open.card.style.top = "";
      if (open.home && open.card.parentNode !== open.home) {
        open.home.appendChild(open.card);
      }
      /* only where the generator declared it: on the boss page the anchor is
         a button that already `aria-controls` its cross-reference panel, and
         an `aria-expanded` there would be a claim about that panel */
      if (open.anchor.hasAttribute("aria-expanded")) {
        open.anchor.setAttribute("aria-expanded", "false");
      }
      open = null;
      pinned = false;
    }

    function show(anchor, opts) {
      var card = byId(anchor.getAttribute("data-tt"));
      if (!card) { return; }
      if (open && open.card === card) { cancelGrace(); place(); return; }
      close();
      wireCard(card);
      /* the layer lives at the end of the page; while a planner is in real
         fullscreen only that element paints, so the card is parented under it
         for as long as it is open (no transformed ancestor in between: the
         fullscreen element is the frame itself, so `fixed` stays viewport) */
      var home = card.parentNode;
      var fs = document.fullscreenElement;
      if (fs && !fs.contains(card)) { fs.appendChild(card); }
      card.hidden = false;
      if (anchor.hasAttribute("aria-expanded")) {
        anchor.setAttribute("aria-expanded", "true");
      }
      open = { anchor: anchor, card: card, home: home,
               box: (opts && opts.box) || anchor };
      card.scrollTop = 0;
      place();
      hint(card);
    }

    /* `opts.box`    the element the card is positioned beside, when that is
                     not the anchor itself.
       `opts.click`  what a click on the anchor does, for the two pages whose
                     anchors already own their click:
                       "toggle" (default) pin the card, click again to close;
                       "close"  the anchor's own action answers the same
                                question (a codex row opens the full entry),
                                so the card gets out of the way;
                       "ignore" the page drives the card itself through
                                TT.pin() / TT.close(), so that the card and
                                whatever else the click toggles can never end
                                up in opposite states. */
    function attach(anchor, opts) {
      var onClick = (opts && opts.click) || "toggle";
      /* mouseenter as well as pointerenter: a pointer event carries the input
         type, but not every browser (or automation harness) sends one, and a
         hover that does nothing is the one failure this feature cannot have.
         show() is idempotent, so both firing is harmless. */
      function enter(event) {
        if (event && event.pointerType && event.pointerType !== "mouse") { return; }
        show(anchor, opts);
      }
      function leave(event) {
        if (event && event.pointerType && event.pointerType !== "mouse") { return; }
        if (pinned || !open) { return; }
        var to = event && event.relatedTarget;
        if (to && to.nodeType === 1 && open.card.contains(to)) { return; }
        scheduleClose();
      }
      anchor.addEventListener("pointerenter", enter);
      anchor.addEventListener("pointerleave", leave);
      anchor.addEventListener("mouseenter", enter);
      anchor.addEventListener("mouseleave", leave);
      if (onClick !== "ignore") {
        anchor.addEventListener("click", function () {
          if (onClick === "close") { close(); return; }
          if (open && open.anchor === anchor && pinned) { close(); return; }
          show(anchor, opts);
          pinned = true;
        });
      }
      anchor.addEventListener("focus", function () {
        if (restoring) { return; }
        var visible = true;
        try { visible = anchor.matches(":focus-visible"); } catch (err) { visible = true; }
        if (visible) {
          show(anchor, opts);
          if (onClick === "toggle") { pinned = true; }
        }
      });
      anchor.addEventListener("blur", function () {
        /* a click on the card's own scrollbar blurs the anchor: the card
           under the pointer stays */
        if (overCard) { return; }
        close();
      });
      anchor.__ttOpts = opts || null;
    }

    all(".tt-anchor[data-tt]").forEach(function (anchor) { attach(anchor); });
    TT = {
      attach: attach,
      close: close,
      /* open and keep it open, for a page driving its own click */
      pin: function (anchor) {
        show(anchor, anchor.__ttOpts);
        if (open) { pinned = true; }
      }
    };

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !open) { return; }
      var anchor = open.anchor;
      /* Focus is handed back only where it was already inside this tooltip --
         a keyboard-opened (or clicked) card, or focus sitting in the card
         itself. A card opened by hover never took focus, and focusing its
         anchor on the way out would both steal focus from wherever the reader
         actually is and re-open the card (the focus handler treats it as a
         keyboard entry). `restoring` covers the case where the browser still
         emits a focus event for the programmatic call. */
      var inside = document.activeElement === anchor ||
                   open.card.contains(document.activeElement);
      close();
      if (inside) {
        restoring = true;
        try { anchor.focus(); } finally { restoring = false; }
      }
    });
    document.addEventListener("click", function (event) {
      if (!open || !pinned) { return; }
      if (open.anchor.contains(event.target) || open.card.contains(event.target)) { return; }
      close();
    });
    /* a burst of resize/scroll events repositions the card once per frame */
    var placing = false;
    function placeSoon() {
      if (placing || !open) { return; }
      placing = true;
      window.requestAnimationFrame(function () { placing = false; place(); });
    }
    window.addEventListener("resize", placeSoon);
    document.addEventListener("scroll", function (event) {
      if (!open) { return; }
      /* scrolling inside the card itself must not move it */
      if (event.target && event.target.nodeType === 1 &&
          open.card.contains(event.target)) { return; }
      placeSoon();
    }, true);
  })();

  /* ---------------------------- video facades ----------------------------- */
  /* Policy (spec addendum #9, CLAUDE.md, .claude/agents/web-dev.md): a creator
     video ships as a facade the generator draws itself. No request reaches
     YouTube - no iframe, no thumbnail, no preconnect - until the visitor
     presses play. Only then is a youtube-nocookie embed built, from an id
     re-validated here. Everything else on the site stays self-contained. */
  (function videoFacades() {
    var VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;
    all(".vplay[data-video]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-video") || "";
        if (!VIDEO_ID.test(id)) { return; }
        var wrap = button.parentNode;
        if (!wrap) { return; }
        var frame = document.createElement("div");
        frame.className = "vframe";
        var iframe = document.createElement("iframe");
        iframe.setAttribute(
          "src",
          "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0");
        iframe.setAttribute("title", button.getAttribute("data-title") || "Creator video");
        iframe.setAttribute(
          "allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture");
        iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        iframe.setAttribute("allowfullscreen", "");
        iframe.setAttribute("loading", "lazy");
        frame.tabIndex = -1;
        wrap.setAttribute("aria-busy", "true");
        iframe.addEventListener("load", function () { wrap.removeAttribute("aria-busy"); });
        frame.appendChild(iframe);
        wrap.replaceChild(frame, button);
        /* the play button just left the document; focus stays on the video */
        frame.focus();
      });
    });
  })();

  /* ------------------------------ copy buttons ---------------------------- */
  (function copyButtons() {
    function fallbackCopy(text) {
      var field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      document.body.removeChild(field);
      return ok;
    }

    /* one live region announces every copy result to a screen reader */
    var copyStatus = null;
    function announce(text) {
      if (!copyStatus) {
        copyStatus = document.createElement("span");
        copyStatus.className = "vh";
        copyStatus.setAttribute("role", "status");
        document.body.appendChild(copyStatus);
      }
      copyStatus.textContent = "";
      window.setTimeout(function () { copyStatus.textContent = text; }, 0);
    }
    all(".copy[data-copy]").forEach(function (button) {
      var label = button.textContent;
      button.addEventListener("click", function () {
        var text = button.getAttribute("data-copy") || "";
        /* the Share button copies the page it is on; the URL is not known
           at generate time and is never baked into the page */
        if (button.hasAttribute("data-copy-location")) { text = window.location.href; }
        function done(ok) {
          button.textContent = ok ? "Copied" : "Copy failed";
          announce(ok ? "Link copied to the clipboard" : "Copy failed");
          window.setTimeout(function () { button.textContent = label; }, 1600);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () { done(true); },
            function () { done(fallbackCopy(text)); });
          return;
        }
        done(fallbackCopy(text));
      });
    });
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
      /* a filter can hide the row a card is pinned to; the card would then be
         floating beside nothing */
      if (TT) { TT.close(); }
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
      /* Task 46: the same button is the handle on the drop's in-game card,
         where the game database publishes one. The card is opened from here
         rather than by the tooltip's own click handler ("ignore"), so that
         one tap opens the card and the cross-reference together and the next
         closes both -- two independent toggles on one button drift out of
         phase the moment a reader dismisses one of them on its own (Escape,
         or a click anywhere else). Hover and keyboard focus are unaffected:
         they still open the card and nothing else. */
      var carded = TT && btn.getAttribute("data-tt");
      if (carded) { TT.attach(btn, { click: "ignore" }); }
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-item");
        if (selected === key) {
          clear();
          if (carded) { TT.close(); }
        } else {
          select(key, true);
          if (carded) { TT.pin(btn); }
        }
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
    function fromHash() {
      var hash = window.location.hash;
      if (hash.indexOf("#item-") !== 0) { return; }
      var card = byId(hash.slice(1));
      if (card) { select(card.getAttribute("data-item"), true); }
    }
    fromHash();
    /* an in-page "#item-…" link or an edited hash selects too */
    window.addEventListener("hashchange", fromHash);
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
      size = size ? " " + size : "";
      if (entry.icon) {
        plate.className = "icon" + size;
        var img = document.createElement("img");
        img.setAttribute("src", ICON_BASE + entry.icon);
        img.setAttribute("alt", "");
        img.setAttribute("loading", "lazy");
        img.setAttribute("decoding", "async");
        plate.appendChild(img);
      } else {
        plate.className = "icon" + size + " ph";
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

    /* ---- the in-game card behind an item or aspect result (Task 46) ----
       Every other page ships its cards rendered by build_site.py's
       `gamedata_card()`. This page cannot: its rows are built here, so the
       cards are too, out of the entry that is already in hand -- the entry's
       own name, its rarity (for an item the `kind` *is* the rarity), its
       classes, and the power and flavour lines out of its detail rows. The
       shard adds only `card.type` and `card.level`, the two facts an entry
       does not otherwise carry. Same markup, same CSS, same controller as
       the rendered ones, and still nothing but textContent. */
    var CARD_POWER = "Power";    /* build_site.py: CARD_POWER_LABEL */
    var CARD_FLAVOR = "Flavor";  /* build_site.py: CARD_FLAVOR_LABEL */
    var RARITY_LABEL = {
      common: "Common", magic: "Magic", rare: "Rare", legendary: "Legendary",
      set: "Set", unique: "Unique", mythic: "Mythic Unique"
    };
    var CLASS_COUNT = (DATA.classes || []).length;
    var layer = byId("tt-layer");
    var cards = {};
    var cardSeq = 0;

    function titleCase(text) {
      return String(text || "").replace(/[_-]+/g, " ")
        .replace(/\b[a-z]/g, function (ch) { return ch.toUpperCase(); });
    }

    function line(parent, cls, text, slots, tag) {
      var node = document.createElement(tag || "p");
      node.className = cls;
      if (slots) { withSlots(node, text); } else { node.textContent = text; }
      parent.appendChild(node);
      return node;
    }

    function cardNode(entry) {
      var id = key(entry.domain, entry.id);
      if (cards[id]) { return cards[id]; }
      var spec = entry.card || {};
      var rarity = spec.rarity || entry.kind || "";
      var card = document.createElement("div");
      card.className = "tt-card r-" + (String(rarity).toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") || "unknown");
      card.id = "tt-cx-" + (++cardSeq);
      card.setAttribute("role", "tooltip");
      card.hidden = true;

      var plate = document.createElement("span");
      plate.className = "tt-icon";
      plate.appendChild(iconNode(entry, ""));
      card.appendChild(plate);

      line(card, "tt-name", entry.name, true);
      line(card, "tt-rarity",
           [RARITY_LABEL[rarity] || titleCase(rarity), spec.type || ""]
             .filter(function (part) { return !!part; }).join(" "));

      /* the same shape the generator's item_card() writes: the effect as
         bullets, then the flavour, then the foot line (level, class) */
      var powers = document.createElement("div");
      powers.className = "tt-unique";
      var effects = document.createElement("ul");
      effects.className = "tt-effects";
      powers.appendChild(effects);
      var flavor = null;
      (entry.detail || []).forEach(function (pair) {
        if (pair[0] === CARD_POWER) { line(effects, "tt-power", pair[1], true, "li"); }
        else if (pair[0] === CARD_FLAVOR && flavor === null) { flavor = pair[1]; }
      });
      if (effects.childNodes.length) { card.appendChild(powers); }
      if (flavor) { line(card, "tt-flavor", flavor); }

      /* printed only where the database publishes it -- never invented */
      var foot = document.createElement("div");
      foot.className = "tt-foot";
      if (spec.level) { line(foot, "tt-req", "Requires Level " + spec.level, false, "span"); }
      var classes = entry.classes || [];
      if (classes.length && classes.length < CLASS_COUNT) {
        line(foot, "tt-class", classes.map(titleCase).join(", "), false, "span");
      }
      if (foot.childNodes.length) { card.appendChild(foot); }
      cards[id] = card;
      return card;
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

      /* An item or aspect result is a handle on the game's own card. The row
         itself is the anchor: a <button> inside this <a> would be invalid
         markup and a second tab stop for the same thing. The card opens
         beside the row's *name*, because a row that spans the page has no
         side left to open on. And clicking a row means "open this entry",
         which the detail panel answers with the same facts and more, so the
         click hands over rather than pinning a card on top of it. */
      if (entry.card && layer && TT) {
        var card = cardNode(entry);
        row.setAttribute("data-tt", card.id);
        row.setAttribute("aria-describedby", card.id);
        TT.attach(row, { box: name, click: "close" });
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

      /* every row is about to be replaced, and one of them may be the anchor
         of the open card */
      if (TT) { TT.close(); }
      var frag = document.createDocumentFragment();
      var deck = document.createDocumentFragment();
      var shown = Math.min(hits.length, LIMIT);
      for (var j = 0; j < shown; j++) {
        frag.appendChild(rowNode(hits[j][1]));
        if (hits[j][1].card && layer) { deck.appendChild(cardNode(hits[j][1])); }
      }
      results.replaceChildren(frag);
      /* the layer holds cards for the rows on screen and no others. A card is
         built once per entry and cached, so this moves nodes rather than
         rebuilding them, and an entry scrolled out of the result list takes
         its card out of the document with it. */
      if (layer) { layer.replaceChildren(deck); }

      if (status) {
        var loading = done < shards.length
          ? " \u2014 loading the index (" + done + "/" + shards.length + ")\u2026" : "";
        if (!entries.length) {
          status.textContent = failed && done >= shards.length
            ? "The codex index could not be loaded \u2014 reload the page to try again."
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
    /* --- fullscreen: the API when it is granted, a fixed overlay when not --- */
    function wireFullscreen(view, btn) {
      /* the reference's bar draws the button as an icon; the label then
         lives in a visually-hidden span so the icon survives the repaint */
      var label = btn.querySelector("[data-fs-label]");
      function paint() {
        var on = document.fullscreenElement === view || view.classList.contains("is-fs");
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        (label || btn).textContent = on ? "Exit fullscreen" : "Fullscreen";
      }
      function fallbackOn() {
        view.classList.add("is-fs");
        paint();
        /* the overlay covers the page: focus moves into it so Tab and
           Escape act on the view rather than on what it hides */
        if (view.focus) { view.focus(); }
      }
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
      /* Escape leaves the fallback overlay, matching what the real API does;
         listened for on the document so it works wherever focus ended up */
      document.addEventListener("keydown", function (event) {
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
      /* `canvas` is one canvas or, for a frame's bar, every canvas under it */
      var canvases = Array.isArray(canvas) ? canvas : [canvas];
      function apply() {
        var q = (input.value || "").trim().toLowerCase();
        if (!q) {
          canvases.forEach(function (c) { c.classList.remove("searching"); });
          nodes.forEach(function (n) { n.classList.remove("hit"); });
          hits.textContent = "";
          return;
        }
        var found = 0;
        nodes.forEach(function (n) {
          var hay = (n.getAttribute("title") || n.getAttribute("aria-label") || "").toLowerCase();
          var on = hay.indexOf(q) !== -1;
          n.classList.toggle("hit", on);
          if (on) { found++; }
        });
        canvases.forEach(function (c) { c.classList.add("searching"); });
        hits.textContent = found + (found === 1 ? " match" : " matches");
        if (!found) { hits.textContent = "no " + noun + " matched"; }
      }
      input.addEventListener("input", apply);
      input.addEventListener("search", apply);
      apply();
    }

    function wireToggle(btn, target, cls) {
      if (!btn) { return; }
      btn.addEventListener("click", function () {
        var on = btn.getAttribute("aria-pressed") !== "true";
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        target.classList.toggle(cls, on);
      });
    }

    /* --- the paragon planner (fix wave 2): ONE viewport per stage holding
       every board of the build. The planner is a single absolutely
       positioned box moved with one transform: drag (or the arrow keys) to
       pan, wheel, +/- or the corner stepper to zoom, the bar's glyph chips
       to glide to a board. The chip over the viewport always names the board
       nearest its centre. Nothing here builds markup: the chip is updated
       with textContent from data the generator put on the boards. --- */
    all("[data-pview]").forEach(function (view) {
      var wrap = view.querySelector(".pwrap");
      var planner = view.querySelector("[data-pplanner]");
      if (!wrap || !planner) { return; }
      var boards = all(".pboard", planner);
      var frame = view.closest("[data-bp-frame]");
      var chips = frame ? all(".bp-glyph-group[data-board]", frame) : [];
      var jumps = frame ? all(".pnote-jump[data-board]", frame) : [];
      var chipOrd = view.querySelector("[data-chip-ord]");
      var chipName = view.querySelector("[data-chip-name]");
      var chipGlyph = view.querySelector("[data-chip-glyph]");
      var label = view.querySelector("[data-zoomlabel]");
      var BOARD = 1255, PAD = 10, OPEN = 0.8, PMIN = 0.25, PMAX = 2, PAN = 60;
      var scale = OPEN, tx = 0, ty = 0, current = -1, framed = false;

      function boardXY(board) {
        var bx = parseFloat(board.style.getPropertyValue("--bx")) || 0;
        var by = parseFloat(board.style.getPropertyValue("--by")) || 0;
        return [bx * BOARD, by * BOARD];
      }
      function nearest() {
        var cx = wrap.clientWidth / 2, cy = wrap.clientHeight / 2;
        var best = -1, bestD = Infinity;
        boards.forEach(function (board, i) {
          var xy = boardXY(board);
          var x = (xy[0] + BOARD / 2) * scale + tx;
          var y = (xy[1] + BOARD / 2) * scale + ty;
          var d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (d < bestD) { bestD = d; best = i; }
        });
        return best;
      }
      function nameBoard(i) {
        if (i === current || !boards[i]) { return; }
        current = i;
        var board = boards[i];
        if (chipOrd) { chipOrd.textContent = board.getAttribute("data-ord") || String(i + 1); }
        if (chipName) { chipName.textContent = board.getAttribute("data-board-name") || ""; }
        if (chipGlyph) {
          var glyph = board.getAttribute("data-glyph") || "";
          chipGlyph.textContent = glyph ? "(" + glyph + ")" : "";
        }
        chips.forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-board") === String(i) ? "true" : "false");
        });
      }
      function paint(glide) {
        planner.classList.toggle("gliding", !!glide);
        planner.style.transform = "translate(" + tx + "px, " + ty + "px) scale(" + scale + ")";
        if (label) { label.textContent = Math.round(scale * 100) + "%"; }
        nameBoard(nearest());
      }
      /* the reference's framing: the board centred, its top edge just under
         the viewport's top, so the chip sits over the board's frame */
      function frameBoard(i, glide) {
        var board = boards[i];
        if (!board || !wrap.clientWidth) { return; }
        var xy = boardXY(board);
        tx = wrap.clientWidth / 2 - (xy[0] + BOARD / 2) * scale;
        ty = PAD - xy[1] * scale;
        paint(glide);
      }
      function clampScale(z) { return Math.min(PMAX, Math.max(PMIN, Math.round(z * 100) / 100)); }
      /* zoom about a viewport point, so what is under the pointer stays put */
      function zoomAt(factor, px, py) {
        var next = clampScale(scale * factor);
        if (next === scale) { return; }
        tx = px - (px - tx) * (next / scale);
        ty = py - (py - ty) * (next / scale);
        scale = next;
        paint(false);
      }
      function zoomCentre(factor) { zoomAt(factor, wrap.clientWidth / 2, wrap.clientHeight / 2); }
      function reset() { scale = OPEN; frameBoard(0, true); }

      /* opening view: the start board, once the viewport has a size (a
         hidden tab panel has none yet) */
      function open() {
        if (framed || !wrap.clientWidth) { return; }
        framed = true;
        frameBoard(0, false);
      }
      open();
      if (!framed && window.ResizeObserver) {
        var ro = new ResizeObserver(function () { open(); if (framed) { ro.disconnect(); } });
        ro.observe(wrap);
      } else if (!framed) {
        document.addEventListener("click", open, true);
      }

      all("[data-zoom]", view).forEach(function (btn) {
        var kind = btn.getAttribute("data-zoom");
        btn.addEventListener("click", function () {
          if (kind === "reset") { reset(); }
          else { zoomCentre(kind === "in" ? 1.2 : 1 / 1.2); }
        });
      });
      wrap.addEventListener("wheel", function (event) {
        event.preventDefault();
        var box = wrap.getBoundingClientRect();
        zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - box.left, event.clientY - box.top);
      }, { passive: false });

      /* drag to pan */
      var live = false, id = null, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
      wrap.addEventListener("pointerdown", function (event) {
        /* a tile is a button too (its card's anchor), and most of a board is
           tiles: a drag may start on one -- only the bar's own controls are
           exempt */
        if (event.button !== 0 || event.target.closest("button:not(.pnode), a, input")) { return; }
        live = true; moved = false;
        id = event.pointerId;
        sx = event.clientX; sy = event.clientY; ox = tx; oy = ty;
        planner.classList.remove("gliding");
      });
      wrap.addEventListener("pointermove", function (event) {
        if (!live || event.pointerId !== id) { return; }
        var dx = event.clientX - sx, dy = event.clientY - sy;
        if (!moved && Math.abs(dx) + Math.abs(dy) > 4) {
          moved = true;
          wrap.classList.add("dragging");
          try { wrap.setPointerCapture(id); } catch (err) { /* not capturable */ }
        }
        if (!moved) { return; }
        tx = ox + dx; ty = oy + dy;
        paint(false);
      });
      var dragged = false;
      function stop(event) {
        if (!live || (event && event.pointerId !== id)) { return; }
        live = false;
        dragged = moved;
        wrap.classList.remove("dragging");
        try { wrap.releasePointerCapture(id); } catch (err) { /* already gone */ }
      }
      wrap.addEventListener("pointerup", stop);
      wrap.addEventListener("pointercancel", stop);
      /* the click a drag ends on must not pin the tile's card */
      wrap.addEventListener("click", function (event) {
        if (!dragged) { return; }
        dragged = false;
        event.stopPropagation();
        event.preventDefault();
      }, true);

      /* keyboard: arrows pan, +/- zoom, 0 resets */
      wrap.addEventListener("keydown", function (event) {
        var key = event.key;
        var handled = true;
        if (key === "ArrowLeft") { tx += PAN; }
        else if (key === "ArrowRight") { tx -= PAN; }
        else if (key === "ArrowUp") { ty += PAN; }
        else if (key === "ArrowDown") { ty -= PAN; }
        else if (key === "+" || key === "=") { zoomCentre(1.2); return; }
        else if (key === "-" || key === "_") { zoomCentre(1 / 1.2); return; }
        else if (key === "0") { reset(); return; }
        else { handled = false; }
        if (!handled) { return; }
        event.preventDefault();
        paint(false);
      });

      /* the glyph chips and the notes' board buttons glide to their board */
      chips.concat(jumps).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var i = parseInt(btn.getAttribute("data-board"), 10);
          if (isNaN(i)) { return; }
          if (!framed) { open(); }
          frameBoard(i, true);
          if (btn.classList.contains("pnote-jump")) { wrap.focus(); }
        });
      });
      /* a stage or tab that was hidden when the page loaded opens on the start
         board the first time it gets a size (the fallback above) */
      document.addEventListener("fullscreenchange", function () {
        if (current >= 0) { frameBoard(current, false); }
      });
    });

    /* --- one planner for three trees (the mercenary's, the class skill
       tree, every war plan): the paragon's mechanics on a viewport holding
       one canvas -- opens fitted (to the canvas's `data-fit` box when the
       generator wrote one, else to the whole canvas) and centred, drag or
       the arrow keys pan, wheel / +/- / the corner stepper zoom, 0 refits.
       The wrapper is watched for size changes, so a tree inside a hidden
       plan pane or a fullscreen frame fits itself the moment it is shown. --- */
    function wirePlanner(view, wrap, planner) {
      var label = view.querySelector("[data-zoomlabel]");
      var tw = parseFloat(planner.style.getPropertyValue("--tw")) || 1;
      var th = parseFloat(planner.style.getPropertyValue("--th")) || 1;
      var PMIN = 0.2, PMAX = 2.5, PAN = 60;
      var scale = 1, tx = 0, ty = 0, framed = false;
      var box = null;
      var fitAttr = (planner.getAttribute("data-fit") || "").split(" ").map(parseFloat);
      if (fitAttr.length === 4 && fitAttr.every(function (n) { return !isNaN(n); })
          && fitAttr[2] > fitAttr[0] && fitAttr[3] > fitAttr[1]) {
        box = { x: fitAttr[0], y: fitAttr[1], w: fitAttr[2] - fitAttr[0], h: fitAttr[3] - fitAttr[1] };
      } else {
        box = { x: 0, y: 0, w: tw, h: th };
      }

      function paint() {
        planner.style.transform = "translate(" + tx + "px, " + ty + "px) scale(" + scale + ")";
        if (label) { label.textContent = Math.round(scale * 100) + "%"; }
      }
      function fit() {
        var w = wrap.clientWidth, h = wrap.clientHeight;
        if (!w || !h) { return; }
        scale = Math.min(1, (w - 40) / box.w, (h - 40) / box.h);
        scale = Math.max(PMIN, Math.round(scale * 100) / 100);
        tx = (w - box.w * scale) / 2 - box.x * scale;
        ty = (h - box.h * scale) / 2 - box.y * scale;
        paint();
      }
      function clampScale(z) { return Math.min(PMAX, Math.max(PMIN, Math.round(z * 100) / 100)); }
      function zoomAt(factor, px, py) {
        var next = clampScale(scale * factor);
        if (next === scale) { return; }
        tx = px - (px - tx) * (next / scale);
        ty = py - (py - ty) * (next / scale);
        scale = next;
        paint();
      }
      function zoomCentre(factor) { zoomAt(factor, wrap.clientWidth / 2, wrap.clientHeight / 2); }

      var lastW = 0, lastH = 0;
      /* the class tree opens as the reference does: at 1:1 (60% on a
         narrow screen) centred on the main cluster's hub, whose position the
         generator wrote in data-open-at; Reset, 0 and fullscreen refit */
      var openAt = (planner.getAttribute("data-open-at") || "").split(" ").map(parseFloat);
      if (openAt.length !== 2 || openAt.some(function (n) { return isNaN(n); })) { openAt = null; }
      function openOnCluster() {
        var w = wrap.clientWidth, h = wrap.clientHeight;
        scale = w < 480 ? 0.6 : 1;
        tx = w / 2 - openAt[0] * scale;
        ty = h / 2 - openAt[1] * scale;
        paint();
      }
      function open() {
        if (!wrap.clientWidth) { return; }
        if (framed && wrap.clientWidth === lastW && wrap.clientHeight === lastH) { return; }
        var first = !framed;
        framed = true;
        lastW = wrap.clientWidth;
        lastH = wrap.clientHeight;
        if (first && openAt && !document.fullscreenElement && !view.classList.contains("is-fs")) { openOnCluster(); }
        else { fit(); }
      }
      open();
      if (window.ResizeObserver) {
        new ResizeObserver(function () { open(); }).observe(wrap);
      } else if (!framed) {
        document.addEventListener("click", open, true);
      }

      all("[data-zoom]", view).forEach(function (btn) {
        var kind = btn.getAttribute("data-zoom");
        btn.addEventListener("click", function () {
          if (kind === "reset") { fit(); }
          else { zoomCentre(kind === "in" ? 1.2 : 1 / 1.2); }
        });
      });
      wrap.addEventListener("wheel", function (event) {
        event.preventDefault();
        var rect = wrap.getBoundingClientRect();
        zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - rect.left, event.clientY - rect.top);
      }, { passive: false });

      var live = false, id = null, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
      wrap.addEventListener("pointerdown", function (event) {
        /* a node is a button too (its card's anchor): a drag may start on one */
        if (event.button !== 0 || event.target.closest("button:not(.mn):not(.tn), a, input")) { return; }
        live = true; moved = false;
        id = event.pointerId;
        sx = event.clientX; sy = event.clientY; ox = tx; oy = ty;
      });
      wrap.addEventListener("pointermove", function (event) {
        if (!live || event.pointerId !== id) { return; }
        var dx = event.clientX - sx, dy = event.clientY - sy;
        if (!moved && Math.abs(dx) + Math.abs(dy) > 4) {
          moved = true;
          wrap.classList.add("dragging");
          try { wrap.setPointerCapture(id); } catch (err) { /* not capturable */ }
        }
        if (!moved) { return; }
        tx = ox + dx; ty = oy + dy;
        paint();
      });
      var dragged = false;
      function stop(event) {
        if (!live || (event && event.pointerId !== id)) { return; }
        live = false;
        dragged = moved;
        wrap.classList.remove("dragging");
        try { wrap.releasePointerCapture(id); } catch (err) { /* already gone */ }
      }
      wrap.addEventListener("pointerup", stop);
      wrap.addEventListener("pointercancel", stop);
      wrap.addEventListener("click", function (event) {
        if (!dragged) { return; }
        dragged = false;
        event.stopPropagation();
        event.preventDefault();
      }, true);
      wrap.addEventListener("keydown", function (event) {
        var key = event.key;
        var handled = true;
        if (key === "ArrowLeft") { tx += PAN; }
        else if (key === "ArrowRight") { tx -= PAN; }
        else if (key === "ArrowUp") { ty += PAN; }
        else if (key === "ArrowDown") { ty -= PAN; }
        else if (key === "+" || key === "=") { zoomCentre(1.2); return; }
        else if (key === "-" || key === "_") { zoomCentre(1 / 1.2); return; }
        else if (key === "0") { fit(); return; }
        else { handled = false; }
        if (!handled) { return; }
        event.preventDefault();
        paint();
      });
      document.addEventListener("fullscreenchange", function () { if (framed) { fit(); } });
    }

    all("[data-mview]").forEach(function (view) {
      var wrap = view.querySelector(".mwrap");
      var planner = view.querySelector("[data-mplanner]");
      if (!wrap || !planner) { return; }
      wirePlanner(view, wrap, planner);
    });

    /* the class skill tree and every war plan tree: the planner above, plus
       the tree's own search field and allocation-only toggle where the bar
       carries them (the war plans' bar searches every tree from one field) */
    all("[data-tview]").forEach(function (view) {
      var wrap = view.querySelector(".twrap");
      var canvas = view.querySelector("[data-tplanner]");
      if (!wrap || !canvas) { return; }
      var input = view.querySelector("[data-find]");
      var hits = view.querySelector("[data-hits]");
      var nodes = all(".tn", canvas);
      if (input && hits) { wireSearch(input, hits, canvas, nodes, "nodes"); }
      wirePlanner(view, wrap, canvas);
      var fs = view.querySelector("[data-fullscreen]");
      if (fs && fs.closest("[data-bp-frame], [data-tview], [data-pview]") === view) {
        wireFullscreen(view, fs);
      }
      wireToggle(view.querySelector("[data-alloconly]"), canvas, "alloc-only");
    });

    /* --- the panel-level bar (spec 3.4): one search field over several
       canvases mirrors its text into each canvas's own search input -- the
       same wireSearch above does the work -- and one fullscreen button takes
       the whole frame --- */
    all("[data-find-all]").forEach(function (input) {
      var frame = input.closest("[data-bp-frame]") || document;
      var hits = input.parentNode.parentNode.querySelector("[data-hits]");
      var canvases = all(".tcanvas, .pgrid", frame);
      canvases = canvases.concat(all(".mplanner", frame));
      var nodes = all(".tn, .pnode, .mn", frame);
      if (hits && canvases.length) { wireSearch(input, hits, canvases, nodes, "nodes"); }
    });
    all("[data-bp-frame]").forEach(function (frame) {
      var bar = frame.querySelector(".bp-bar");
      var fs = bar ? bar.querySelector("[data-fullscreen]") : null;
      if (fs && fs.closest("[data-bp-frame], [data-tview], [data-pview]") === frame) {
        wireFullscreen(frame, fs);
      }
    });

    /* --- the war plans' plan tabs: every activity's tree is pre-rendered;
       a tab only decides which one is not hidden --- */
    all(".wp-tabs").forEach(function (row) {
      var frame = row.closest("[data-bp-frame]");
      if (!frame) { return; }
      var tabs = all(".wp-tab", row);
      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          var key = tab.getAttribute("data-wp");
          tabs.forEach(function (t) {
            t.setAttribute("aria-pressed", t === tab ? "true" : "false");
          });
          all("[data-wp-panel]", frame).forEach(function (panel) {
            panel.hidden = panel.getAttribute("data-wp-panel") !== key;
          });
          /* the bar's count chip follows the open plan */
          all("[data-wp-count]", frame).forEach(function (chip) {
            chip.hidden = chip.getAttribute("data-wp-count") !== key;
          });
        });
      });
    });
  })();
})();
