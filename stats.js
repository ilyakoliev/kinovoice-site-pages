/* Статистика kinovoice.com: PostHog без cookies. Исходник: src/lib/posthog.ts, описание: /privacy/. */
(function () {
  var KEY = "phc_yjLuzH6w8dew6jZuHMyGvksoZkL5ecQUcZ6jGLsPgrZV", HOST = "https://eu.i.posthog.com", DOMAIN = "kinovoice.com";
  var OFF = "kinovoice-analytics-off", CONSENT = "kinovoice-consent", RUSSIA = true;
  var READ_END_MIN_MS = 15000;
  var root = document.documentElement, LANG = root && root.lang === "en" ? "en" : "ru";
  var UA = navigator.userAgent || "";

  function note(on) {
    var text = LANG === "en" ? "Analytics on this device: " + (on ? "on" : "off") : "Статистика на этом устройстве: " + (on ? "включена" : "выключена");
    function show() {
      var n = document.createElement("p");
      n.setAttribute("role", "status");
      n.textContent = text;
      n.style.cssText = "position:fixed;left:16px;top:16px;z-index:99;margin:0;padding:8px 12px;border-radius:8px;background:#111;color:#fff;font:14px/1.4 system-ui,sans-serif";
      document.body.appendChild(n);
    }
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", show) : show();
  }

  var off = false, stored = null;
  try {
    var m = /[?&]analytics=(on|off)(&|$)/.exec(location.search);
    if (m) {
      if (m[1] === "off") localStorage.setItem(OFF, "1");
      else localStorage.removeItem(OFF);
      note(m[1] === "on");
    }
    off = localStorage.getItem(OFF) === "1";
    stored = localStorage.getItem(CONSENT);
  } catch (e) {}
  if (off || stored === "no" || location.hostname !== DOMAIN) return;
  if (navigator.webdriver || /(^|[^a-z])bot|[a-z]bot[\/;]|crawl|spider|slurp|headless|lighthouse|preview/i.test(UA)) return;

  // Россия: русская версия сайта, российский часовой пояс или русский язык браузера — только после «Принять».
  function fromRussia() {
    if (LANG === "ru") return true;
    var zone = "";
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    if (/^(Europe\/Kaliningrad|Europe\/Moscow|Europe\/Simferopol|Europe\/Kirov|Europe\/Volgograd|Europe\/Astrakhan|Europe\/Saratov|Europe\/Ulyanovsk|Europe\/Samara|Asia\/Yekaterinburg|Asia\/Omsk|Asia\/Novosibirsk|Asia\/Barnaul|Asia\/Tomsk|Asia\/Novokuznetsk|Asia\/Krasnoyarsk|Asia\/Irkutsk|Asia\/Chita|Asia\/Yakutsk|Asia\/Khandyga|Asia\/Vladivostok|Asia\/Ust-Nera|Asia\/Magadan|Asia\/Sakhalin|Asia\/Srednekolymsk|Asia\/Kamchatka|Asia\/Anadyr|W-SU)$/.test(zone)) return true;
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) if (/^ru(-|$)/i.test(langs[i] || "")) return true;
    return false;
  }

  var russian = fromRussia();
  if (russian && !RUSSIA) return;
  var consent = russian ? (stored === "yes" ? "granted" : "") : "not_required";
  var queue = [], ready = false, started = false, viewed = false, T0 = 0, P0 = null, UTM = {};

  if (consent) begin();
  else document.addEventListener("click", function wait(e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest("[data-consent-accept]")) return;
    document.removeEventListener("click", wait);
    consent = "granted";
    begin();
  });

  // Рецензия: рубрика и дата публикации с маркера конца текста (ReviewPage.astro), у остальных страниц их нет.
  function meta() {
    var m = document.querySelector("[data-read-end]"), o = {}, t, d;
    if (m && m.getAttribute) {
      t = m.getAttribute("data-review-type");
      d = m.getAttribute("data-published");
      if (t) o.review_type = t;
      if (d) o.published = d;
    }
    return o;
  }
  function page() { return merge({ $current_url: location.href, $pathname: location.pathname, title: document.title }, meta()); }
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  function track(event, props) {
    if (!event) return;
    if (ready) window.posthog.capture(event, props, { send_instantly: true });
    else queue.push([event, merge(props), Date.now(), page()]);
  }

  // Цели — те же правила, что у Метрики в Analytics.astro: data-goal и data-goal-*, ссылки на t.me и RSS по адресу.
  function goalParams(el) {
    var p = {}, a = el.attributes;
    for (var i = 0; i < a.length; i++) if (a[i].name.indexOf("data-goal-") === 0) p[a[i].name.slice(10)] = a[i].value;
    return p;
  }
  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var marked = t.closest("[data-goal]"), link = t.closest("a[href]");
    if (marked) track(marked.getAttribute("data-goal"), goalParams(marked));
    else if (link) {
      var href = link.getAttribute("href") || "";
      if (/^https?:\/\/(t\.me|telegram\.me)\//.test(href)) track("telegram", { place: "text", href: href });
      else if (/\/rss\.xml$/.test(href)) track("rss");
    }
    // «Лучшее»: переход со страницы раздела в рецензию — /top/, /top/2024/, /top/series/2024/ и страницы фильмов и сериалов.
    var from = /^\/(?:en\/)?top\/(?:(series)\/)?(?:(\d{4})\/(?:([^\/]+)\/?)?)?$/.exec(location.pathname);
    if (!link || !from) return;
    var to = null;
    try { to = new URL(link.href, location.href); } catch (x) {}
    if (to && to.host === location.host && /^\/(en\/)?reviews\/[^\/]+\/?$/.test(to.pathname)) {
      // kind и year — как у остальных событий раздела (src/scripts/top-list.ts); у обложки /top/ их нет.
      var p = { review: to.pathname, from: from[3] ? "film" : from[2] ? "year" : "hub" };
      if (from[2]) { p.year = +from[2]; p.kind = from[1] ? "series" : "films"; }
      track("top_review_click", p);
    }
  }
  // read_end: конец текста попал в экран и со входа на страницу прошло не меньше READ_END_MIN_MS.
  // Ушёл раньше — цели нет: таймер умирает вместе со страницей.
  function sinceOpen() { try { return performance.now(); } catch (e) { return 0; } }
  function watchReadEnd() {
    var marker = document.querySelector("[data-read-end]");
    if (!marker || !("IntersectionObserver" in window)) return;
    var done = false;
    function reached() { if (done) return; done = true; seen.disconnect(); track("read_end"); }
    var seen = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) if (entries[i].isIntersecting) {
        var wait = READ_END_MIN_MS - sinceOpen();
        if (wait > 0) setTimeout(reached, wait); else reached();
        return;
      }
    });
    seen.observe(marker);
  }

  function context() {
    var p = {
      distinct_id: "$posthog_cookieless", $cookieless_mode: true, $raw_user_agent: UA, $lib: "kinovoice-beacon",
      $host: location.host, $referrer: document.referrer || "$direct", $referring_domain: "$direct",
      $screen_width: screen.width, $screen_height: screen.height, $browser_language: navigator.language,
      $device_type: /iPad|Tablet/i.test(UA) ? "Tablet" : /Mobi|Android|iPhone/i.test(UA) ? "Mobile" : "Desktop",
      consent: consent
    };
    try { p.$timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
    try { if (document.referrer) p.$referring_domain = new URL(document.referrer).host; } catch (e) {}
    return merge(p, UTM);
  }
  // Посетитель ушёл до загрузки библиотеки: просмотр и очередь уходят одним запросом.
  function flush() {
    if (ready || !navigator.sendBeacon) return;
    var batch = queue.splice(0);
    if (!viewed) { viewed = true; batch.unshift(["$pageview", {}, T0, P0]); }
    if (!batch.length) return;
    try {
      var base = context();
      var events = batch.map(function (x) { return { event: x[0], properties: merge(merge(base, x[3]), x[1]), timestamp: new Date(x[2]).toISOString() }; });
      navigator.sendBeacon(HOST + "/batch/", new Blob([JSON.stringify({ api_key: KEY, batch: events, sent_at: new Date().toISOString() })], { type: "text/plain" }));
    } catch (e) {}
  }

  function start() {
    if (started) return;
    started = true;
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src="https://eu-assets.i.posthog.com/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    var c = {"ui_host":"https://eu.posthog.com","defaults":"2025-11-30","cookieless_mode":"always","persistence":"memory","person_profiles":"identified_only","autocapture":true,"capture_pageview":false,"capture_pageleave":true,"capture_dead_clicks":false,"capture_heatmaps":false,"disable_session_recording":true,"disable_surveys":true,"advanced_disable_flags":true,"capture_performance":false,"mask_personal_data_properties":true};
    c.api_host = HOST;
    c.loaded = function (ph) {
      ph.register(merge({ consent: consent }, meta()));
      ready = true;
      if (!viewed) { viewed = true; ph.capture("$pageview", P0, { timestamp: new Date(T0) }); }
      var x;
      while ((x = queue.shift())) ph.capture(x[0], merge(x[3], x[1]), { timestamp: new Date(x[2]) });
    };
    window.posthog.init(KEY, c);
  }

  function begin() {
    T0 = Date.now();
    P0 = page();
    try { new URLSearchParams(location.search).forEach(function (v, k) { if (/^utm_/.test(k)) UTM[k] = v; }); } catch (e) {}
    document.addEventListener("click", onClick);
    document.addEventListener("kinovoice:goal", function (e) {
      var d = (e && e.detail) || {}, p = merge(d.params);
      if (d.name === "search") { try { var q = new URLSearchParams(location.search).get("q"); if (q) p.q = q; } catch (x) {} }
      track(d.name, p);
    });
    document.addEventListener("kinovoice:hit", function () { track("$pageview"); });
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", watchReadEnd) : watchReadEnd();
    addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });
    addEventListener("pageshow", function (e) {
      if (!e.persisted) return;
      T0 = Date.now();
      P0 = page();
      if (ready) window.posthog.capture("$pageview", P0);
      else viewed = false;
    });
    function idle() { (window.requestIdleCallback || function (f) { setTimeout(f, 1); })(start, { timeout: 3000 }); }
    document.readyState === "complete" ? idle() : addEventListener("load", idle, { once: true });
  }
})();
