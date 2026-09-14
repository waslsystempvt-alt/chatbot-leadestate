/**
 * LeadEstate Chatbot — direct React mount (no iframe).
 *
 * Deploy on Cloudflare next to chatbot.js. Each microsite pastes one
 * <script> tag and configures via data-* or window.LEADESTATE_EMBED.
 */
(function () {
  if (window.__LEADESTATE_EMBED_LOADED__) return;
  window.__LEADESTATE_EMBED_LOADED__ = true;

  /** Fallback when embed.js is opened via file:// or script src is not https */
  var DEFAULT_CDN = "https://leadestate-chatbot.pages.dev/";

  function findEmbedScript() {
    var byId = document.getElementById("leadestate-embed-script");
    if (byId) return byId;
    if (document.currentScript) return document.currentScript;
    var all = document.getElementsByTagName("script");
    for (var i = all.length - 1; i >= 0; i--) {
      var el = all[i];
      if (!el.src) continue;
      if (el.getAttribute("data-leadestate-embed") === "1" || /embed\.js/i.test(el.src)) {
        return el;
      }
    }
    return all[all.length - 1];
  }

  var script = findEmbedScript();
  var embedCfg = (window.LEADESTATE_EMBED && typeof window.LEADESTATE_EMBED === "object")
    ? window.LEADESTATE_EMBED
    : {};

  function attr(name) {
    var v = script.getAttribute("data-" + name);
    return v == null ? "" : String(v).trim();
  }

  function pick(dataAttrName, embedKeys) {
    var v = attr(dataAttrName);
    if (v !== "") return v;
    var keys = embedKeys || [dataAttrName.replace(/-/g, "")];
    for (var i = 0; i < keys.length; i++) {
      var raw = embedCfg[keys[i]];
      if (raw != null && String(raw).trim() !== "") return String(raw).trim();
    }
    return "";
  }

  function normalizeHex(value) {
    var s = String(value || "").trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(s)) {
      s = s.split("").map(function (c) { return c + c; }).join("");
    }
    return /^[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : "";
  }

  var derivedBase = (function () {
    try {
      var u = new URL(script.src);
      u.pathname = u.pathname.replace(/[^/]*$/, "");
      u.search = "";
      u.hash = "";
      return u.toString();
    } catch (e) {
      return "";
    }
  })();

  var bundleBase = String(pick("src", ["chatSrc", "base"]) || derivedBase).trim();
  if (!/^https?:\/\//i.test(bundleBase)) {
    console.warn(
      "[LeadEstate] Local or invalid embed URL — using CDN:",
      DEFAULT_CDN,
      "(use data-src=\"https://leadestate-chatbot.pages.dev/\" or serve over http://localhost)"
    );
    bundleBase = DEFAULT_CDN;
  }

  function assetUrl(path) {
    return bundleBase.replace(/\/?$/, "/") + path.replace(/^\//, "");
  }

  var chatbotJsUrl = (function () {
    try {
      var u = new URL(script.src);
      if (u.protocol === "http:" || u.protocol === "https:") {
        u.pathname = u.pathname.replace(/[^/]*$/, "") + "chatbot.js";
        u.search = "";
        u.hash = "";
        return u.toString();
      }
    } catch (e) { /* ignore */ }
    return assetUrl("chatbot.js");
  })();

  function buildConfig() {
    var cfg = {};
    var ms = pick("ms", ["ms", "micrositeId"]);
    if (ms) cfg.micrositeId = ms;
    var project = pick("project", ["project", "projectName"]);
    if (project) cfg.projectName = project;
    var broker = pick("broker", ["broker", "brokerName"]);
    if (broker) cfg.brokerName = broker;
    var agent = pick("agent", ["agent", "agentName"]);
    if (agent) cfg.agentName = agent;
    var primary = normalizeHex(pick("primary", ["primary", "color"]));
    if (primary) cfg.theme = { primary: "#" + primary };
    var avatar = pick("avatar", ["avatar", "agentAvatar"]);
    if (avatar && /^https?:\/\//i.test(avatar)) {
      cfg.agentAvatar = avatar;
    } else if (avatar) {
      cfg.agentAvatar = avatar;
    } else {
      cfg.agentAvatar = assetUrl("profile.webp");
    }
    var apiBase = pick("api-base", ["apiBase", "api"]);
    if (apiBase) cfg.apiBase = apiBase;
    var autoOpen = pick("auto-open", ["autoOpen", "autoOpenDelayMs"]);
    if (autoOpen !== "") {
      var n = parseInt(autoOpen, 10);
      if (!isNaN(n) && n >= 0) cfg.autoOpenDelayMs = n;
    }
    try {
      var qs = new URLSearchParams(window.location.search);
      var utm = {};
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach(function (k) {
        var v = qs.get(k);
        if (v) utm[k] = v;
      });
      if (Object.keys(utm).length) cfg.utm = utm;
      cfg.pageUrl = window.location.href;
      cfg.userAgent = navigator.userAgent;
    } catch (e) { /* ignore */ }

    return cfg;
  }

  var redirectUrl = pick("redirect-url", ["redirectUrl", "redirect", "thankYouUrl"]) || "thankyou.html";
  var redirectDelay = parseInt(pick("redirect-delay", ["redirectDelay"]), 10);
  if (isNaN(redirectDelay) || redirectDelay < 0) redirectDelay = 120;

  var gtmEventNames = (pick("gtm-event", ["gtmEvent"]) || "formSubmitted")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var redirected = false;
  var mountConfig = buildConfig();

  function loadChatbotBundle(cb) {
    if (window.LeadEstateChat && typeof window.LeadEstateChat.mount === "function") {
      cb();
      return;
    }
    var s = document.createElement("script");
    s.src = chatbotJsUrl;
    s.async = true;
    s.onload = function () { cb(); };
    s.onerror = function () {
      console.error("[LeadEstate] Failed to load chatbot.js from", s.src);
    };
    document.head.appendChild(s);
  }

  function loadStyles(cb) {
    var cssUrl = chatbotJsUrl.replace(/chatbot\.js(\?.*)?$/i, "chatbot.css");
    var existing = document.querySelector('link[data-leadestate-chat-css="1"]');
    if (existing) {
      cb();
      return;
    }
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    link.setAttribute("data-leadestate-chat-css", "1");
    link.onload = function () { cb(); };
    link.onerror = function () { cb(); };
    document.head.appendChild(link);
  }

  function mountWidget() {
    if (document.querySelector("[data-leadestate-host]")) return;
    if (!window.LeadEstateChat || typeof window.LeadEstateChat.mount !== "function") {
      console.error("[LeadEstate] chatbot.js did not load. Check Network tab for chatbot.js / chatbot.css.");
      return;
    }
    if (!document.body) {
      console.error("[LeadEstate] document.body missing — move the script tag before </body>.");
      return;
    }
    var host = document.createElement("div");
    host.setAttribute("data-leadestate-host", "1");
    document.body.appendChild(host);

    window.LeadEstateChat.mount(host, Object.assign({ embedded: true }, mountConfig));
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  window.addEventListener("message", function (event) {
    var data = event && event.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== "leadestate:lead" || data.ok !== true) return;

    try {
      window.dataLayer = window.dataLayer || [];
      gtmEventNames.forEach(function (name) {
        window.dataLayer.push({
          event: name,
          chatbot_lead: true,
          form_source: "leadestate-chatbot",
          microsite_id: data.micrositeId || "",
          project_name: data.projectName || "",
          phone_number: data.phone || "",
          lead_name: data.name || "",
          configuration: data.configuration || "",
          source_action: data.sourceAction || ""
        });
      });
    } catch (e) { /* ignore */ }

    if (redirectUrl && !redirected) {
      redirected = true;
      var root = document.getElementById("leadestate-chat-root") || document.querySelector("[data-leadestate-host]");
      if (root) {
        root.style.transition = "opacity 0.35s ease";
        root.style.opacity = "0";
      }
      setTimeout(function () { window.location.href = redirectUrl; }, redirectDelay);
    }
  }, false);

  onReady(function () {
    loadChatbotBundle(function () {
      loadStyles(mountWidget);
    });
  });
})();
