/*! Capacitor: https://capacitorjs.com/ - MIT License */
var capacitorExports = function(e) {
  "use strict";
  const t = (e => e.CapacitorPlatforms = (e => {
          const t = new Map;
          t.set("web", {
              name: "web"
          });
          const n = e.CapacitorPlatforms || {
              currentPlatform: {
                  name: "web"
              },
              platforms: t
          };
          return n.addPlatform = (e, t) => {
              n.platforms.set(e, t)
          }, n.setPlatform = e => {
              n.platforms.has(e) && (n.currentPlatform = n.platforms.get(e))
          }, n
      })(e))("undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : "undefined" != typeof window ? window : "undefined" != typeof global ? global : {}),
      n = t.addPlatform,
      r = t.setPlatform;
  var i;
  e.ExceptionCode = void 0, (i = e.ExceptionCode || (e.ExceptionCode = {})).Unimplemented = "UNIMPLEMENTED", i.Unavailable = "UNAVAILABLE";
  class o extends Error {
      constructor(e, t, n) {
          super(e), this.message = e, this.code = t, this.data = n
      }
  }
  const s = t => {
          var n, r, i, s, a;
          const l = t.CapacitorCustomPlatform || null,
              c = t.Capacitor || {},
              d = c.Plugins = c.Plugins || {},
              u = t.CapacitorPlatforms,
              p = (null === (n = null == u ? void 0 : u.currentPlatform) || void 0 === n ? void 0 : n.getPlatform) || (() => null !== l ? l.name : (e => {
                  var t, n;
                  return (null == e ? void 0 : e.androidBridge) ? "android" : (null === (n = null === (t = null == e ? void 0 : e.webkit) || void 0 === t ? void 0 : t.messageHandlers) || void 0 === n ? void 0 : n.bridge) ? "ios" : "web"
              })(t)),
              m = (null === (r = null == u ? void 0 : u.currentPlatform) || void 0 === r ? void 0 : r.isNativePlatform) || (() => "web" !== p()),
              f = (null === (i = null == u ? void 0 : u.currentPlatform) || void 0 === i ? void 0 : i.isPluginAvailable) || (e => {
                  const t = w.get(e);
                  return !!(null == t ? void 0 : t.platforms.has(p())) || !!g(e)
              }),
              g = (null === (s = null == u ? void 0 : u.currentPlatform) || void 0 === s ? void 0 : s.getPluginHeader) || (e => {
                  var t;
                  return null === (t = c.PluginHeaders) || void 0 === t ? void 0 : t.find((t => t.name === e))
              }),
              w = new Map,
              h = (null === (a = null == u ? void 0 : u.currentPlatform) || void 0 === a ? void 0 : a.registerPlugin) || ((t, n = {}) => {
                  const r = w.get(t);
                  if (r) return console.warn(`Capacitor plugin "${t}" already registered. Cannot register plugins twice.`), r.proxy;
                  const i = p(),
                      s = g(t);
                  let a;
                  const u = r => {
                          let d;
                          const u = (...u) => {
                              const p = (async () => (!a && i in n ? a = a = "function" == typeof n[i] ? await n[i]() : n[i] : null !== l && !a && "web" in n && (a = a = "function" == typeof n.web ? await n.web() : n.web), a))().then((n => {
                                  const a = ((n, r) => {
                                      var a, l;
                                      if (!s) {
                                          if (n) return null === (l = n[r]) || void 0 === l ? void 0 : l.bind(n);
                                          throw new o(`"${t}" plugin is not implemented on ${i}`, e.ExceptionCode.Unimplemented)
                                      } {
                                          const e = null == s ? void 0 : s.methods.find((e => r === e.name));
                                          if (e) return "promise" === e.rtype ? e => c.nativePromise(t, r.toString(), e) : (e, n) => c.nativeCallback(t, r.toString(), e, n);
                                          if (n) return null === (a = n[r]) || void 0 === a ? void 0 : a.bind(n)
                                      }
                                  })(n, r);
                                  if (a) {
                                      const e = a(...u);
                                      return d = null == e ? void 0 : e.remove, e
                                  }
                                  throw new o(`"${t}.${r}()" is not implemented on ${i}`, e.ExceptionCode.Unimplemented)
                              }));
                              return "addListener" === r && (p.remove = async () => d()), p
                          };
                          return u.toString = () => `${r.toString()}() { [capacitor code] }`, Object.defineProperty(u, "name", {
                              value: r,
                              writable: !1,
                              configurable: !1
                          }), u
                      },
                      m = u("addListener"),
                      f = u("removeListener"),
                      h = (e, t) => {
                          const n = m({
                                  eventName: e
                              }, t),
                              r = async () => {
                                  const r = await n;
                                  f({
                                      eventName: e,
                                      callbackId: r
                                  }, t)
                              }, i = new Promise((e => n.then((() => e({
                                  remove: r
                              })))));
                          return i.remove = async () => {
                              console.warn("Using addListener() without 'await' is deprecated."), await r()
                          }, i
                      },
                      v = new Proxy({}, {
                          get(e, t) {
                              switch (t) {
                                  case "$$typeof":
                                      return;
                                  case "toJSON":
                                      return () => ({});
                                  case "addListener":
                                      return s ? h : m;
                                  case "removeListener":
                                      return f;
                                  default:
                                      return u(t)
                              }
                          }
                      });
                  return d[t] = v, w.set(t, {
                      name: t,
                      proxy: v,
                      platforms: new Set([...Object.keys(n), ...s ? [i] : []])
                  }), v
              });
          return c.convertFileSrc || (c.convertFileSrc = e => e), c.getPlatform = p, c.handleError = e => t.console.error(e), c.isNativePlatform = m, c.isPluginAvailable = f, c.pluginMethodNoop = (e, t, n) => Promise.reject(`${n} does not have an implementation of "${t}".`), c.registerPlugin = h, c.Exception = o, c.DEBUG = !!c.DEBUG, c.isLoggingEnabled = !!c.isLoggingEnabled, c.platform = c.getPlatform(), c.isNative = c.isNativePlatform(), c
      },
      a = (e => e.Capacitor = s(e))("undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : "undefined" != typeof window ? window : "undefined" != typeof global ? global : {}),
      l = a.registerPlugin,
      c = a.Plugins;
  class d {
      constructor(e) {
          this.listeners = {}, this.windowListeners = {}, e && (console.warn(`Capacitor WebPlugin "${e.name}" config object was deprecated in v3 and will be removed in v4.`), this.config = e)
      }
      addListener(e, t) {
          this.listeners[e] || (this.listeners[e] = []), this.listeners[e].push(t);
          const n = this.windowListeners[e];
          n && !n.registered && this.addWindowListener(n);
          const r = async () => this.removeListener(e, t), i = Promise.resolve({
              remove: r
          });
          return Object.defineProperty(i, "remove", {
              value: async () => {
                  console.warn("Using addListener() without 'await' is deprecated."), await r()
              }
          }), i
      }
      async removeAllListeners() {
          this.listeners = {};
          for (const e in this.windowListeners) this.removeWindowListener(this.windowListeners[e]);
          this.windowListeners = {}
      }
      notifyListeners(e, t) {
          const n = this.listeners[e];
          n && n.forEach((e => e(t)))
      }
      hasListeners(e) {
          return !!this.listeners[e].length
      }
      registerWindowListener(e, t) {
          this.windowListeners[t] = {
              registered: !1,
              windowEventName: e,
              pluginEventName: t,
              handler: e => {
                  this.notifyListeners(t, e)
              }
          }
      }
      unimplemented(t = "not implemented") {
          return new a.Exception(t, e.ExceptionCode.Unimplemented)
      }
      unavailable(t = "not available") {
          return new a.Exception(t, e.ExceptionCode.Unavailable)
      }
      async removeListener(e, t) {
          const n = this.listeners[e];
          if (!n) return;
          const r = n.indexOf(t);
          this.listeners[e].splice(r, 1), this.listeners[e].length || this.removeWindowListener(this.windowListeners[e])
      }
      addWindowListener(e) {
          window.addEventListener(e.windowEventName, e.handler), e.registered = !0
      }
      removeWindowListener(e) {
          e && (window.removeEventListener(e.windowEventName, e.handler), e.registered = !1)
      }
  }
  const u = l("WebView"),
      p = e => encodeURIComponent(e).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape),
      m = e => e.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
  class f extends d {
      async getCookies() {
          const e = document.cookie,
              t = {};
          return e.split(";").forEach((e => {
              if (e.length <= 0) return;
              let [n, r] = e.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
              n = m(n).trim(), r = m(r).trim(), t[n] = r
          })), t
      }
      async setCookie(e) {
          try {
              const t = p(e.key),
                  n = p(e.value),
                  r = `; expires=${(e.expires || "").replace("expires=", "")}`,
                  i = (e.path || "/").replace("path=", ""),
                  o = null != e.url && e.url.length > 0 ? `domain=${e.url}` : "";
              document.cookie = `${t}=${n || ""}${r}; path=${i}; ${o};`
          } catch (e) {
              return Promise.reject(e)
          }
      }
      async deleteCookie(e) {
          try {
              document.cookie = `${e.key}=; Max-Age=0`
          } catch (e) {
              return Promise.reject(e)
          }
      }
      async clearCookies() {
          try {
              const e = document.cookie.split(";") || [];
              for (const t of e) document.cookie = t.replace(/^ +/, "").replace(/=.*/, `=;expires=${(new Date).toUTCString()};path=/`)
          } catch (e) {
              return Promise.reject(e)
          }
      }
      async clearAllCookies() {
          try {
              await this.clearCookies()
          } catch (e) {
              return Promise.reject(e)
          }
      }
  }
  const g = l("CapacitorCookies", {
          web: () => new f
      }),
      w = (e, t = {}) => {
          const n = Object.assign({
                  method: e.method || "GET",
                  headers: e.headers
              }, t),
              r = ((e = {}) => {
                  const t = Object.keys(e);
                  return Object.keys(e).map((e => e.toLocaleLowerCase())).reduce(((n, r, i) => (n[r] = e[t[i]], n)), {})
              })(e.headers)["content-type"] || "";
          if ("string" == typeof e.data) n.body = e.data;
          else if (r.includes("application/x-www-form-urlencoded")) {
              const t = new URLSearchParams;
              for (const [n, r] of Object.entries(e.data || {})) t.set(n, r);
              n.body = t.toString()
          } else if (r.includes("multipart/form-data") || e.data instanceof FormData) {
              const t = new FormData;
              if (e.data instanceof FormData) e.data.forEach(((e, n) => {
                  t.append(n, e)
              }));
              else
                  for (const n of Object.keys(e.data)) t.append(n, e.data[n]);
              n.body = t;
              const r = new Headers(n.headers);
              r.delete("content-type"), n.headers = r
          } else(r.includes("application/json") || "object" == typeof e.data) && (n.body = JSON.stringify(e.data));
          return n
      };
  class h extends d {
      async request(e) {
          const t = w(e, e.webFetchExtra),
              n = ((e, t = !0) => e ? Object.entries(e).reduce(((e, n) => {
                  const [r, i] = n;
                  let o, s;
                  return Array.isArray(i) ? (s = "", i.forEach((e => {
                      o = t ? encodeURIComponent(e) : e, s += `${r}=${o}&`
                  })), s.slice(0, -1)) : (o = t ? encodeURIComponent(i) : i, s = `${r}=${o}`), `${e}&${s}`
              }), "").substr(1) : null)(e.params, e.shouldEncodeUrlParams),
              r = n ? `${e.url}?${n}` : e.url,
              i = await fetch(r, t),
              o = i.headers.get("content-type") || "";
          let s, a, {
              responseType: l = "text"
          } = i.ok ? e : {};
          switch (o.includes("application/json") && (l = "json"), l) {
              case "arraybuffer":
              case "blob":
                  a = await i.blob(), s = await (async e => new Promise(((t, n) => {
                      const r = new FileReader;
                      r.onload = () => {
                          const e = r.result;
                          t(e.indexOf(",") >= 0 ? e.split(",")[1] : e)
                      }, r.onerror = e => n(e), r.readAsDataURL(e)
                  })))(a);
                  break;
              case "json":
                  s = await i.json();
                  break;
              default:
                  s = await i.text()
          }
          const c = {};
          return i.headers.forEach(((e, t) => {
              c[t] = e
          })), {
              data: s,
              headers: c,
              status: i.status,
              url: i.url
          }
      }
      async get(e) {
          return this.request(Object.assign(Object.assign({}, e), {
              method: "GET"
          }))
      }
      async post(e) {
          return this.request(Object.assign(Object.assign({}, e), {
              method: "POST"
          }))
      }
      async put(e) {
          return this.request(Object.assign(Object.assign({}, e), {
              method: "PUT"
          }))
      }
      async patch(e) {
          return this.request(Object.assign(Object.assign({}, e), {
              method: "PATCH"
          }))
      }
      async delete(e) {
          return this.request(Object.assign(Object.assign({}, e), {
              method: "DELETE"
          }))
      }
  }
  const v = l("CapacitorHttp", {
      web: () => new h
  });
  return e.Capacitor = a, e.CapacitorCookies = g, e.CapacitorException = o, e.CapacitorHttp = v, e.CapacitorPlatforms = t, e.Plugins = c, e.WebPlugin = d, e.WebView = u, e.addPlatform = n, e.buildRequestInit = w, e.registerPlugin = l, e.registerWebPlugin = e => ((e, t) => {
      var n;
      const r = t.config,
          i = e.Plugins;
      if (!(null == r ? void 0 : r.name)) throw new Error('Capacitor WebPlugin is using the deprecated "registerWebPlugin()" function, but without the config. Please use "registerPlugin()" instead to register this web plugin."');
      console.warn(`Capacitor plugin "${r.name}" is using the deprecated "registerWebPlugin()" function`), i[r.name] && !(null === (n = null == r ? void 0 : r.platforms) || void 0 === n ? void 0 : n.includes(e.getPlatform())) || (i[r.name] = t)
  })(a, e), e.setPlatform = r, Object.defineProperty(e, "__esModule", {
      value: !0
  }), e
}({});
//# sourceMappingURL=capacitor.js.map