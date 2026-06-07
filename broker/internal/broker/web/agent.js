var $t = Object.defineProperty;
var vt = (r, e, t) => e in r ? $t(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t;
var b = (r, e, t) => vt(r, typeof e != "symbol" ? e + "" : e, t);
/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ae = globalThis, ye = ae.ShadowRoot && (ae.ShadyCSS === void 0 || ae.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, we = Symbol(), Ue = /* @__PURE__ */ new WeakMap();
let rt = class {
  constructor(e, t, s) {
    if (this._$cssResult$ = !0, s !== we) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = t;
  }
  get styleSheet() {
    let e = this.o;
    const t = this.t;
    if (ye && e === void 0) {
      const s = t !== void 0 && t.length === 1;
      s && (e = Ue.get(t)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), s && Ue.set(t, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
const _t = (r) => new rt(typeof r == "string" ? r : r + "", void 0, we), At = (r, ...e) => {
  const t = r.length === 1 ? r[0] : e.reduce((s, n, i) => s + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(n) + r[i + 1], r[0]);
  return new rt(t, r, we);
}, Tt = (r, e) => {
  if (ye) r.adoptedStyleSheets = e.map((t) => t instanceof CSSStyleSheet ? t : t.styleSheet);
  else for (const t of e) {
    const s = document.createElement("style"), n = ae.litNonce;
    n !== void 0 && s.setAttribute("nonce", n), s.textContent = t.cssText, r.appendChild(s);
  }
}, Be = ye ? (r) => r : (r) => r instanceof CSSStyleSheet ? ((e) => {
  let t = "";
  for (const s of e.cssRules) t += s.cssText;
  return _t(t);
})(r) : r;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: St, defineProperty: Et, getOwnPropertyDescriptor: Ct, getOwnPropertyNames: Rt, getOwnPropertySymbols: zt, getPrototypeOf: It } = Object, z = globalThis, He = z.trustedTypes, Pt = He ? He.emptyScript : "", Mt = z.reactiveElementPolyfillSupport, W = (r, e) => r, le = { toAttribute(r, e) {
  switch (e) {
    case Boolean:
      r = r ? Pt : null;
      break;
    case Object:
    case Array:
      r = r == null ? r : JSON.stringify(r);
  }
  return r;
}, fromAttribute(r, e) {
  let t = r;
  switch (e) {
    case Boolean:
      t = r !== null;
      break;
    case Number:
      t = r === null ? null : Number(r);
      break;
    case Object:
    case Array:
      try {
        t = JSON.parse(r);
      } catch {
        t = null;
      }
  }
  return t;
} }, $e = (r, e) => !St(r, e), Ne = { attribute: !0, type: String, converter: le, reflect: !1, useDefault: !1, hasChanged: $e };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), z.litPropertyMetadata ?? (z.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let N = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ?? (this.l = [])).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, t = Ne) {
    if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
      const s = Symbol(), n = this.getPropertyDescriptor(e, s, t);
      n !== void 0 && Et(this.prototype, e, n);
    }
  }
  static getPropertyDescriptor(e, t, s) {
    const { get: n, set: i } = Ct(this.prototype, e) ?? { get() {
      return this[t];
    }, set(o) {
      this[t] = o;
    } };
    return { get: n, set(o) {
      const a = n?.call(this);
      i?.call(this, o), this.requestUpdate(e, a, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? Ne;
  }
  static _$Ei() {
    if (this.hasOwnProperty(W("elementProperties"))) return;
    const e = It(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(W("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(W("properties"))) {
      const t = this.properties, s = [...Rt(t), ...zt(t)];
      for (const n of s) this.createProperty(n, t[n]);
    }
    const e = this[Symbol.metadata];
    if (e !== null) {
      const t = litPropertyMetadata.get(e);
      if (t !== void 0) for (const [s, n] of t) this.elementProperties.set(s, n);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t, s] of this.elementProperties) {
      const n = this._$Eu(t, s);
      n !== void 0 && this._$Eh.set(n, t);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(e) {
    const t = [];
    if (Array.isArray(e)) {
      const s = new Set(e.flat(1 / 0).reverse());
      for (const n of s) t.unshift(Be(n));
    } else e !== void 0 && t.push(Be(e));
    return t;
  }
  static _$Eu(e, t) {
    const s = t.attribute;
    return s === !1 ? void 0 : typeof s == "string" ? s : typeof e == "string" ? e.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
  }
  addController(e) {
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
  }
  removeController(e) {
    this._$EO?.delete(e);
  }
  _$E_() {
    const e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
    for (const s of t.keys()) this.hasOwnProperty(s) && (e.set(s, this[s]), delete this[s]);
    e.size > 0 && (this._$Ep = e);
  }
  createRenderRoot() {
    const e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return Tt(e, this.constructor.elementStyles), e;
  }
  connectedCallback() {
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
  }
  enableUpdating(e) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((e) => e.hostDisconnected?.());
  }
  attributeChangedCallback(e, t, s) {
    this._$AK(e, s);
  }
  _$ET(e, t) {
    const s = this.constructor.elementProperties.get(e), n = this.constructor._$Eu(e, s);
    if (n !== void 0 && s.reflect === !0) {
      const i = (s.converter?.toAttribute !== void 0 ? s.converter : le).toAttribute(t, s.type);
      this._$Em = e, i == null ? this.removeAttribute(n) : this.setAttribute(n, i), this._$Em = null;
    }
  }
  _$AK(e, t) {
    const s = this.constructor, n = s._$Eh.get(e);
    if (n !== void 0 && this._$Em !== n) {
      const i = s.getPropertyOptions(n), o = typeof i.converter == "function" ? { fromAttribute: i.converter } : i.converter?.fromAttribute !== void 0 ? i.converter : le;
      this._$Em = n;
      const a = o.fromAttribute(t, i.type);
      this[n] = a ?? this._$Ej?.get(n) ?? a, this._$Em = null;
    }
  }
  requestUpdate(e, t, s, n = !1, i) {
    if (e !== void 0) {
      const o = this.constructor;
      if (n === !1 && (i = this[e]), s ?? (s = o.getPropertyOptions(e)), !((s.hasChanged ?? $e)(i, t) || s.useDefault && s.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(o._$Eu(e, s)))) return;
      this.C(e, t, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(e, t, { useDefault: s, reflect: n, wrapped: i }, o) {
    s && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(e) && (this._$Ej.set(e, o ?? t ?? this[e]), i !== !0 || o !== void 0) || (this._$AL.has(e) || (this.hasUpdated || s || (t = void 0), this._$AL.set(e, t)), n === !0 && this._$Em !== e && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(e));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (t) {
      Promise.reject(t);
    }
    const e = this.scheduleUpdate();
    return e != null && await e, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [n, i] of this._$Ep) this[n] = i;
        this._$Ep = void 0;
      }
      const s = this.constructor.elementProperties;
      if (s.size > 0) for (const [n, i] of s) {
        const { wrapped: o } = i, a = this[n];
        o !== !0 || this._$AL.has(n) || a === void 0 || this.C(n, void 0, i, a);
      }
    }
    let e = !1;
    const t = this._$AL;
    try {
      e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((s) => s.hostUpdate?.()), this.update(t)) : this._$EM();
    } catch (s) {
      throw e = !1, this._$EM(), s;
    }
    e && this._$AE(t);
  }
  willUpdate(e) {
  }
  _$AE(e) {
    this._$EO?.forEach((t) => t.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(e) {
    return !0;
  }
  update(e) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((t) => this._$ET(t, this[t]))), this._$EM();
  }
  updated(e) {
  }
  firstUpdated(e) {
  }
};
N.elementStyles = [], N.shadowRootOptions = { mode: "open" }, N[W("elementProperties")] = /* @__PURE__ */ new Map(), N[W("finalized")] = /* @__PURE__ */ new Map(), Mt?.({ ReactiveElement: N }), (z.reactiveElementVersions ?? (z.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const G = globalThis, je = (r) => r, ce = G.trustedTypes, qe = ce ? ce.createPolicy("lit-html", { createHTML: (r) => r }) : void 0, ot = "$lit$", R = `lit$${Math.random().toFixed(9).slice(2)}$`, at = "?" + R, Lt = `<${at}>`, L = document, ee = () => L.createComment(""), te = (r) => r === null || typeof r != "object" && typeof r != "function", ve = Array.isArray, Ot = (r) => ve(r) || typeof r?.[Symbol.iterator] == "function", me = `[ 	
\f\r]`, Z = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, De = /-->/g, Ze = />/g, I = RegExp(`>|${me}(?:([^\\s"'>=/]+)(${me}*=${me}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Fe = /'/g, Ke = /"/g, lt = /^(?:script|style|textarea|title)$/i, Ut = (r) => (e, ...t) => ({ _$litType$: r, strings: e, values: t }), S = Ut(1), C = Symbol.for("lit-noChange"), k = Symbol.for("lit-nothing"), Qe = /* @__PURE__ */ new WeakMap(), M = L.createTreeWalker(L, 129);
function ct(r, e) {
  if (!ve(r) || !r.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return qe !== void 0 ? qe.createHTML(e) : e;
}
const Bt = (r, e) => {
  const t = r.length - 1, s = [];
  let n, i = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", o = Z;
  for (let a = 0; a < t; a++) {
    const l = r[a];
    let p, c, h = -1, u = 0;
    for (; u < l.length && (o.lastIndex = u, c = o.exec(l), c !== null); ) u = o.lastIndex, o === Z ? c[1] === "!--" ? o = De : c[1] !== void 0 ? o = Ze : c[2] !== void 0 ? (lt.test(c[2]) && (n = RegExp("</" + c[2], "g")), o = I) : c[3] !== void 0 && (o = I) : o === I ? c[0] === ">" ? (o = n ?? Z, h = -1) : c[1] === void 0 ? h = -2 : (h = o.lastIndex - c[2].length, p = c[1], o = c[3] === void 0 ? I : c[3] === '"' ? Ke : Fe) : o === Ke || o === Fe ? o = I : o === De || o === Ze ? o = Z : (o = I, n = void 0);
    const d = o === I && r[a + 1].startsWith("/>") ? " " : "";
    i += o === Z ? l + Lt : h >= 0 ? (s.push(p), l.slice(0, h) + ot + l.slice(h) + R + d) : l + R + (h === -2 ? a : d);
  }
  return [ct(r, i + (r[t] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), s];
};
class se {
  constructor({ strings: e, _$litType$: t }, s) {
    let n;
    this.parts = [];
    let i = 0, o = 0;
    const a = e.length - 1, l = this.parts, [p, c] = Bt(e, t);
    if (this.el = se.createElement(p, s), M.currentNode = this.el.content, t === 2 || t === 3) {
      const h = this.el.content.firstChild;
      h.replaceWith(...h.childNodes);
    }
    for (; (n = M.nextNode()) !== null && l.length < a; ) {
      if (n.nodeType === 1) {
        if (n.hasAttributes()) for (const h of n.getAttributeNames()) if (h.endsWith(ot)) {
          const u = c[o++], d = n.getAttribute(h).split(R), f = /([.?@])?(.*)/.exec(u);
          l.push({ type: 1, index: i, name: f[2], strings: d, ctor: f[1] === "." ? Nt : f[1] === "?" ? jt : f[1] === "@" ? qt : de }), n.removeAttribute(h);
        } else h.startsWith(R) && (l.push({ type: 6, index: i }), n.removeAttribute(h));
        if (lt.test(n.tagName)) {
          const h = n.textContent.split(R), u = h.length - 1;
          if (u > 0) {
            n.textContent = ce ? ce.emptyScript : "";
            for (let d = 0; d < u; d++) n.append(h[d], ee()), M.nextNode(), l.push({ type: 2, index: ++i });
            n.append(h[u], ee());
          }
        }
      } else if (n.nodeType === 8) if (n.data === at) l.push({ type: 2, index: i });
      else {
        let h = -1;
        for (; (h = n.data.indexOf(R, h + 1)) !== -1; ) l.push({ type: 7, index: i }), h += R.length - 1;
      }
      i++;
    }
  }
  static createElement(e, t) {
    const s = L.createElement("template");
    return s.innerHTML = e, s;
  }
}
function j(r, e, t = r, s) {
  if (e === C) return e;
  let n = s !== void 0 ? t._$Co?.[s] : t._$Cl;
  const i = te(e) ? void 0 : e._$litDirective$;
  return n?.constructor !== i && (n?._$AO?.(!1), i === void 0 ? n = void 0 : (n = new i(r), n._$AT(r, t, s)), s !== void 0 ? (t._$Co ?? (t._$Co = []))[s] = n : t._$Cl = n), n !== void 0 && (e = j(r, n._$AS(r, e.values), n, s)), e;
}
class Ht {
  constructor(e, t) {
    this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(e) {
    const { el: { content: t }, parts: s } = this._$AD, n = (e?.creationScope ?? L).importNode(t, !0);
    M.currentNode = n;
    let i = M.nextNode(), o = 0, a = 0, l = s[0];
    for (; l !== void 0; ) {
      if (o === l.index) {
        let p;
        l.type === 2 ? p = new q(i, i.nextSibling, this, e) : l.type === 1 ? p = new l.ctor(i, l.name, l.strings, this, e) : l.type === 6 && (p = new Dt(i, this, e)), this._$AV.push(p), l = s[++a];
      }
      o !== l?.index && (i = M.nextNode(), o++);
    }
    return M.currentNode = L, n;
  }
  p(e) {
    let t = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(e, s, t), t += s.strings.length - 2) : s._$AI(e[t])), t++;
  }
}
class q {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(e, t, s, n) {
    this.type = 2, this._$AH = k, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = s, this.options = n, this._$Cv = n?.isConnected ?? !0;
  }
  get parentNode() {
    let e = this._$AA.parentNode;
    const t = this._$AM;
    return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(e, t = this) {
    e = j(this, e, t), te(e) ? e === k || e == null || e === "" ? (this._$AH !== k && this._$AR(), this._$AH = k) : e !== this._$AH && e !== C && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : Ot(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== k && te(this._$AH) ? this._$AA.nextSibling.data = e : this.T(L.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    const { values: t, _$litType$: s } = e, n = typeof s == "number" ? this._$AC(e) : (s.el === void 0 && (s.el = se.createElement(ct(s.h, s.h[0]), this.options)), s);
    if (this._$AH?._$AD === n) this._$AH.p(t);
    else {
      const i = new Ht(n, this), o = i.u(this.options);
      i.p(t), this.T(o), this._$AH = i;
    }
  }
  _$AC(e) {
    let t = Qe.get(e.strings);
    return t === void 0 && Qe.set(e.strings, t = new se(e)), t;
  }
  k(e) {
    ve(this._$AH) || (this._$AH = [], this._$AR());
    const t = this._$AH;
    let s, n = 0;
    for (const i of e) n === t.length ? t.push(s = new q(this.O(ee()), this.O(ee()), this, this.options)) : s = t[n], s._$AI(i), n++;
    n < t.length && (this._$AR(s && s._$AB.nextSibling, n), t.length = n);
  }
  _$AR(e = this._$AA.nextSibling, t) {
    for (this._$AP?.(!1, !0, t); e !== this._$AB; ) {
      const s = je(e).nextSibling;
      je(e).remove(), e = s;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
}
class de {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, t, s, n, i) {
    this.type = 1, this._$AH = k, this._$AN = void 0, this.element = e, this.name = t, this._$AM = n, this.options = i, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = k;
  }
  _$AI(e, t = this, s, n) {
    const i = this.strings;
    let o = !1;
    if (i === void 0) e = j(this, e, t, 0), o = !te(e) || e !== this._$AH && e !== C, o && (this._$AH = e);
    else {
      const a = e;
      let l, p;
      for (e = i[0], l = 0; l < i.length - 1; l++) p = j(this, a[s + l], t, l), p === C && (p = this._$AH[l]), o || (o = !te(p) || p !== this._$AH[l]), p === k ? e = k : e !== k && (e += (p ?? "") + i[l + 1]), this._$AH[l] = p;
    }
    o && !n && this.j(e);
  }
  j(e) {
    e === k ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
}
class Nt extends de {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === k ? void 0 : e;
  }
}
class jt extends de {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== k);
  }
}
class qt extends de {
  constructor(e, t, s, n, i) {
    super(e, t, s, n, i), this.type = 5;
  }
  _$AI(e, t = this) {
    if ((e = j(this, e, t, 0) ?? k) === C) return;
    const s = this._$AH, n = e === k && s !== k || e.capture !== s.capture || e.once !== s.once || e.passive !== s.passive, i = e !== k && (s === k || n);
    n && this.element.removeEventListener(this.name, this, s), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
}
class Dt {
  constructor(e, t, s) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    j(this, e);
  }
}
const Zt = { I: q }, Ft = G.litHtmlPolyfillSupport;
Ft?.(se, q), (G.litHtmlVersions ?? (G.litHtmlVersions = [])).push("3.3.3");
const Kt = (r, e, t) => {
  const s = t?.renderBefore ?? e;
  let n = s._$litPart$;
  if (n === void 0) {
    const i = t?.renderBefore ?? null;
    s._$litPart$ = n = new q(e.insertBefore(ee(), i), i, void 0, t ?? {});
  }
  return n._$AI(r), n;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const V = globalThis;
let J = class extends N {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var t;
    const e = super.createRenderRoot();
    return (t = this.renderOptions).renderBefore ?? (t.renderBefore = e.firstChild), e;
  }
  update(e) {
    const t = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Kt(t, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return C;
  }
};
J._$litElement$ = !0, J.finalized = !0, V.litElementHydrateSupport?.({ LitElement: J });
const Qt = V.litElementPolyfillSupport;
Qt?.({ LitElement: J });
(V.litElementVersions ?? (V.litElementVersions = [])).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Wt = (r) => (e, t) => {
  t !== void 0 ? t.addInitializer(() => {
    customElements.define(r, e);
  }) : customElements.define(r, e);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Gt = { attribute: !0, type: String, converter: le, reflect: !1, hasChanged: $e }, Vt = (r = Gt, e, t) => {
  const { kind: s, metadata: n } = t;
  let i = globalThis.litPropertyMetadata.get(n);
  if (i === void 0 && globalThis.litPropertyMetadata.set(n, i = /* @__PURE__ */ new Map()), s === "setter" && ((r = Object.create(r)).wrapped = !0), i.set(t.name, r), s === "accessor") {
    const { name: o } = t;
    return { set(a) {
      const l = e.get.call(this);
      e.set.call(this, a), this.requestUpdate(o, l, r, !0, a);
    }, init(a) {
      return a !== void 0 && this.C(o, void 0, r, a), a;
    } };
  }
  if (s === "setter") {
    const { name: o } = t;
    return function(a) {
      const l = this[o];
      e.call(this, a), this.requestUpdate(o, l, r, !0, a);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function E(r) {
  return (e, t) => typeof t == "object" ? Vt(r, e, t) : ((s, n, i) => {
    const o = n.hasOwnProperty(i);
    return n.constructor.createProperty(i, s), o ? Object.getOwnPropertyDescriptor(n, i) : void 0;
  })(r, e, t);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function U(r) {
  return E({ ...r, state: !0, attribute: !1 });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const _e = { ATTRIBUTE: 1, CHILD: 2 }, Ae = (r) => (...e) => ({ _$litDirective$: r, values: e });
let Te = class {
  constructor(e) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(e, t, s) {
    this._$Ct = e, this._$AM = t, this._$Ci = s;
  }
  _$AS(e, t) {
    return this.update(e, t);
  }
  update(e, t) {
    return this.render(...t);
  }
};
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { I: Jt } = Zt, We = (r) => r, Ge = () => document.createComment(""), F = (r, e, t) => {
  const s = r._$AA.parentNode, n = e === void 0 ? r._$AB : e._$AA;
  if (t === void 0) {
    const i = s.insertBefore(Ge(), n), o = s.insertBefore(Ge(), n);
    t = new Jt(i, o, r, r.options);
  } else {
    const i = t._$AB.nextSibling, o = t._$AM, a = o !== r;
    if (a) {
      let l;
      t._$AQ?.(r), t._$AM = r, t._$AP !== void 0 && (l = r._$AU) !== o._$AU && t._$AP(l);
    }
    if (i !== n || a) {
      let l = t._$AA;
      for (; l !== i; ) {
        const p = We(l).nextSibling;
        We(s).insertBefore(l, n), l = p;
      }
    }
  }
  return t;
}, P = (r, e, t = r) => (r._$AI(e, t), r), Yt = {}, Xt = (r, e = Yt) => r._$AH = e, es = (r) => r._$AH, be = (r) => {
  r._$AR(), r._$AA.remove();
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ve = (r, e, t) => {
  const s = /* @__PURE__ */ new Map();
  for (let n = e; n <= t; n++) s.set(r[n], n);
  return s;
}, ts = Ae(class extends Te {
  constructor(r) {
    if (super(r), r.type !== _e.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(r, e, t) {
    let s;
    t === void 0 ? t = e : e !== void 0 && (s = e);
    const n = [], i = [];
    let o = 0;
    for (const a of r) n[o] = s ? s(a, o) : o, i[o] = t(a, o), o++;
    return { values: i, keys: n };
  }
  render(r, e, t) {
    return this.dt(r, e, t).values;
  }
  update(r, [e, t, s]) {
    const n = es(r), { values: i, keys: o } = this.dt(e, t, s);
    if (!Array.isArray(n)) return this.ut = o, i;
    const a = this.ut ?? (this.ut = []), l = [];
    let p, c, h = 0, u = n.length - 1, d = 0, f = i.length - 1;
    for (; h <= u && d <= f; ) if (n[h] === null) h++;
    else if (n[u] === null) u--;
    else if (a[h] === o[d]) l[d] = P(n[h], i[d]), h++, d++;
    else if (a[u] === o[f]) l[f] = P(n[u], i[f]), u--, f--;
    else if (a[h] === o[f]) l[f] = P(n[h], i[f]), F(r, l[f + 1], n[h]), h++, f--;
    else if (a[u] === o[d]) l[d] = P(n[u], i[d]), F(r, n[h], n[u]), u--, d++;
    else if (p === void 0 && (p = Ve(o, d, f), c = Ve(a, h, u)), p.has(a[h])) if (p.has(a[u])) {
      const x = c.get(o[d]), $ = x !== void 0 ? n[x] : null;
      if ($ === null) {
        const H = F(r, n[h]);
        P(H, i[d]), l[d] = H;
      } else l[d] = P($, i[d]), F(r, n[h], $), n[x] = null;
      d++;
    } else be(n[u]), u--;
    else be(n[h]), h++;
    for (; d <= f; ) {
      const x = F(r, l[f + 1]);
      P(x, i[d]), l[d++] = x;
    }
    for (; h <= u; ) {
      const x = n[h++];
      x !== null && be(x);
    }
    return this.ut = o, Xt(r, l), C;
  }
});
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
let ke = class extends Te {
  constructor(e) {
    if (super(e), this.it = k, e.type !== _e.CHILD) throw Error(this.constructor.directiveName + "() can only be used in child bindings");
  }
  render(e) {
    if (e === k || e == null) return this._t = void 0, this.it = e;
    if (e === C) return e;
    if (typeof e != "string") throw Error(this.constructor.directiveName + "() called with a non-string value");
    if (e === this.it) return this._t;
    this.it = e;
    const t = [e];
    return t.raw = t, this._t = { _$litType$: this.constructor.resultType, strings: t, values: [] };
  }
};
ke.directiveName = "unsafeHTML", ke.resultType = 1;
const ss = Ae(ke);
/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ns = Ae(class extends Te {
  constructor(r) {
    if (super(r), r.type !== _e.ATTRIBUTE || r.name !== "class" || r.strings?.length > 2) throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.");
  }
  render(r) {
    return " " + Object.keys(r).filter((e) => r[e]).join(" ") + " ";
  }
  update(r, [e]) {
    if (this.st === void 0) {
      this.st = /* @__PURE__ */ new Set(), r.strings !== void 0 && (this.nt = new Set(r.strings.join(" ").split(/\s/).filter((s) => s !== "")));
      for (const s in e) e[s] && !this.nt?.has(s) && this.st.add(s);
      return this.render(e);
    }
    const t = r.element.classList;
    for (const s of this.st) s in e || (t.remove(s), this.st.delete(s));
    for (const s in e) {
      const n = !!e[s];
      n === this.st.has(s) || this.nt?.has(s) || (n ? (t.add(s), this.st.add(s)) : (t.remove(s), this.st.delete(s)));
    }
    return C;
  }
});
class is {
  constructor() {
    this.buffer = "", this.dataLines = [], this.eventType = "", this.sawField = !1;
  }
  /**
   * Feed a chunk of decoded text. Returns any events completed by this chunk.
   * Incomplete trailing data is retained until the next call.
   */
  push(e) {
    this.buffer += e;
    const t = [];
    let s;
    for (; (s = this.indexOfLineEnd(this.buffer)) !== -1; ) {
      const { line: n, nextStart: i } = this.takeLine(s);
      if (this.buffer = this.buffer.slice(i), n === "") {
        const o = this.dispatch();
        o && t.push(o);
        continue;
      }
      this.handleLine(n);
    }
    return t;
  }
  /**
   * Flush at end-of-stream. If a final event was being accumulated without a
   * trailing blank line, dispatch it. Returns the event, if any.
   */
  flush() {
    this.buffer.length > 0 && (this.handleLine(this.buffer), this.buffer = "");
    const e = this.dispatch();
    return e ? [e] : [];
  }
  handleLine(e) {
    if (e.startsWith(":")) return;
    const t = e.indexOf(":");
    let s, n;
    switch (t === -1 ? (s = e, n = "") : (s = e.slice(0, t), n = e.slice(t + 1), n.startsWith(" ") && (n = n.slice(1))), this.sawField = !0, s) {
      case "event":
        this.eventType = n;
        break;
      case "data":
        this.dataLines.push(n);
        break;
      case "id":
        n.includes("\0") || (this.lastId = n);
        break;
      case "retry": {
        const i = Number(n);
        Number.isInteger(i) && i >= 0 && (this.retry = i);
        break;
      }
    }
  }
  dispatch() {
    if (!this.sawField)
      return this.resetEvent(), null;
    if (this.dataLines.length === 0 && this.eventType === "")
      return this.resetEvent(), null;
    const e = {
      event: this.eventType === "" ? "message" : this.eventType,
      data: this.dataLines.join(`
`)
    };
    return this.lastId !== void 0 && (e.id = this.lastId), this.retry !== void 0 && (e.retry = this.retry), this.resetEvent(), e;
  }
  resetEvent() {
    this.dataLines = [], this.eventType = "", this.retry = void 0, this.sawField = !1;
  }
  /** Find index of the next line terminator (\n, \r\n, or lone \r). */
  indexOfLineEnd(e) {
    for (let t = 0; t < e.length; t++) {
      const s = e.charCodeAt(t);
      if (s === 10) return t;
      if (s === 13)
        return t === e.length - 1 ? -1 : t;
    }
    return -1;
  }
  /** Extract the line up to `lineEnd`, returning the start of the next line. */
  takeLine(e) {
    const t = this.buffer.charCodeAt(e), s = this.buffer.slice(0, e);
    return t === 13 && this.buffer.charCodeAt(e + 1) === 10 ? { line: s, nextStart: e + 2 } : { line: s, nextStart: e + 1 };
  }
}
async function* rs(r) {
  const e = r.getReader(), t = new TextDecoder("utf-8"), s = new is();
  try {
    for (; ; ) {
      const { value: i, done: o } = await e.read();
      if (o) break;
      if (i) {
        const a = t.decode(i, { stream: !0 });
        if (a)
          for (const l of s.push(a)) yield l;
      }
    }
    const n = t.decode();
    if (n)
      for (const i of s.push(n)) yield i;
    for (const i of s.flush()) yield i;
  } finally {
    e.releaseLock();
  }
}
class v extends Error {
  constructor(e, t, s) {
    super(t), this.name = "ClankstackError", this.code = e, this.status = s;
  }
}
const os = "https://api.clankstack.dev";
function Je(r, e) {
  return `${r.endsWith("/") ? r.slice(0, -1) : r}${e}`;
}
function as(r) {
  return typeof r == "object" && r !== null && "error" in r && typeof r.error == "object" && r.error !== null;
}
class ls {
  constructor(e) {
    if (this.sessionToken = null, this.sessionConfig = null, this.sessionInflight = null, !e.publishableKey)
      throw new v("invalid_request", "publishableKey is required");
    this.endpoint = e.endpoint?.trim() || os, this.publishableKey = e.publishableKey, this.visitorId = e.visitorId;
    const t = e.fetchImpl ?? globalThis.fetch;
    if (typeof t != "function")
      throw new v("internal_error", "No fetch implementation available");
    this.fetchImpl = t.bind(globalThis);
  }
  /** The session config from the last successful exchange, if any. */
  get config() {
    return this.sessionConfig;
  }
  /** Whether a session token is currently held. */
  get hasSession() {
    return this.sessionToken !== null;
  }
  /** Drop any cached session token/config. */
  reset() {
    this.sessionToken = null, this.sessionConfig = null, this.sessionInflight = null;
  }
  /**
   * Ensure a valid session exists, performing the session exchange if needed.
   * Returns the session config. De-dupes concurrent callers.
   */
  async ensureSession(e = !1) {
    return !e && this.sessionToken && this.sessionConfig ? this.sessionConfig : (e && (this.sessionToken = null, this.sessionConfig = null), this.sessionInflight || (this.sessionInflight = this.exchangeSession().finally(() => {
      this.sessionInflight = null;
    })), (await this.sessionInflight).config);
  }
  async exchangeSession() {
    const e = Je(this.endpoint, "/v1/embed/session"), t = { publishable_key: this.publishableKey };
    this.visitorId && (t.visitor_id = this.visitorId);
    let s;
    try {
      s = await this.fetchImpl(e, {
        method: "POST",
        // Browser auto-sends Origin; never set it manually.
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
        credentials: "omit"
      });
    } catch (o) {
      throw new v(
        "internal_error",
        `Network error during session exchange: ${o.message}`
      );
    }
    if (!s.ok)
      throw await this.errorFromResponse(s, "Session exchange failed");
    let n;
    try {
      n = await s.json();
    } catch {
      throw new v("internal_error", "Malformed session response", s.status);
    }
    const i = n;
    if (!i || typeof i.session_token != "string" || !i.config)
      throw new v("internal_error", "Invalid session response shape", s.status);
    return this.sessionToken = i.session_token, this.sessionConfig = i.config, i;
  }
  async errorFromResponse(e, t) {
    let s = "internal_error", n = t;
    try {
      const i = await e.json();
      as(i) && (s = i.error.code || s, n = i.error.message || n);
    } catch {
    }
    return e.status === 401 && s === "internal_error" && (s = "session_expired"), e.status === 429 && s === "internal_error" && (s = "rate_limited"), new v(s, n, e.status);
  }
  /**
   * Send a user message and stream the assistant reply.
   *
   * Returns an async-iterable of text deltas plus a `.text` promise that
   * resolves to the assembled final reply. Bootstraps the session and retries
   * once on session expiry.
   */
  send(e) {
    let t, s;
    const n = new Promise((l, p) => {
      t = l, s = p;
    });
    n.catch(() => {
    });
    const i = this;
    async function* o() {
      let l = "";
      try {
        await i.ensureSession();
        let p;
        try {
          p = await i.openChatStream(e);
        } catch (c) {
          if (c instanceof v && i.isExpiry(c))
            await i.ensureSession(!0), p = await i.openChatStream(e);
          else
            throw c;
        }
        for await (const c of rs(p)) {
          if (c.data === "") continue;
          let h;
          try {
            h = JSON.parse(c.data);
          } catch {
            continue;
          }
          if (h.type === "delta")
            h.text && (l += h.text, yield h.text);
          else {
            if (h.type === "done")
              break;
            if (h.type === "error")
              throw new v(h.code, h.message);
          }
        }
        t(l);
      } catch (p) {
        throw s(p), p;
      }
    }
    const a = o();
    return {
      [Symbol.asyncIterator]: () => a,
      text: n
    };
  }
  isExpiry(e) {
    return e.status === 401 || e.code === "session_expired";
  }
  async openChatStream(e) {
    if (!this.sessionToken)
      throw new v("session_expired", "No active session");
    const t = Je(this.endpoint, "/v1/embed/chat");
    let s;
    try {
      s = await this.fetchImpl(t, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.sessionToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: e }),
        credentials: "omit"
      });
    } catch (n) {
      throw new v(
        "internal_error",
        `Network error during chat stream: ${n.message}`
      );
    }
    if (s.status === 401)
      throw new v("session_expired", "Session expired", 401);
    if (!s.ok)
      throw await this.errorFromResponse(s, "Chat request failed");
    if (!s.body)
      throw new v("internal_error", "Chat response had no body");
    return s.body;
  }
}
function Se() {
  return {
    async: !1,
    breaks: !1,
    extensions: null,
    gfm: !0,
    hooks: null,
    pedantic: !1,
    renderer: null,
    silent: !1,
    tokenizer: null,
    walkTokens: null
  };
}
let B = Se();
function ht(r) {
  B = r;
}
const pt = /[&<>"']/, cs = new RegExp(pt.source, "g"), ut = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, hs = new RegExp(ut.source, "g"), ps = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}, Ye = (r) => ps[r];
function _(r, e) {
  if (e) {
    if (pt.test(r))
      return r.replace(cs, Ye);
  } else if (ut.test(r))
    return r.replace(hs, Ye);
  return r;
}
const us = /(^|[^\[])\^/g;
function m(r, e) {
  let t = typeof r == "string" ? r : r.source;
  e = e || "";
  const s = {
    replace: (n, i) => {
      let o = typeof i == "string" ? i : i.source;
      return o = o.replace(us, "$1"), t = t.replace(n, o), s;
    },
    getRegex: () => new RegExp(t, e)
  };
  return s;
}
function Xe(r) {
  try {
    r = encodeURI(r).replace(/%25/g, "%");
  } catch {
    return null;
  }
  return r;
}
const Y = { exec: () => null };
function et(r, e) {
  const t = r.replace(/\|/g, (i, o, a) => {
    let l = !1, p = o;
    for (; --p >= 0 && a[p] === "\\"; )
      l = !l;
    return l ? "|" : " |";
  }), s = t.split(/ \|/);
  let n = 0;
  if (s[0].trim() || s.shift(), s.length > 0 && !s[s.length - 1].trim() && s.pop(), e)
    if (s.length > e)
      s.splice(e);
    else
      for (; s.length < e; )
        s.push("");
  for (; n < s.length; n++)
    s[n] = s[n].trim().replace(/\\\|/g, "|");
  return s;
}
function K(r, e, t) {
  const s = r.length;
  if (s === 0)
    return "";
  let n = 0;
  for (; n < s && r.charAt(s - n - 1) === e; )
    n++;
  return r.slice(0, s - n);
}
function ds(r, e) {
  if (r.indexOf(e[1]) === -1)
    return -1;
  let t = 0;
  for (let s = 0; s < r.length; s++)
    if (r[s] === "\\")
      s++;
    else if (r[s] === e[0])
      t++;
    else if (r[s] === e[1] && (t--, t < 0))
      return s;
  return -1;
}
function tt(r, e, t, s) {
  const n = e.href, i = e.title ? _(e.title) : null, o = r[1].replace(/\\([\[\]])/g, "$1");
  if (r[0].charAt(0) !== "!") {
    s.state.inLink = !0;
    const a = {
      type: "link",
      raw: t,
      href: n,
      title: i,
      text: o,
      tokens: s.inlineTokens(o)
    };
    return s.state.inLink = !1, a;
  }
  return {
    type: "image",
    raw: t,
    href: n,
    title: i,
    text: _(o)
  };
}
function fs(r, e) {
  const t = r.match(/^(\s+)(?:```)/);
  if (t === null)
    return e;
  const s = t[1];
  return e.split(`
`).map((n) => {
    const i = n.match(/^\s+/);
    if (i === null)
      return n;
    const [o] = i;
    return o.length >= s.length ? n.slice(s.length) : n;
  }).join(`
`);
}
class he {
  // set by the lexer
  constructor(e) {
    b(this, "options");
    b(this, "rules");
    // set by the lexer
    b(this, "lexer");
    this.options = e || B;
  }
  space(e) {
    const t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0)
      return {
        type: "space",
        raw: t[0]
      };
  }
  code(e) {
    const t = this.rules.block.code.exec(e);
    if (t) {
      const s = t[0].replace(/^(?: {1,4}| {0,3}\t)/gm, "");
      return {
        type: "code",
        raw: t[0],
        codeBlockStyle: "indented",
        text: this.options.pedantic ? s : K(s, `
`)
      };
    }
  }
  fences(e) {
    const t = this.rules.block.fences.exec(e);
    if (t) {
      const s = t[0], n = fs(s, t[3] || "");
      return {
        type: "code",
        raw: s,
        lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2],
        text: n
      };
    }
  }
  heading(e) {
    const t = this.rules.block.heading.exec(e);
    if (t) {
      let s = t[2].trim();
      if (/#$/.test(s)) {
        const n = K(s, "#");
        (this.options.pedantic || !n || / $/.test(n)) && (s = n.trim());
      }
      return {
        type: "heading",
        raw: t[0],
        depth: t[1].length,
        text: s,
        tokens: this.lexer.inline(s)
      };
    }
  }
  hr(e) {
    const t = this.rules.block.hr.exec(e);
    if (t)
      return {
        type: "hr",
        raw: K(t[0], `
`)
      };
  }
  blockquote(e) {
    const t = this.rules.block.blockquote.exec(e);
    if (t) {
      let s = K(t[0], `
`).split(`
`), n = "", i = "";
      const o = [];
      for (; s.length > 0; ) {
        let a = !1;
        const l = [];
        let p;
        for (p = 0; p < s.length; p++)
          if (/^ {0,3}>/.test(s[p]))
            l.push(s[p]), a = !0;
          else if (!a)
            l.push(s[p]);
          else
            break;
        s = s.slice(p);
        const c = l.join(`
`), h = c.replace(/\n {0,3}((?:=+|-+) *)(?=\n|$)/g, `
    $1`).replace(/^ {0,3}>[ \t]?/gm, "");
        n = n ? `${n}
${c}` : c, i = i ? `${i}
${h}` : h;
        const u = this.lexer.state.top;
        if (this.lexer.state.top = !0, this.lexer.blockTokens(h, o, !0), this.lexer.state.top = u, s.length === 0)
          break;
        const d = o[o.length - 1];
        if (d?.type === "code")
          break;
        if (d?.type === "blockquote") {
          const f = d, x = f.raw + `
` + s.join(`
`), $ = this.blockquote(x);
          o[o.length - 1] = $, n = n.substring(0, n.length - f.raw.length) + $.raw, i = i.substring(0, i.length - f.text.length) + $.text;
          break;
        } else if (d?.type === "list") {
          const f = d, x = f.raw + `
` + s.join(`
`), $ = this.list(x);
          o[o.length - 1] = $, n = n.substring(0, n.length - d.raw.length) + $.raw, i = i.substring(0, i.length - f.raw.length) + $.raw, s = x.substring(o[o.length - 1].raw.length).split(`
`);
          continue;
        }
      }
      return {
        type: "blockquote",
        raw: n,
        tokens: o,
        text: i
      };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      let s = t[1].trim();
      const n = s.length > 1, i = {
        type: "list",
        raw: "",
        ordered: n,
        start: n ? +s.slice(0, -1) : "",
        loose: !1,
        items: []
      };
      s = n ? `\\d{1,9}\\${s.slice(-1)}` : `\\${s}`, this.options.pedantic && (s = n ? s : "[*+-]");
      const o = new RegExp(`^( {0,3}${s})((?:[	 ][^\\n]*)?(?:\\n|$))`);
      let a = !1;
      for (; e; ) {
        let l = !1, p = "", c = "";
        if (!(t = o.exec(e)) || this.rules.block.hr.test(e))
          break;
        p = t[0], e = e.substring(p.length);
        let h = t[2].split(`
`, 1)[0].replace(/^\t+/, (H) => " ".repeat(3 * H.length)), u = e.split(`
`, 1)[0], d = !h.trim(), f = 0;
        if (this.options.pedantic ? (f = 2, c = h.trimStart()) : d ? f = t[1].length + 1 : (f = t[2].search(/[^ ]/), f = f > 4 ? 1 : f, c = h.slice(f), f += t[1].length), d && /^[ \t]*$/.test(u) && (p += u + `
`, e = e.substring(u.length + 1), l = !0), !l) {
          const H = new RegExp(`^ {0,${Math.min(3, f - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`), Me = new RegExp(`^ {0,${Math.min(3, f - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`), Le = new RegExp(`^ {0,${Math.min(3, f - 1)}}(?:\`\`\`|~~~)`), Oe = new RegExp(`^ {0,${Math.min(3, f - 1)}}#`), wt = new RegExp(`^ {0,${Math.min(3, f - 1)}}<(?:[a-z].*>|!--)`, "i");
          for (; e; ) {
            const ge = e.split(`
`, 1)[0];
            let D;
            if (u = ge, this.options.pedantic ? (u = u.replace(/^ {1,4}(?=( {4})*[^ ])/g, "  "), D = u) : D = u.replace(/\t/g, "    "), Le.test(u) || Oe.test(u) || wt.test(u) || H.test(u) || Me.test(u))
              break;
            if (D.search(/[^ ]/) >= f || !u.trim())
              c += `
` + D.slice(f);
            else {
              if (d || h.replace(/\t/g, "    ").search(/[^ ]/) >= 4 || Le.test(h) || Oe.test(h) || Me.test(h))
                break;
              c += `
` + u;
            }
            !d && !u.trim() && (d = !0), p += ge + `
`, e = e.substring(ge.length + 1), h = D.slice(f);
          }
        }
        i.loose || (a ? i.loose = !0 : /\n[ \t]*\n[ \t]*$/.test(p) && (a = !0));
        let x = null, $;
        this.options.gfm && (x = /^\[[ xX]\] /.exec(c), x && ($ = x[0] !== "[ ] ", c = c.replace(/^\[[ xX]\] +/, ""))), i.items.push({
          type: "list_item",
          raw: p,
          task: !!x,
          checked: $,
          loose: !1,
          text: c,
          tokens: []
        }), i.raw += p;
      }
      i.items[i.items.length - 1].raw = i.items[i.items.length - 1].raw.trimEnd(), i.items[i.items.length - 1].text = i.items[i.items.length - 1].text.trimEnd(), i.raw = i.raw.trimEnd();
      for (let l = 0; l < i.items.length; l++)
        if (this.lexer.state.top = !1, i.items[l].tokens = this.lexer.blockTokens(i.items[l].text, []), !i.loose) {
          const p = i.items[l].tokens.filter((h) => h.type === "space"), c = p.length > 0 && p.some((h) => /\n.*\n/.test(h.raw));
          i.loose = c;
        }
      if (i.loose)
        for (let l = 0; l < i.items.length; l++)
          i.items[l].loose = !0;
      return i;
    }
  }
  html(e) {
    const t = this.rules.block.html.exec(e);
    if (t)
      return {
        type: "html",
        block: !0,
        raw: t[0],
        pre: t[1] === "pre" || t[1] === "script" || t[1] === "style",
        text: t[0]
      };
  }
  def(e) {
    const t = this.rules.block.def.exec(e);
    if (t) {
      const s = t[1].toLowerCase().replace(/\s+/g, " "), n = t[2] ? t[2].replace(/^<(.*)>$/, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", i = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return {
        type: "def",
        tag: s,
        raw: t[0],
        href: n,
        title: i
      };
    }
  }
  table(e) {
    const t = this.rules.block.table.exec(e);
    if (!t || !/[:|]/.test(t[2]))
      return;
    const s = et(t[1]), n = t[2].replace(/^\||\| *$/g, "").split("|"), i = t[3] && t[3].trim() ? t[3].replace(/\n[ \t]*$/, "").split(`
`) : [], o = {
      type: "table",
      raw: t[0],
      header: [],
      align: [],
      rows: []
    };
    if (s.length === n.length) {
      for (const a of n)
        /^ *-+: *$/.test(a) ? o.align.push("right") : /^ *:-+: *$/.test(a) ? o.align.push("center") : /^ *:-+ *$/.test(a) ? o.align.push("left") : o.align.push(null);
      for (let a = 0; a < s.length; a++)
        o.header.push({
          text: s[a],
          tokens: this.lexer.inline(s[a]),
          header: !0,
          align: o.align[a]
        });
      for (const a of i)
        o.rows.push(et(a, o.header.length).map((l, p) => ({
          text: l,
          tokens: this.lexer.inline(l),
          header: !1,
          align: o.align[p]
        })));
      return o;
    }
  }
  lheading(e) {
    const t = this.rules.block.lheading.exec(e);
    if (t)
      return {
        type: "heading",
        raw: t[0],
        depth: t[2].charAt(0) === "=" ? 1 : 2,
        text: t[1],
        tokens: this.lexer.inline(t[1])
      };
  }
  paragraph(e) {
    const t = this.rules.block.paragraph.exec(e);
    if (t) {
      const s = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
      return {
        type: "paragraph",
        raw: t[0],
        text: s,
        tokens: this.lexer.inline(s)
      };
    }
  }
  text(e) {
    const t = this.rules.block.text.exec(e);
    if (t)
      return {
        type: "text",
        raw: t[0],
        text: t[0],
        tokens: this.lexer.inline(t[0])
      };
  }
  escape(e) {
    const t = this.rules.inline.escape.exec(e);
    if (t)
      return {
        type: "escape",
        raw: t[0],
        text: _(t[1])
      };
  }
  tag(e) {
    const t = this.rules.inline.tag.exec(e);
    if (t)
      return !this.lexer.state.inLink && /^<a /i.test(t[0]) ? this.lexer.state.inLink = !0 : this.lexer.state.inLink && /^<\/a>/i.test(t[0]) && (this.lexer.state.inLink = !1), !this.lexer.state.inRawBlock && /^<(pre|code|kbd|script)(\s|>)/i.test(t[0]) ? this.lexer.state.inRawBlock = !0 : this.lexer.state.inRawBlock && /^<\/(pre|code|kbd|script)(\s|>)/i.test(t[0]) && (this.lexer.state.inRawBlock = !1), {
        type: "html",
        raw: t[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: !1,
        text: t[0]
      };
  }
  link(e) {
    const t = this.rules.inline.link.exec(e);
    if (t) {
      const s = t[2].trim();
      if (!this.options.pedantic && /^</.test(s)) {
        if (!/>$/.test(s))
          return;
        const o = K(s.slice(0, -1), "\\");
        if ((s.length - o.length) % 2 === 0)
          return;
      } else {
        const o = ds(t[2], "()");
        if (o > -1) {
          const l = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + o;
          t[2] = t[2].substring(0, o), t[0] = t[0].substring(0, l).trim(), t[3] = "";
        }
      }
      let n = t[2], i = "";
      if (this.options.pedantic) {
        const o = /^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(n);
        o && (n = o[1], i = o[3]);
      } else
        i = t[3] ? t[3].slice(1, -1) : "";
      return n = n.trim(), /^</.test(n) && (this.options.pedantic && !/>$/.test(s) ? n = n.slice(1) : n = n.slice(1, -1)), tt(t, {
        href: n && n.replace(this.rules.inline.anyPunctuation, "$1"),
        title: i && i.replace(this.rules.inline.anyPunctuation, "$1")
      }, t[0], this.lexer);
    }
  }
  reflink(e, t) {
    let s;
    if ((s = this.rules.inline.reflink.exec(e)) || (s = this.rules.inline.nolink.exec(e))) {
      const n = (s[2] || s[1]).replace(/\s+/g, " "), i = t[n.toLowerCase()];
      if (!i) {
        const o = s[0].charAt(0);
        return {
          type: "text",
          raw: o,
          text: o
        };
      }
      return tt(s, i, s[0], this.lexer);
    }
  }
  emStrong(e, t, s = "") {
    let n = this.rules.inline.emStrongLDelim.exec(e);
    if (!n || n[3] && s.match(/[\p{L}\p{N}]/u))
      return;
    if (!(n[1] || n[2] || "") || !s || this.rules.inline.punctuation.exec(s)) {
      const o = [...n[0]].length - 1;
      let a, l, p = o, c = 0;
      const h = n[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (h.lastIndex = 0, t = t.slice(-1 * e.length + o); (n = h.exec(t)) != null; ) {
        if (a = n[1] || n[2] || n[3] || n[4] || n[5] || n[6], !a)
          continue;
        if (l = [...a].length, n[3] || n[4]) {
          p += l;
          continue;
        } else if ((n[5] || n[6]) && o % 3 && !((o + l) % 3)) {
          c += l;
          continue;
        }
        if (p -= l, p > 0)
          continue;
        l = Math.min(l, l + p + c);
        const u = [...n[0]][0].length, d = e.slice(0, o + n.index + u + l);
        if (Math.min(o, l) % 2) {
          const x = d.slice(1, -1);
          return {
            type: "em",
            raw: d,
            text: x,
            tokens: this.lexer.inlineTokens(x)
          };
        }
        const f = d.slice(2, -2);
        return {
          type: "strong",
          raw: d,
          text: f,
          tokens: this.lexer.inlineTokens(f)
        };
      }
    }
  }
  codespan(e) {
    const t = this.rules.inline.code.exec(e);
    if (t) {
      let s = t[2].replace(/\n/g, " ");
      const n = /[^ ]/.test(s), i = /^ /.test(s) && / $/.test(s);
      return n && i && (s = s.substring(1, s.length - 1)), s = _(s, !0), {
        type: "codespan",
        raw: t[0],
        text: s
      };
    }
  }
  br(e) {
    const t = this.rules.inline.br.exec(e);
    if (t)
      return {
        type: "br",
        raw: t[0]
      };
  }
  del(e) {
    const t = this.rules.inline.del.exec(e);
    if (t)
      return {
        type: "del",
        raw: t[0],
        text: t[2],
        tokens: this.lexer.inlineTokens(t[2])
      };
  }
  autolink(e) {
    const t = this.rules.inline.autolink.exec(e);
    if (t) {
      let s, n;
      return t[2] === "@" ? (s = _(t[1]), n = "mailto:" + s) : (s = _(t[1]), n = s), {
        type: "link",
        raw: t[0],
        text: s,
        href: n,
        tokens: [
          {
            type: "text",
            raw: s,
            text: s
          }
        ]
      };
    }
  }
  url(e) {
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let s, n;
      if (t[2] === "@")
        s = _(t[0]), n = "mailto:" + s;
      else {
        let i;
        do
          i = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
        while (i !== t[0]);
        s = _(t[0]), t[1] === "www." ? n = "http://" + t[0] : n = t[0];
      }
      return {
        type: "link",
        raw: t[0],
        text: s,
        href: n,
        tokens: [
          {
            type: "text",
            raw: s,
            text: s
          }
        ]
      };
    }
  }
  inlineText(e) {
    const t = this.rules.inline.text.exec(e);
    if (t) {
      let s;
      return this.lexer.state.inRawBlock ? s = t[0] : s = _(t[0]), {
        type: "text",
        raw: t[0],
        text: s
      };
    }
  }
}
const gs = /^(?:[ \t]*(?:\n|$))+/, ms = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/, bs = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/, ne = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/, ks = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/, dt = /(?:[*+-]|\d{1,9}[.)])/, ft = m(/^(?!bull |blockCode|fences|blockquote|heading|html)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html))+?)\n {0,3}(=+|-+) *(?:\n+|$)/).replace(/bull/g, dt).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).getRegex(), Ee = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/, xs = /^[^\n]+/, Ce = /(?!\s*\])(?:\\.|[^\[\]\\])+/, ys = m(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", Ce).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(), ws = m(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, dt).getRegex(), fe = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul", Re = /<!--(?:-?>|[\s\S]*?(?:-->|$))/, $s = m("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", Re).replace("tag", fe).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(), gt = m(Ee).replace("hr", ne).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", fe).getRegex(), vs = m(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", gt).getRegex(), ze = {
  blockquote: vs,
  code: ms,
  def: ys,
  fences: bs,
  heading: ks,
  hr: ne,
  html: $s,
  lheading: ft,
  list: ws,
  newline: gs,
  paragraph: gt,
  table: Y,
  text: xs
}, st = m("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", ne).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", fe).getRegex(), _s = {
  ...ze,
  table: st,
  paragraph: m(Ee).replace("hr", ne).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", st).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", fe).getRegex()
}, As = {
  ...ze,
  html: m(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", Re).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: Y,
  // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: m(Ee).replace("hr", ne).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", ft).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
}, mt = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/, Ts = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/, bt = /^( {2,}|\\)\n(?!\s*$)/, Ss = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/, ie = "\\p{P}\\p{S}", Es = m(/^((?![*_])[\spunctuation])/, "u").replace(/punctuation/g, ie).getRegex(), Cs = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g, Rs = m(/^(?:\*+(?:((?!\*)[punct])|[^\s*]))|^_+(?:((?!_)[punct])|([^\s_]))/, "u").replace(/punct/g, ie).getRegex(), zs = m("^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)[punct](\\*+)(?=[\\s]|$)|[^punct\\s](\\*+)(?!\\*)(?=[punct\\s]|$)|(?!\\*)[punct\\s](\\*+)(?=[^punct\\s])|[\\s](\\*+)(?!\\*)(?=[punct])|(?!\\*)[punct](\\*+)(?!\\*)(?=[punct])|[^punct\\s](\\*+)(?=[^punct\\s])", "gu").replace(/punct/g, ie).getRegex(), Is = m("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)[punct](_+)(?=[\\s]|$)|[^punct\\s](_+)(?!_)(?=[punct\\s]|$)|(?!_)[punct\\s](_+)(?=[^punct\\s])|[\\s](_+)(?!_)(?=[punct])|(?!_)[punct](_+)(?!_)(?=[punct])", "gu").replace(/punct/g, ie).getRegex(), Ps = m(/\\([punct])/, "gu").replace(/punct/g, ie).getRegex(), Ms = m(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(), Ls = m(Re).replace("(?:-->|$)", "-->").getRegex(), Os = m("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", Ls).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(), pe = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/, Us = m(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/).replace("label", pe).replace("href", /<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(), kt = m(/^!?\[(label)\]\[(ref)\]/).replace("label", pe).replace("ref", Ce).getRegex(), xt = m(/^!?\[(ref)\](?:\[\])?/).replace("ref", Ce).getRegex(), Bs = m("reflink|nolink(?!\\()", "g").replace("reflink", kt).replace("nolink", xt).getRegex(), Ie = {
  _backpedal: Y,
  // only used for GFM url
  anyPunctuation: Ps,
  autolink: Ms,
  blockSkip: Cs,
  br: bt,
  code: Ts,
  del: Y,
  emStrongLDelim: Rs,
  emStrongRDelimAst: zs,
  emStrongRDelimUnd: Is,
  escape: mt,
  link: Us,
  nolink: xt,
  punctuation: Es,
  reflink: kt,
  reflinkSearch: Bs,
  tag: Os,
  text: Ss,
  url: Y
}, Hs = {
  ...Ie,
  link: m(/^!?\[(label)\]\((.*?)\)/).replace("label", pe).getRegex(),
  reflink: m(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", pe).getRegex()
}, xe = {
  ...Ie,
  escape: m(mt).replace("])", "~|])").getRegex(),
  url: m(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
}, Ns = {
  ...xe,
  br: m(bt).replace("{2,}", "*").getRegex(),
  text: m(xe.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
}, re = {
  normal: ze,
  gfm: _s,
  pedantic: As
}, Q = {
  normal: Ie,
  gfm: xe,
  breaks: Ns,
  pedantic: Hs
};
class A {
  constructor(e) {
    b(this, "tokens");
    b(this, "options");
    b(this, "state");
    b(this, "tokenizer");
    b(this, "inlineQueue");
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e || B, this.options.tokenizer = this.options.tokenizer || new he(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = {
      inLink: !1,
      inRawBlock: !1,
      top: !0
    };
    const t = {
      block: re.normal,
      inline: Q.normal
    };
    this.options.pedantic ? (t.block = re.pedantic, t.inline = Q.pedantic) : this.options.gfm && (t.block = re.gfm, this.options.breaks ? t.inline = Q.breaks : t.inline = Q.gfm), this.tokenizer.rules = t;
  }
  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block: re,
      inline: Q
    };
  }
  /**
   * Static Lex Method
   */
  static lex(e, t) {
    return new A(t).lex(e);
  }
  /**
   * Static Lex Inline Method
   */
  static lexInline(e, t) {
    return new A(t).inlineTokens(e);
  }
  /**
   * Preprocessing
   */
  lex(e) {
    e = e.replace(/\r\n|\r/g, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0; t < this.inlineQueue.length; t++) {
      const s = this.inlineQueue[t];
      this.inlineTokens(s.src, s.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], s = !1) {
    this.options.pedantic && (e = e.replace(/\t/g, "    ").replace(/^ +$/gm, ""));
    let n, i, o;
    for (; e; )
      if (!(this.options.extensions && this.options.extensions.block && this.options.extensions.block.some((a) => (n = a.call({ lexer: this }, e, t)) ? (e = e.substring(n.raw.length), t.push(n), !0) : !1))) {
        if (n = this.tokenizer.space(e)) {
          e = e.substring(n.raw.length), n.raw.length === 1 && t.length > 0 ? t[t.length - 1].raw += `
` : t.push(n);
          continue;
        }
        if (n = this.tokenizer.code(e)) {
          e = e.substring(n.raw.length), i = t[t.length - 1], i && (i.type === "paragraph" || i.type === "text") ? (i.raw += `
` + n.raw, i.text += `
` + n.text, this.inlineQueue[this.inlineQueue.length - 1].src = i.text) : t.push(n);
          continue;
        }
        if (n = this.tokenizer.fences(e)) {
          e = e.substring(n.raw.length), t.push(n);
          continue;
        }
        if (n = this.tokenizer.heading(e)) {
          e = e.substring(n.raw.length), t.push(n);
          continue;
        }
        if (n = this.tokenizer.hr(e)) {
          e = e.substring(n.raw.length), t.push(n);
          continue;
        }
        if (n = this.tokenizer.blockquote(e)) {
          e = e.substring(n.raw.length), t.push(n);
          continue;
        }
        if (n = this.tokenizer.list(e)) {
          e = e.substring(n.raw.length), t.push(n);
          continue;
        }
        if (n = this.tokenizer.html(e)) {
          e = e.substring(n.raw.length), t.push(n);
          continue;
        }
        if (n = this.tokenizer.def(e)) {
          e = e.substring(n.raw.length), i = t[t.length - 1], i && (i.type === "paragraph" || i.type === "text") ? (i.raw += `
` + n.raw, i.text += `
` + n.raw, this.inlineQueue[this.inlineQueue.length - 1].src = i.text) : this.tokens.links[n.tag] || (this.tokens.links[n.tag] = {
            href: n.href,
            title: n.title
          });
          continue;
        }
        if (n = this.tokenizer.table(e)) {
          e = e.substring(n.raw.length), t.push(n);
          continue;
        }
        if (n = this.tokenizer.lheading(e)) {
          e = e.substring(n.raw.length), t.push(n);
          continue;
        }
        if (o = e, this.options.extensions && this.options.extensions.startBlock) {
          let a = 1 / 0;
          const l = e.slice(1);
          let p;
          this.options.extensions.startBlock.forEach((c) => {
            p = c.call({ lexer: this }, l), typeof p == "number" && p >= 0 && (a = Math.min(a, p));
          }), a < 1 / 0 && a >= 0 && (o = e.substring(0, a + 1));
        }
        if (this.state.top && (n = this.tokenizer.paragraph(o))) {
          i = t[t.length - 1], s && i?.type === "paragraph" ? (i.raw += `
` + n.raw, i.text += `
` + n.text, this.inlineQueue.pop(), this.inlineQueue[this.inlineQueue.length - 1].src = i.text) : t.push(n), s = o.length !== e.length, e = e.substring(n.raw.length);
          continue;
        }
        if (n = this.tokenizer.text(e)) {
          e = e.substring(n.raw.length), i = t[t.length - 1], i && i.type === "text" ? (i.raw += `
` + n.raw, i.text += `
` + n.text, this.inlineQueue.pop(), this.inlineQueue[this.inlineQueue.length - 1].src = i.text) : t.push(n);
          continue;
        }
        if (e) {
          const a = "Infinite loop on byte: " + e.charCodeAt(0);
          if (this.options.silent) {
            console.error(a);
            break;
          } else
            throw new Error(a);
        }
      }
    return this.state.top = !0, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  /**
   * Lexing/Compiling
   */
  inlineTokens(e, t = []) {
    let s, n, i, o = e, a, l, p;
    if (this.tokens.links) {
      const c = Object.keys(this.tokens.links);
      if (c.length > 0)
        for (; (a = this.tokenizer.rules.inline.reflinkSearch.exec(o)) != null; )
          c.includes(a[0].slice(a[0].lastIndexOf("[") + 1, -1)) && (o = o.slice(0, a.index) + "[" + "a".repeat(a[0].length - 2) + "]" + o.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));
    }
    for (; (a = this.tokenizer.rules.inline.blockSkip.exec(o)) != null; )
      o = o.slice(0, a.index) + "[" + "a".repeat(a[0].length - 2) + "]" + o.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    for (; (a = this.tokenizer.rules.inline.anyPunctuation.exec(o)) != null; )
      o = o.slice(0, a.index) + "++" + o.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    for (; e; )
      if (l || (p = ""), l = !1, !(this.options.extensions && this.options.extensions.inline && this.options.extensions.inline.some((c) => (s = c.call({ lexer: this }, e, t)) ? (e = e.substring(s.raw.length), t.push(s), !0) : !1))) {
        if (s = this.tokenizer.escape(e)) {
          e = e.substring(s.raw.length), t.push(s);
          continue;
        }
        if (s = this.tokenizer.tag(e)) {
          e = e.substring(s.raw.length), n = t[t.length - 1], n && s.type === "text" && n.type === "text" ? (n.raw += s.raw, n.text += s.text) : t.push(s);
          continue;
        }
        if (s = this.tokenizer.link(e)) {
          e = e.substring(s.raw.length), t.push(s);
          continue;
        }
        if (s = this.tokenizer.reflink(e, this.tokens.links)) {
          e = e.substring(s.raw.length), n = t[t.length - 1], n && s.type === "text" && n.type === "text" ? (n.raw += s.raw, n.text += s.text) : t.push(s);
          continue;
        }
        if (s = this.tokenizer.emStrong(e, o, p)) {
          e = e.substring(s.raw.length), t.push(s);
          continue;
        }
        if (s = this.tokenizer.codespan(e)) {
          e = e.substring(s.raw.length), t.push(s);
          continue;
        }
        if (s = this.tokenizer.br(e)) {
          e = e.substring(s.raw.length), t.push(s);
          continue;
        }
        if (s = this.tokenizer.del(e)) {
          e = e.substring(s.raw.length), t.push(s);
          continue;
        }
        if (s = this.tokenizer.autolink(e)) {
          e = e.substring(s.raw.length), t.push(s);
          continue;
        }
        if (!this.state.inLink && (s = this.tokenizer.url(e))) {
          e = e.substring(s.raw.length), t.push(s);
          continue;
        }
        if (i = e, this.options.extensions && this.options.extensions.startInline) {
          let c = 1 / 0;
          const h = e.slice(1);
          let u;
          this.options.extensions.startInline.forEach((d) => {
            u = d.call({ lexer: this }, h), typeof u == "number" && u >= 0 && (c = Math.min(c, u));
          }), c < 1 / 0 && c >= 0 && (i = e.substring(0, c + 1));
        }
        if (s = this.tokenizer.inlineText(i)) {
          e = e.substring(s.raw.length), s.raw.slice(-1) !== "_" && (p = s.raw.slice(-1)), l = !0, n = t[t.length - 1], n && n.type === "text" ? (n.raw += s.raw, n.text += s.text) : t.push(s);
          continue;
        }
        if (e) {
          const c = "Infinite loop on byte: " + e.charCodeAt(0);
          if (this.options.silent) {
            console.error(c);
            break;
          } else
            throw new Error(c);
        }
      }
    return t;
  }
}
class ue {
  // set by the parser
  constructor(e) {
    b(this, "options");
    b(this, "parser");
    this.options = e || B;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: s }) {
    const n = (t || "").match(/^\S*/)?.[0], i = e.replace(/\n$/, "") + `
`;
    return n ? '<pre><code class="language-' + _(n) + '">' + (s ? i : _(i, !0)) + `</code></pre>
` : "<pre><code>" + (s ? i : _(i, !0)) + `</code></pre>
`;
  }
  blockquote({ tokens: e }) {
    return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
  }
  html({ text: e }) {
    return e;
  }
  heading({ tokens: e, depth: t }) {
    return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
  }
  hr(e) {
    return `<hr>
`;
  }
  list(e) {
    const t = e.ordered, s = e.start;
    let n = "";
    for (let a = 0; a < e.items.length; a++) {
      const l = e.items[a];
      n += this.listitem(l);
    }
    const i = t ? "ol" : "ul", o = t && s !== 1 ? ' start="' + s + '"' : "";
    return "<" + i + o + `>
` + n + "</" + i + `>
`;
  }
  listitem(e) {
    let t = "";
    if (e.task) {
      const s = this.checkbox({ checked: !!e.checked });
      e.loose ? e.tokens.length > 0 && e.tokens[0].type === "paragraph" ? (e.tokens[0].text = s + " " + e.tokens[0].text, e.tokens[0].tokens && e.tokens[0].tokens.length > 0 && e.tokens[0].tokens[0].type === "text" && (e.tokens[0].tokens[0].text = s + " " + e.tokens[0].tokens[0].text)) : e.tokens.unshift({
        type: "text",
        raw: s + " ",
        text: s + " "
      }) : t += s + " ";
    }
    return t += this.parser.parse(e.tokens, !!e.loose), `<li>${t}</li>
`;
  }
  checkbox({ checked: e }) {
    return "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  paragraph({ tokens: e }) {
    return `<p>${this.parser.parseInline(e)}</p>
`;
  }
  table(e) {
    let t = "", s = "";
    for (let i = 0; i < e.header.length; i++)
      s += this.tablecell(e.header[i]);
    t += this.tablerow({ text: s });
    let n = "";
    for (let i = 0; i < e.rows.length; i++) {
      const o = e.rows[i];
      s = "";
      for (let a = 0; a < o.length; a++)
        s += this.tablecell(o[a]);
      n += this.tablerow({ text: s });
    }
    return n && (n = `<tbody>${n}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + n + `</table>
`;
  }
  tablerow({ text: e }) {
    return `<tr>
${e}</tr>
`;
  }
  tablecell(e) {
    const t = this.parser.parseInline(e.tokens), s = e.header ? "th" : "td";
    return (e.align ? `<${s} align="${e.align}">` : `<${s}>`) + t + `</${s}>
`;
  }
  /**
   * span level renderer
   */
  strong({ tokens: e }) {
    return `<strong>${this.parser.parseInline(e)}</strong>`;
  }
  em({ tokens: e }) {
    return `<em>${this.parser.parseInline(e)}</em>`;
  }
  codespan({ text: e }) {
    return `<code>${e}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, tokens: s }) {
    const n = this.parser.parseInline(s), i = Xe(e);
    if (i === null)
      return n;
    e = i;
    let o = '<a href="' + e + '"';
    return t && (o += ' title="' + t + '"'), o += ">" + n + "</a>", o;
  }
  image({ href: e, title: t, text: s }) {
    const n = Xe(e);
    if (n === null)
      return s;
    e = n;
    let i = `<img src="${e}" alt="${s}"`;
    return t && (i += ` title="${t}"`), i += ">", i;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : e.text;
  }
}
class Pe {
  // no need for block level renderers
  strong({ text: e }) {
    return e;
  }
  em({ text: e }) {
    return e;
  }
  codespan({ text: e }) {
    return e;
  }
  del({ text: e }) {
    return e;
  }
  html({ text: e }) {
    return e;
  }
  text({ text: e }) {
    return e;
  }
  link({ text: e }) {
    return "" + e;
  }
  image({ text: e }) {
    return "" + e;
  }
  br() {
    return "";
  }
}
class T {
  constructor(e) {
    b(this, "options");
    b(this, "renderer");
    b(this, "textRenderer");
    this.options = e || B, this.options.renderer = this.options.renderer || new ue(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new Pe();
  }
  /**
   * Static Parse Method
   */
  static parse(e, t) {
    return new T(t).parse(e);
  }
  /**
   * Static Parse Inline Method
   */
  static parseInline(e, t) {
    return new T(t).parseInline(e);
  }
  /**
   * Parse Loop
   */
  parse(e, t = !0) {
    let s = "";
    for (let n = 0; n < e.length; n++) {
      const i = e[n];
      if (this.options.extensions && this.options.extensions.renderers && this.options.extensions.renderers[i.type]) {
        const a = i, l = this.options.extensions.renderers[a.type].call({ parser: this }, a);
        if (l !== !1 || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(a.type)) {
          s += l || "";
          continue;
        }
      }
      const o = i;
      switch (o.type) {
        case "space": {
          s += this.renderer.space(o);
          continue;
        }
        case "hr": {
          s += this.renderer.hr(o);
          continue;
        }
        case "heading": {
          s += this.renderer.heading(o);
          continue;
        }
        case "code": {
          s += this.renderer.code(o);
          continue;
        }
        case "table": {
          s += this.renderer.table(o);
          continue;
        }
        case "blockquote": {
          s += this.renderer.blockquote(o);
          continue;
        }
        case "list": {
          s += this.renderer.list(o);
          continue;
        }
        case "html": {
          s += this.renderer.html(o);
          continue;
        }
        case "paragraph": {
          s += this.renderer.paragraph(o);
          continue;
        }
        case "text": {
          let a = o, l = this.renderer.text(a);
          for (; n + 1 < e.length && e[n + 1].type === "text"; )
            a = e[++n], l += `
` + this.renderer.text(a);
          t ? s += this.renderer.paragraph({
            type: "paragraph",
            raw: l,
            text: l,
            tokens: [{ type: "text", raw: l, text: l }]
          }) : s += l;
          continue;
        }
        default: {
          const a = 'Token with "' + o.type + '" type was not found.';
          if (this.options.silent)
            return console.error(a), "";
          throw new Error(a);
        }
      }
    }
    return s;
  }
  /**
   * Parse Inline Tokens
   */
  parseInline(e, t) {
    t = t || this.renderer;
    let s = "";
    for (let n = 0; n < e.length; n++) {
      const i = e[n];
      if (this.options.extensions && this.options.extensions.renderers && this.options.extensions.renderers[i.type]) {
        const a = this.options.extensions.renderers[i.type].call({ parser: this }, i);
        if (a !== !1 || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(i.type)) {
          s += a || "";
          continue;
        }
      }
      const o = i;
      switch (o.type) {
        case "escape": {
          s += t.text(o);
          break;
        }
        case "html": {
          s += t.html(o);
          break;
        }
        case "link": {
          s += t.link(o);
          break;
        }
        case "image": {
          s += t.image(o);
          break;
        }
        case "strong": {
          s += t.strong(o);
          break;
        }
        case "em": {
          s += t.em(o);
          break;
        }
        case "codespan": {
          s += t.codespan(o);
          break;
        }
        case "br": {
          s += t.br(o);
          break;
        }
        case "del": {
          s += t.del(o);
          break;
        }
        case "text": {
          s += t.text(o);
          break;
        }
        default: {
          const a = 'Token with "' + o.type + '" type was not found.';
          if (this.options.silent)
            return console.error(a), "";
          throw new Error(a);
        }
      }
    }
    return s;
  }
}
class X {
  constructor(e) {
    b(this, "options");
    b(this, "block");
    this.options = e || B;
  }
  /**
   * Process markdown before marked
   */
  preprocess(e) {
    return e;
  }
  /**
   * Process HTML after marked is finished
   */
  postprocess(e) {
    return e;
  }
  /**
   * Process all tokens before walk tokens
   */
  processAllTokens(e) {
    return e;
  }
  /**
   * Provide function to tokenize markdown
   */
  provideLexer() {
    return this.block ? A.lex : A.lexInline;
  }
  /**
   * Provide function to parse tokens
   */
  provideParser() {
    return this.block ? T.parse : T.parseInline;
  }
}
b(X, "passThroughHooks", /* @__PURE__ */ new Set([
  "preprocess",
  "postprocess",
  "processAllTokens"
]));
class js {
  constructor(...e) {
    b(this, "defaults", Se());
    b(this, "options", this.setOptions);
    b(this, "parse", this.parseMarkdown(!0));
    b(this, "parseInline", this.parseMarkdown(!1));
    b(this, "Parser", T);
    b(this, "Renderer", ue);
    b(this, "TextRenderer", Pe);
    b(this, "Lexer", A);
    b(this, "Tokenizer", he);
    b(this, "Hooks", X);
    this.use(...e);
  }
  /**
   * Run callback for every token
   */
  walkTokens(e, t) {
    let s = [];
    for (const n of e)
      switch (s = s.concat(t.call(this, n)), n.type) {
        case "table": {
          const i = n;
          for (const o of i.header)
            s = s.concat(this.walkTokens(o.tokens, t));
          for (const o of i.rows)
            for (const a of o)
              s = s.concat(this.walkTokens(a.tokens, t));
          break;
        }
        case "list": {
          const i = n;
          s = s.concat(this.walkTokens(i.items, t));
          break;
        }
        default: {
          const i = n;
          this.defaults.extensions?.childTokens?.[i.type] ? this.defaults.extensions.childTokens[i.type].forEach((o) => {
            const a = i[o].flat(1 / 0);
            s = s.concat(this.walkTokens(a, t));
          }) : i.tokens && (s = s.concat(this.walkTokens(i.tokens, t)));
        }
      }
    return s;
  }
  use(...e) {
    const t = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e.forEach((s) => {
      const n = { ...s };
      if (n.async = this.defaults.async || n.async || !1, s.extensions && (s.extensions.forEach((i) => {
        if (!i.name)
          throw new Error("extension name required");
        if ("renderer" in i) {
          const o = t.renderers[i.name];
          o ? t.renderers[i.name] = function(...a) {
            let l = i.renderer.apply(this, a);
            return l === !1 && (l = o.apply(this, a)), l;
          } : t.renderers[i.name] = i.renderer;
        }
        if ("tokenizer" in i) {
          if (!i.level || i.level !== "block" && i.level !== "inline")
            throw new Error("extension level must be 'block' or 'inline'");
          const o = t[i.level];
          o ? o.unshift(i.tokenizer) : t[i.level] = [i.tokenizer], i.start && (i.level === "block" ? t.startBlock ? t.startBlock.push(i.start) : t.startBlock = [i.start] : i.level === "inline" && (t.startInline ? t.startInline.push(i.start) : t.startInline = [i.start]));
        }
        "childTokens" in i && i.childTokens && (t.childTokens[i.name] = i.childTokens);
      }), n.extensions = t), s.renderer) {
        const i = this.defaults.renderer || new ue(this.defaults);
        for (const o in s.renderer) {
          if (!(o in i))
            throw new Error(`renderer '${o}' does not exist`);
          if (["options", "parser"].includes(o))
            continue;
          const a = o, l = s.renderer[a], p = i[a];
          i[a] = (...c) => {
            let h = l.apply(i, c);
            return h === !1 && (h = p.apply(i, c)), h || "";
          };
        }
        n.renderer = i;
      }
      if (s.tokenizer) {
        const i = this.defaults.tokenizer || new he(this.defaults);
        for (const o in s.tokenizer) {
          if (!(o in i))
            throw new Error(`tokenizer '${o}' does not exist`);
          if (["options", "rules", "lexer"].includes(o))
            continue;
          const a = o, l = s.tokenizer[a], p = i[a];
          i[a] = (...c) => {
            let h = l.apply(i, c);
            return h === !1 && (h = p.apply(i, c)), h;
          };
        }
        n.tokenizer = i;
      }
      if (s.hooks) {
        const i = this.defaults.hooks || new X();
        for (const o in s.hooks) {
          if (!(o in i))
            throw new Error(`hook '${o}' does not exist`);
          if (["options", "block"].includes(o))
            continue;
          const a = o, l = s.hooks[a], p = i[a];
          X.passThroughHooks.has(o) ? i[a] = (c) => {
            if (this.defaults.async)
              return Promise.resolve(l.call(i, c)).then((u) => p.call(i, u));
            const h = l.call(i, c);
            return p.call(i, h);
          } : i[a] = (...c) => {
            let h = l.apply(i, c);
            return h === !1 && (h = p.apply(i, c)), h;
          };
        }
        n.hooks = i;
      }
      if (s.walkTokens) {
        const i = this.defaults.walkTokens, o = s.walkTokens;
        n.walkTokens = function(a) {
          let l = [];
          return l.push(o.call(this, a)), i && (l = l.concat(i.call(this, a))), l;
        };
      }
      this.defaults = { ...this.defaults, ...n };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return A.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return T.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (s, n) => {
      const i = { ...n }, o = { ...this.defaults, ...i }, a = this.onError(!!o.silent, !!o.async);
      if (this.defaults.async === !0 && i.async === !1)
        return a(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof s > "u" || s === null)
        return a(new Error("marked(): input parameter is undefined or null"));
      if (typeof s != "string")
        return a(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(s) + ", string expected"));
      o.hooks && (o.hooks.options = o, o.hooks.block = e);
      const l = o.hooks ? o.hooks.provideLexer() : e ? A.lex : A.lexInline, p = o.hooks ? o.hooks.provideParser() : e ? T.parse : T.parseInline;
      if (o.async)
        return Promise.resolve(o.hooks ? o.hooks.preprocess(s) : s).then((c) => l(c, o)).then((c) => o.hooks ? o.hooks.processAllTokens(c) : c).then((c) => o.walkTokens ? Promise.all(this.walkTokens(c, o.walkTokens)).then(() => c) : c).then((c) => p(c, o)).then((c) => o.hooks ? o.hooks.postprocess(c) : c).catch(a);
      try {
        o.hooks && (s = o.hooks.preprocess(s));
        let c = l(s, o);
        o.hooks && (c = o.hooks.processAllTokens(c)), o.walkTokens && this.walkTokens(c, o.walkTokens);
        let h = p(c, o);
        return o.hooks && (h = o.hooks.postprocess(h)), h;
      } catch (c) {
        return a(c);
      }
    };
  }
  onError(e, t) {
    return (s) => {
      if (s.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        const n = "<p>An error occurred:</p><pre>" + _(s.message + "", !0) + "</pre>";
        return t ? Promise.resolve(n) : n;
      }
      if (t)
        return Promise.reject(s);
      throw s;
    };
  }
}
const O = new js();
function g(r, e) {
  return O.parse(r, e);
}
g.options = g.setOptions = function(r) {
  return O.setOptions(r), g.defaults = O.defaults, ht(g.defaults), g;
};
g.getDefaults = Se;
g.defaults = B;
g.use = function(...r) {
  return O.use(...r), g.defaults = O.defaults, ht(g.defaults), g;
};
g.walkTokens = function(r, e) {
  return O.walkTokens(r, e);
};
g.parseInline = O.parseInline;
g.Parser = T;
g.parser = T.parse;
g.Renderer = ue;
g.TextRenderer = Pe;
g.Lexer = A;
g.lexer = A.lex;
g.Tokenizer = he;
g.Hooks = X;
g.parse = g;
g.options;
g.setOptions;
g.use;
g.walkTokens;
g.parseInline;
T.parse;
A.lex;
const qs = /* @__PURE__ */ new Set([
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "del",
  "s",
  "mark",
  "sub",
  "sup",
  "code",
  "pre",
  "kbd",
  "samp",
  "var",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "span",
  "div",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td"
]), Ds = /* @__PURE__ */ new Set(["class"]), Zs = {
  a: /* @__PURE__ */ new Set(["href", "title", "target", "rel"]),
  td: /* @__PURE__ */ new Set(["align"]),
  th: /* @__PURE__ */ new Set(["align"])
};
function Fs(r) {
  const t = r.trim().replace(/[ -]/g, "");
  return !!(/^(https?:|mailto:|tel:)/i.test(t) || /^[#/.?]/.test(t) || /^[\w.-]+$/.test(t));
}
function Ks(r) {
  if (typeof DOMParser > "u")
    return Qs(r);
  const t = new DOMParser().parseFromString(`<div>${r}</div>`, "text/html").body.firstElementChild;
  if (!t) return "";
  const s = (n) => {
    const i = Array.from(n.children);
    for (const o of i) {
      const a = o.tagName.toLowerCase();
      if (!qs.has(a)) {
        o.remove();
        continue;
      }
      for (const l of Array.from(o.attributes)) {
        const p = l.name.toLowerCase();
        if (!(Ds.has(p) || (Zs[a]?.has(p) ?? !1)) || p.startsWith("on") || p === "style") {
          o.removeAttribute(l.name);
          continue;
        }
        (p === "href" || p === "src") && (Fs(l.value) || o.removeAttribute(l.name));
      }
      a === "a" && o.getAttribute("href") && (o.setAttribute("target", "_blank"), o.setAttribute("rel", "noopener noreferrer nofollow")), s(o);
    }
  };
  return s(t), t.innerHTML;
}
function Qs(r) {
  return r.replace(/<\/?(?:script|style|iframe|object|embed|link|meta)[^>]*>/gi, "").replace(/ on\w+="[^"]*"/gi, "").replace(/ on\w+='[^']*'/gi, "").replace(/javascript:/gi, "");
}
g.use({
  gfm: !0,
  breaks: !0,
  renderer: {
    // Drop raw HTML blocks/inline entirely — they're escaped text only.
    html(r) {
      return yt(r.raw);
    }
  }
});
function yt(r) {
  return r.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function Ws(r) {
  if (!r) return "";
  let e;
  try {
    e = g.parse(r, { async: !1 });
  } catch {
    return yt(r).replace(/\n/g, "<br>");
  }
  return Ks(e);
}
var Gs = Object.defineProperty, Vs = Object.getOwnPropertyDescriptor, w = (r, e, t, s) => {
  for (var n = s > 1 ? void 0 : s ? Vs(e, t) : e, i = r.length - 1, o; i >= 0; i--)
    (o = r[i]) && (n = (s ? o(e, t, n) : o(n)) || n);
  return s && n && Gs(e, t, n), n;
};
const nt = "clankstack:visitor_id";
let oe = 0, y = class extends J {
  constructor() {
    super(...arguments), this.publishableKey = "", this.endpoint = "https://api.clankstack.dev", this.agent = "", this.mode = "popup", this.theme = "auto", this.title = "", this.greeting = "", this.placeholder = "Ask anything…", this.persistSession = !1, this.open_ = !1, this.messages = [], this.streaming = !1, this.ready = !1, this.resolvedTitle = "", this.resolvedGreeting = "", this.draft = "", this.client = null, this.sessionConfig = null, this.abortStream = null, this.mql = null, this.onThemeChange = () => this.applyResolvedTheme();
  }
  // ---- Lifecycle ----
  connectedCallback() {
    super.connectedCallback(), this.applyResolvedTheme(), this.theme === "auto" && (this.mql = window.matchMedia("(prefers-color-scheme: dark)"), this.mql.addEventListener("change", this.onThemeChange));
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.mql?.removeEventListener("change", this.onThemeChange), this.abortStream?.();
  }
  firstUpdated() {
    this.bootstrap();
  }
  updated(r) {
    r.has("theme") && this.applyResolvedTheme(), (r.has("publishableKey") || r.has("endpoint") || r.has("persistSession")) && this.hasUpdated && r.size && this.ready && this.bootstrap();
  }
  applyResolvedTheme() {
    let r = "light";
    this.theme === "dark" ? r = "dark" : this.theme === "light" ? r = "light" : r = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", this.setAttribute("data-resolved-theme", r);
  }
  bootstrap() {
    if (!this.publishableKey) {
      console.error("[clankstack-agent] publishable-key attribute is required");
      return;
    }
    const r = this.persistSession ? this.getVisitorId() : void 0;
    this.client = new ls({
      endpoint: this.endpoint,
      publishableKey: this.publishableKey,
      ...r ? { visitorId: r } : {}
    }), this.resolvedTitle = this.title || "Assistant", this.resolvedGreeting = this.greeting, this.ready = !0, this.emit("clankstack:ready", {});
  }
  getVisitorId() {
    try {
      const r = localStorage.getItem(nt);
      if (r) return r;
      const e = `vis_${crypto.randomUUID()}`;
      return localStorage.setItem(nt, e), e;
    } catch {
      return `vis_${Math.random().toString(36).slice(2)}`;
    }
  }
  // ---- Session config resolution ----
  async ensureConfig() {
    if (!(!this.client || this.sessionConfig))
      try {
        const r = await this.client.ensureSession();
        this.sessionConfig = r, !this.title && r.title && (this.resolvedTitle = r.title), !this.greeting && r.greeting && (this.resolvedGreeting = r.greeting), this.applyThemeConfig(r.theme), this.emit("clankstack:session", r), this.seedGreeting();
      } catch (r) {
        this.handleError(r);
      }
  }
  applyThemeConfig(r) {
    if (!r || typeof r != "object") return;
    const e = {
      accent: "--cs-accent",
      accentFg: "--cs-accent-fg",
      radius: "--cs-radius",
      font: "--cs-font",
      bg: "--cs-bg",
      fg: "--cs-fg",
      surface: "--cs-surface"
    };
    for (const [t, s] of Object.entries(e)) {
      const n = r[t];
      typeof n == "string" && n && this.style.setProperty(s, n);
    }
  }
  seedGreeting() {
    this.resolvedGreeting && this.messages.length === 0 && (this.messages = [
      {
        id: ++oe,
        role: "assistant",
        content: this.resolvedGreeting
      }
    ]);
  }
  // ---- Public imperative API ----
  open() {
    this.open_ || (this.open_ = !0, this.ensureConfig(), this.emit("clankstack:open", {}), this.updateComplete.then(() => this.focusInput()));
  }
  close() {
    this.open_ && (this.open_ = !1, this.emit("clankstack:close", {}));
  }
  reset() {
    this.abortStream?.(), this.streaming = !1, this.messages = [], this.sessionConfig = null, this.client?.reset(), this.ensureConfig();
  }
  async sendMessage(r) {
    const e = r.trim();
    if (!e || this.streaming || !this.client) return;
    await this.ensureConfig();
    const t = {
      id: ++oe,
      role: "user",
      content: e
    }, s = {
      id: ++oe,
      role: "assistant",
      content: "",
      streaming: !0
    };
    this.messages = [...this.messages, t, s], this.streaming = !0, this.emit("clankstack:message", { role: "user", content: e }), this.scrollToBottom();
    let n = !1;
    this.abortStream = () => {
      n = !0;
    };
    try {
      const i = this.client.send(e);
      for await (const o of i) {
        if (n) break;
        s.content += o, this.bumpMessage(s.id, { content: s.content }), this.scrollToBottom();
      }
      n || (this.bumpMessage(s.id, { streaming: !1 }), this.emit("clankstack:message", {
        role: "assistant",
        content: s.content
      }));
    } catch (i) {
      this.messages = this.messages.filter((o) => o.id !== s.id), this.handleError(i);
    } finally {
      this.streaming = !1, this.abortStream = null, this.scrollToBottom(), this.updateComplete.then(() => this.focusInput());
    }
  }
  bumpMessage(r, e) {
    this.messages = this.messages.map((t) => t.id === r ? { ...t, ...e } : t);
  }
  handleError(r) {
    const e = r instanceof v ? r : new v("internal_error", r?.message ?? "Unknown error"), t = this.friendlyError(e);
    this.messages = [
      ...this.messages,
      { id: ++oe, role: "assistant", content: t, error: !0 }
    ], this.emit("clankstack:error", { code: e.code, message: e.message }), this.scrollToBottom();
  }
  friendlyError(r) {
    switch (r.code) {
      case "quota_exceeded":
      case "session_quota_exceeded":
        return "This assistant is temporarily unavailable. Please try again later.";
      case "rate_limited":
        return "You're sending messages too quickly — please slow down.";
      case "origin_denied":
        return "This assistant is not enabled for this site.";
      case "embed_not_found":
        return "This assistant is not configured. Please contact the site owner.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  // ---- UI events ----
  onInput(r) {
    const e = r.target;
    this.draft = e.value, e.style.height = "auto", e.style.height = `${Math.min(e.scrollHeight, 120)}px`;
  }
  onKeydown(r) {
    r.key === "Enter" && !r.shiftKey && (r.preventDefault(), this.submit());
  }
  submit() {
    const r = this.draft.trim();
    if (!r || this.streaming) return;
    this.draft = "";
    const e = this.renderRoot.querySelector(".input");
    e && (e.style.height = "auto"), this.sendMessage(r);
  }
  focusInput() {
    this.renderRoot.querySelector(".input")?.focus();
  }
  scrollToBottom() {
    this.updateComplete.then(() => {
      const r = this.renderRoot.querySelector(".messages");
      r && (r.scrollTop = r.scrollHeight);
    });
  }
  emit(r, e) {
    this.dispatchEvent(
      new CustomEvent(r, { detail: e, bubbles: !0, composed: !0 })
    );
  }
  toggle() {
    this.open_ ? this.close() : this.open();
  }
  // ---- Render ----
  render() {
    const r = this.mode === "popup", e = this.mode !== "popup" || this.open_;
    return S`
      ${r ? this.renderLauncher() : k}
      ${e ? this.renderPanel() : k}
    `;
  }
  renderLauncher() {
    return S`
      <button
        class="launcher"
        part="launcher"
        @click=${this.toggle}
        aria-label=${this.open_ ? "Close chat" : "Open chat"}
        aria-expanded=${this.open_ ? "true" : "false"}
      >
        ${this.open_ ? it() : Js()}
      </button>
    `;
  }
  renderPanel() {
    return S`
      <section
        class="panel"
        part="panel"
        role="dialog"
        aria-label=${this.resolvedTitle || "Chat"}
      >
        <header class="header" part="header">
          <span class="dot" aria-hidden="true"></span>
          <span class="title">${this.resolvedTitle}</span>
          ${this.agent || this.sessionConfig?.agent ? S`<span class="agent"
                >${this.agent || this.sessionConfig?.agent}</span
              >` : k}
          ${this.mode !== "inline" ? S`<button
                class="icon-btn"
                part="close"
                @click=${this.close}
                aria-label="Close chat"
              >
                ${it()}
              </button>` : k}
        </header>

        <div
          class="messages"
          part="messages"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          ${ts(
      this.messages,
      (r) => r.id,
      (r) => this.renderMessage(r)
    )}
        </div>

        <form
          class="composer"
          part="composer"
          @submit=${(r) => {
      r.preventDefault(), this.submit();
    }}
        >
          <label class="sr-only" for="kc-input">Message</label>
          <textarea
            id="kc-input"
            class="input"
            part="input"
            rows="1"
            .value=${this.draft}
            placeholder=${this.placeholder}
            ?disabled=${this.streaming || !this.ready}
            aria-label="Message"
            @input=${this.onInput}
            @keydown=${this.onKeydown}
          ></textarea>
          <button
            class="send"
            part="send"
            type="submit"
            ?disabled=${this.streaming || !this.draft.trim() || !this.ready}
            aria-label="Send message"
          >
            ${Ys()}
          </button>
        </form>
      </section>
    `;
  }
  renderMessage(r) {
    const e = ns({
      bubble: !0,
      [r.role]: !0,
      error: !!r.error
    }), t = r.streaming && r.content.length === 0, s = r.role === "assistant" && !r.error ? ss(Ws(r.content)) : r.content;
    return S`
      <div class="row ${r.role}">
        <div class=${e} part="message">
          ${t ? this.renderTyping() : s}
        </div>
      </div>
    `;
  }
  renderTyping() {
    return S`<span class="typing" part="typing" aria-label="Assistant is typing">
      <span></span><span></span><span></span>
    </span>`;
  }
};
y.styles = At`
    :host {
      --cs-accent: #6d28d9;
      --cs-accent-fg: #ffffff;
      --cs-radius: 16px;
      --cs-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
        Arial, sans-serif;
      --cs-bg: #ffffff;
      --cs-fg: #1f2330;
      --cs-surface: #f4f5f7;
      --cs-surface-2: #eceef1;
      --cs-border: #e2e4e9;
      --cs-muted: #6b7280;
      --cs-user-bg: var(--cs-accent);
      --cs-user-fg: var(--cs-accent-fg);
      --cs-shadow: 0 12px 40px rgba(15, 18, 30, 0.18);
      --cs-z: 2147483000;

      font-family: var(--cs-font);
      color: var(--cs-fg);
      box-sizing: border-box;
    }
    :host([theme='dark']),
    :host([data-resolved-theme='dark']) {
      --cs-bg: #16181d;
      --cs-fg: #f2f3f5;
      --cs-surface: #21242b;
      --cs-surface-2: #2a2e37;
      --cs-border: #353a44;
      --cs-muted: #9aa1ad;
      --cs-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    }
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    /* ---- Launcher (popup mode) ---- */
    .launcher {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: var(--cs-accent);
      color: var(--cs-accent-fg);
      cursor: pointer;
      box-shadow: var(--cs-shadow);
      display: grid;
      place-items: center;
      z-index: var(--cs-z);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }
    .launcher:hover {
      transform: translateY(-2px) scale(1.03);
    }
    .launcher:focus-visible {
      outline: 3px solid var(--cs-accent);
      outline-offset: 3px;
    }
    .launcher svg {
      width: 26px;
      height: 26px;
    }

    /* ---- Panel ---- */
    .panel {
      display: flex;
      flex-direction: column;
      background: var(--cs-bg);
      color: var(--cs-fg);
      border: 1px solid var(--cs-border);
      border-radius: var(--cs-radius);
      box-shadow: var(--cs-shadow);
      overflow: hidden;
      min-height: 0;
    }
    :host([mode='popup']) .panel {
      position: fixed;
      bottom: 88px;
      right: 20px;
      width: min(384px, calc(100vw - 40px));
      height: min(560px, calc(100vh - 120px));
      z-index: var(--cs-z);
      transform-origin: bottom right;
      animation: kc-pop 0.18s ease;
    }
    :host([mode='inline']) .panel {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 420px;
    }
    :host([mode='fullscreen']) .panel {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      border-radius: 0;
      border: none;
      z-index: var(--cs-z);
    }
    @keyframes kc-pop {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel,
      .launcher {
        animation: none !important;
        transition: none !important;
      }
    }

    /* ---- Header ---- */
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: var(--cs-surface);
      border-bottom: 1px solid var(--cs-border);
      flex: 0 0 auto;
    }
    .header .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #2ecc71;
      flex: 0 0 auto;
    }
    .header .title {
      font-weight: 600;
      font-size: 15px;
      flex: 1 1 auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header .agent {
      font-size: 12px;
      color: var(--cs-muted);
    }
    .icon-btn {
      background: transparent;
      border: none;
      color: var(--cs-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 8px;
      display: grid;
      place-items: center;
    }
    .icon-btn:hover {
      background: var(--cs-surface-2);
      color: var(--cs-fg);
    }
    .icon-btn:focus-visible {
      outline: 2px solid var(--cs-accent);
    }

    /* ---- Messages ---- */
    .messages {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }
    @media (prefers-reduced-motion: reduce) {
      .messages {
        scroll-behavior: auto;
      }
    }
    .row {
      display: flex;
      max-width: 100%;
    }
    .row.user {
      justify-content: flex-end;
    }
    .bubble {
      max-width: 82%;
      padding: 9px 13px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    .bubble.assistant {
      background: var(--cs-surface);
      border-top-left-radius: 4px;
    }
    .bubble.user {
      background: var(--cs-user-bg);
      color: var(--cs-user-fg);
      border-top-right-radius: 4px;
    }
    .bubble.error {
      background: #fdecec;
      color: #8a1c1c;
      border: 1px solid #f3c2c2;
    }
    :host([theme='dark']) .bubble.error,
    :host([data-resolved-theme='dark']) .bubble.error {
      background: #3a1d1d;
      color: #ffb4b4;
      border-color: #5c2a2a;
    }
    .bubble :first-child {
      margin-top: 0;
    }
    .bubble :last-child {
      margin-bottom: 0;
    }
    .bubble p {
      margin: 0 0 8px;
    }
    .bubble pre {
      background: var(--cs-surface-2);
      padding: 10px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12.5px;
    }
    .bubble code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.9em;
    }
    .bubble :not(pre) > code {
      background: var(--cs-surface-2);
      padding: 1px 5px;
      border-radius: 5px;
    }
    .bubble a {
      color: var(--cs-accent);
    }
    .bubble ul,
    .bubble ol {
      margin: 0 0 8px;
      padding-left: 20px;
    }

    /* Typing indicator */
    .typing {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 4px 2px;
    }
    .typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--cs-muted);
      animation: kc-blink 1.2s infinite ease-in-out both;
    }
    .typing span:nth-child(2) {
      animation-delay: 0.18s;
    }
    .typing span:nth-child(3) {
      animation-delay: 0.36s;
    }
    @keyframes kc-blink {
      0%,
      80%,
      100% {
        opacity: 0.25;
      }
      40% {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .typing span {
        animation: none;
        opacity: 0.6;
      }
    }

    /* ---- Composer ---- */
    .composer {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      padding: 12px;
      border-top: 1px solid var(--cs-border);
      background: var(--cs-bg);
      flex: 0 0 auto;
    }
    .input {
      flex: 1 1 auto;
      resize: none;
      border: 1px solid var(--cs-border);
      border-radius: 12px;
      padding: 9px 12px;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.4;
      max-height: 120px;
      background: var(--cs-bg);
      color: var(--cs-fg);
      outline: none;
    }
    .input:focus {
      border-color: var(--cs-accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--cs-accent) 20%, transparent);
    }
    .input:disabled {
      opacity: 0.6;
    }
    .send {
      flex: 0 0 auto;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: var(--cs-accent);
      color: var(--cs-accent-fg);
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .send:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .send:focus-visible {
      outline: 2px solid var(--cs-accent);
      outline-offset: 2px;
    }
    .send svg {
      width: 18px;
      height: 18px;
    }
    .footer {
      text-align: center;
      font-size: 10.5px;
      color: var(--cs-muted);
      padding: 0 0 8px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;
w([
  E({ attribute: "publishable-key" })
], y.prototype, "publishableKey", 2);
w([
  E()
], y.prototype, "endpoint", 2);
w([
  E()
], y.prototype, "agent", 2);
w([
  E()
], y.prototype, "mode", 2);
w([
  E()
], y.prototype, "theme", 2);
w([
  E()
], y.prototype, "title", 2);
w([
  E()
], y.prototype, "greeting", 2);
w([
  E()
], y.prototype, "placeholder", 2);
w([
  E({ attribute: "persist-session", type: Boolean })
], y.prototype, "persistSession", 2);
w([
  U()
], y.prototype, "open_", 2);
w([
  U()
], y.prototype, "messages", 2);
w([
  U()
], y.prototype, "streaming", 2);
w([
  U()
], y.prototype, "ready", 2);
w([
  U()
], y.prototype, "resolvedTitle", 2);
w([
  U()
], y.prototype, "resolvedGreeting", 2);
w([
  U()
], y.prototype, "draft", 2);
y = w([
  Wt("clankstack-agent")
], y);
function Js() {
  return S`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4.2 3.2A.6.6 0 0 1 4 18.7V5.5Z"
      fill="currentColor"
    />
  </svg>`;
}
function it() {
  return S`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M6 6l12 12M18 6L6 18"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>`;
}
function Ys() {
  return S`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3.4 20.4 21 12 3.4 3.6 3.4 10l11 2-11 2v6.4Z"
      fill="currentColor"
    />
  </svg>`;
}
typeof customElements < "u" && !customElements.get("clankstack-agent") && customElements.define("clankstack-agent", y);
export {
  ls as ClankstackAgent,
  y as ClankstackAgentElement,
  v as ClankstackError,
  os as DEFAULT_ENDPOINT,
  is as SSEParser,
  rs as parseSSEStream,
  Ws as renderMarkdown
};
//# sourceMappingURL=agent.js.map
