/**
 * Sapience attribution collector — first-party, same-origin.
 *
 * Talks only to kairos.trade/_a/e, which Next rewrites to Sapience. That keeps the
 * cookie first-party and server-set (HttpOnly), which is the one thing GA4
 * cannot do: `_ga` is written by JavaScript, so Safari's ITP expires it after 7
 * days and any "read a blog post, converted three weeks later" journey is lost.
 * We never touch the cookie from here — the server sets it and the browser
 * returns it. There is deliberately nothing to read.
 *
 * Sends three things on its own, plus what the site tells it:
 *   pageview    — every route change
 *   click       — autocaptured, so CTR works on buttons nobody instrumented
 *   impression  — element actually entered the viewport
 *   identify / signup / track — see the globals at the bottom. identify() says
 *                 WHO the cookie is; signup() is the conversion; track() is any
 *                 other named conversion. Keeping who and what separate is the
 *                 whole reason signup exists.
 *
 * That last one is why this exists rather than a click listener. CTR needs a
 * denominator, and nothing off the shelf captures element visibility. Using
 * pageviews instead understates a below-fold CTA by however many visitors never
 * scrolled to it, which is how a button that was working gets killed.
 */
(function () {
  // Injected by the collector when it serves this file, from ?s=<site_key>.
  // The script is served THROUGH the client's own rewrite, so it is same-origin
  // (ad blockers leave it alone) and centrally updatable — no client redeploys
  // to ship a tracker fix.
  var SITE = 'origami'
  var SRC = new URL(document.currentScript ? document.currentScript.src : '/_a/a.js', location.href)
  var ENDPOINT = SRC.pathname.replace(/\/[^/]*$/, '/e')

  // ---- proxy mode vs direct mode ----
  // Proxy mode (the default, and the point of the design): the script came
  // through the site's own /_a rewrite, so ENDPOINT is same-origin and the
  // server sets the cookie — HttpOnly, two years, survives Safari's ITP.
  //
  // Direct mode: the script was loaded straight from the collector, because
  // the platform cannot proxy (Squarespace, Wix, Shopify, a WordPress host
  // without the plugin). The browser talks cross-origin, so the server's
  // Set-Cookie is useless here; the tracker keeps the visitor id itself in a
  // JS cookie on the site's own domain (backed by localStorage) and sends it
  // in the body. Everything downstream is identical. The cost is honest:
  // Safari caps JS-written cookies at 7 days, so a "read a post, came back a
  // month later" journey can be lost on Safari in direct mode. Chrome and
  // Firefox keep it. The Script page says which mode a site is in.
  var DIRECT = SRC.host !== location.host
  if (DIRECT) ENDPOINT = SRC.origin + ENDPOINT
  var KEY = '_gv'

  function readId() {
    var m = document.cookie.match(/(?:^|;\s*)_gv=([^;]+)/)
    if (m) return m[1]
    try { return localStorage.getItem(KEY) } catch (e) { return null }
  }
  function writeId(id) {
    // Apex domain so app.<site> shares it, same as the server-set cookie.
    var parts = location.hostname.split('.')
    var apex = parts.length > 2 ? parts.slice(-2).join('.') : location.hostname
    document.cookie = KEY + '=' + id + '; Max-Age=63072000; Path=/; Domain=' + apex + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '')
    try { localStorage.setItem(KEY, id) } catch (e) { /* private mode */ }
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
  }
  var directId = null
  if (DIRECT) {
    directId = readId()
    if (!directId) directId = uuid()
    writeId(directId) // refresh the 2-year window on every visit
  }

  var queue = []
  var flushTimer = null

  function send(extra) {
    var payload = Object.assign(
      {
        site: SITE,
        url: location.href,
        referrer: document.referrer || null,
        events: queue.splice(0, 50),
      },
      DIRECT ? { visitor_id: directId } : {},
      extra || {}
    )
    var body = JSON.stringify(payload)

    // keepalive so the beacon survives the unload that a CTA click causes —
    // without it, the single most important click on the page is the one most
    // likely to be dropped.
    //
    // text/plain rather than application/json: in direct mode the request is
    // cross-origin, and a JSON content type would force a CORS preflight on
    // every beacon — which keepalive requests cannot do during unload. The
    // collector parses the body as JSON regardless of the header.
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: body,
        credentials: DIRECT ? 'omit' : 'same-origin',
        mode: DIRECT ? 'cors' : 'same-origin',
        keepalive: true,
      })
    } catch (e) {
      /* never let tracking break the page */
    }
  }

  function enqueue(ev, immediate) {
    queue.push(ev)
    if (immediate) return send()
    clearTimeout(flushTimer)
    flushTimer = setTimeout(send, 1000)
  }

  /** Stable-ish identifier: data-attr first, then a short DOM path. */
  function keyFor(el) {
    var explicit = el.closest('[data-attr]')
    if (explicit) return explicit.getAttribute('data-attr')

    var parts = []
    var node = el
    for (var i = 0; node && i < 3; i++) {
      var seg = node.tagName.toLowerCase()
      if (node.id) {
        parts.unshift(seg + '#' + node.id)
        break
      }
      parts.unshift(seg)
      node = node.parentElement
    }
    return parts.join('>')
  }

  // ---- pageview ----
  function pageview() {
    enqueue({ kind: 'pageview', path: location.pathname }, true)
  }

  // ---- clicks (autocapture) ----
  document.addEventListener(
    'click',
    function (e) {
      var el = e.target instanceof Element ? e.target.closest('a,button,[role="button"],[data-attr]') : null
      if (!el) return
      enqueue(
        {
          kind: 'click',
          path: location.pathname,
          element_key: keyFor(el),
          element_text: (el.textContent || '').trim().slice(0, 120),
          metadata: { href: el.getAttribute('href') || null },
        },
        true // a click often navigates away; do not sit in the queue
      )
    },
    true
  )

  // ---- impressions ----
  // One row per element per pageview, not per scroll-past, or the CTR
  // denominator inflates every time someone scrolls up and back down.
  //
  // "Per element" means per (path, key, text), NOT per DOM node. A React or
  // App Router page re-renders its lists constantly and every re-render is a
  // fresh node; keyed on the node alone, a deals grid that re-rendered on each
  // poll produced 22,000 impressions of one "See details" button from a single
  // visitor (2026-09-12), which is what pushed the database past its quota.
  // The key set resets on navigation so each pageview still counts once, and
  // a page can never contribute more than MAX_IMPRESSIONS_PER_PAGE rows.
  var seen = new WeakSet()
  var seenKeys = {}
  var seenPath = location.pathname
  var seenCount = 0
  var MAX_IMPRESSIONS_PER_PAGE = 40
  function resetImpressions() {
    seenKeys = {}
    seenPath = location.pathname
    seenCount = 0
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        if (location.pathname !== seenPath) resetImpressions()
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || seen.has(entry.target)) return
          seen.add(entry.target)
          io.unobserve(entry.target)
          var key = keyFor(entry.target)
          var text = (entry.target.textContent || '').trim().slice(0, 120)
          var k = key + '\u0001' + text
          if (seenKeys[k] || seenCount >= MAX_IMPRESSIONS_PER_PAGE) return
          seenKeys[k] = true
          seenCount++
          enqueue({
            kind: 'impression',
            path: location.pathname,
            element_key: key,
            element_text: text,
          })
        })
      },
      { threshold: 0.5 } // half visible counts as seen
    )

    var observeAll = function () {
      document.querySelectorAll('a,button,[role="button"],[data-attr]').forEach(function (el) {
        if (!seen.has(el)) io.observe(el)
      })
    }
    observeAll()
    // App Router swaps the tree without a reload; pick up new nodes. Coalesce
    // the bursts: a list that re-renders on every poll would otherwise re-walk
    // the whole DOM on every mutation.
    var observeTimer = null
    new MutationObserver(function () {
      clearTimeout(observeTimer)
      observeTimer = setTimeout(observeAll, 300)
    }).observe(document.body, { childList: true, subtree: true })
  }

  // ---- identify ----
  // WHO this cookie is. Safe to call on every sign-in: it retroactively attaches
  // every touchpoint already recorded for this cookie to the person, and a
  // person's second device only becomes theirs once it identifies too. It is
  // deliberately NOT a conversion — a login is not a signup, and a site that
  // used identify() as its only signal counted every returning user and every
  // job applicant as a new customer. The conversion is sapienceSignup below.
  window.sapienceIdentify = function (email, userId) {
    send({ identify: { email: email || undefined, user_id: userId || undefined } })
  }

  // ---- track ----
  // A named conversion the autocapture cannot infer: booked a call, requested
  // an audit, subscribed. identify() alone cannot answer "which of these people
  // BOOKED" — every form on the site produces the same identity row, so without
  // a name the booked-a-call cohort is indistinguishable from the newsletter.
  // Sent immediately for the same reason clicks are: the conversion moment is
  // often the last thing that happens before the tab goes away.
  window.sapienceTrack = function (name, metadata) {
    if (!name) return
    enqueue(
      {
        kind: 'custom',
        name: String(name),
        path: location.pathname,
        metadata: metadata || {},
      },
      true
    )
  }

  // ---- signup ----
  // The one line a site adds at account creation. Identify + the `signup`
  // conversion in a single beacon, so the person and the moment can never
  // arrive separately (or one of them not at all). Accepts an object or the
  // positional (email, userId) form for symmetry with identify().
  //
  //   sapienceSignup({ email: user.email, userId: user.id })
  //
  // Pass userId even when the email is there: a site that stores hashed
  // identifiers only still gets a stable, joinable key per account.
  window.sapienceSignup = function (arg, userId, metadata) {
    var o = arg && typeof arg === 'object' ? arg : { email: arg, userId: userId, metadata: metadata }
    queue.push({
      kind: 'custom',
      name: 'signup',
      path: location.pathname,
      metadata: o.metadata || {},
    })
    send({ identify: { email: o.email || undefined, user_id: o.userId || o.user_id || undefined } })
  }

  // ---- zero-code signup forms ----
  // <form data-sapience-signup> — on submit, the first email field in the form
  // is the person. Gated on the attribute on purpose: a rule of "any form with
  // an email input" would count every newsletter box and login form as a
  // signup, which is the exact confusion signup exists to end. Only forms that
  // actually submit as forms qualify; an OTP/OAuth flow calls sapienceSignup.
  document.addEventListener(
    'submit',
    function (e) {
      var form = e.target
      if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-sapience-signup')) return
      var input = form.querySelector('input[type="email"], input[name*="email" i]')
      var email = input && 'value' in input ? String(input.value).trim() : ''
      if (!email) return
      window.sapienceSignup({ email: email, metadata: { form: form.getAttribute('data-sapience-signup') || form.id || null } })
    },
    true
  )

  // ---- survey: "how did you hear about us?" ----
  // Self-reported attribution. The cookie cannot see a native ChatGPT app, a
  // link pasted into a group chat, or a friend's recommendation — all of them
  // land as Direct. Asking once, at the right moment, is how that gap closes.
  // The answer is written against this cookie and becomes the person's
  // "claimed" source beside the cookie's "observed" one.
  //
  //   sapienceSurvey.mount(el, { onComplete })   inline, e.g. an onboarding step
  //   sapienceSurvey.open({ onComplete })        modal, e.g. before a CTA continues
  //   sapienceSurvey.intercept(selector)         modal on click of matching links,
  //                                              then continue to the link
  //   <script src=".../a.js?s=KEY" data-survey-intercept='a[href*="calendly"]'>
  //   <div data-sapience-survey></div>           mounts itself
  //
  // Cards come from the site's config (edited on the Script page) and are
  // baked into this file when it is served, so a label change needs no deploy.
  var SURVEY = {"question":"How did you hear about us?","subtitle":"One tap. It helps us know what to do more of.","cards":[{"key":"ai","label":"ChatGPT","domain":"chatgpt.com"},{"key":"google","label":"Google","domain":"google.com"},{"key":"youtube","label":"YouTube","domain":"youtube.com"},{"key":"instagram","label":"Instagram","domain":"instagram.com"},{"key":"tiktok","label":"TikTok","domain":"tiktok.com"},{"key":"x","label":"X","domain":"x.com"},{"key":"reddit","label":"Reddit","domain":"reddit.com"},{"key":"friend_other","label":"A friend or somewhere else","icon":"people","ask":true,"placeholder":"Who, or where?"}],"skipLabel":"Skip","footer":""}
  var SURVEY_KEY = '_gv_survey'
  // Inline glyphs for cards that are not a brand. currentColor so they theme.
  var GLYPH = {
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4M8 21h8"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    generic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
  }
  function surveyAnswered() {
    try { return !!localStorage.getItem(SURVEY_KEY) } catch (e) { return false }
  }
  function surveyMark(key) {
    try { localStorage.setItem(SURVEY_KEY, key) } catch (e) { /* private mode */ }
  }
  function surveyStyles() {
    if (document.getElementById('sapience-survey-css')) return
    var st = document.createElement('style')
    st.id = 'sapience-survey-css'
    st.textContent =
      '.sp-sv{--sp-bg:var(--sapience-bg,#fff);--sp-fg:var(--sapience-fg,#0a0a0a);--sp-muted:var(--sapience-muted,#6b6b6b);--sp-line:var(--sapience-line,#e6e6e6);--sp-tile:var(--sapience-tile,#f4f4f2);--sp-accent:var(--sapience-accent,#0a0a0a);--sp-radius:var(--sapience-radius,14px);font-family:var(--sapience-font,inherit);color:var(--sp-fg);box-sizing:border-box}' +
      '.sp-sv *{box-sizing:border-box}' +
      '.sp-sv-overlay{position:fixed;inset:0;background:rgba(10,10,10,.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:2147483000;padding:16px;animation:sp-fade .18s ease-out}' +
      '@keyframes sp-fade{from{opacity:0}to{opacity:1}}@keyframes sp-rise{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}' +
      '.sp-sv-panel{background:var(--sp-bg);border:1px solid var(--sp-line);border-radius:calc(var(--sp-radius) + 6px);padding:28px 28px 20px;width:100%;max-width:600px;box-shadow:0 30px 80px -30px rgba(0,0,0,.45),0 2px 8px rgba(0,0,0,.06);animation:sp-rise .22s cubic-bezier(.2,.8,.2,1)}' +
      '.sp-sv-q{font-size:21px;font-weight:600;letter-spacing:-.02em;margin:0 0 4px;line-height:1.2}' +
      '.sp-sv-sub{font-size:13.5px;color:var(--sp-muted);margin:0 0 18px}' +
      '.sp-sv-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}' +
      '@media(min-width:560px){.sp-sv-grid{grid-template-columns:repeat(4,1fr)}}' +
      '.sp-sv-card{appearance:none;border:1px solid var(--sp-line);background:var(--sp-bg);color:var(--sp-fg);border-radius:var(--sp-radius);padding:16px 10px 14px;font:inherit;font-size:13px;font-weight:500;line-height:1.25;letter-spacing:-.005em;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:10px;min-height:104px;transition:border-color .15s,transform .15s,box-shadow .15s,background .15s}' +
      '.sp-sv-card:hover,.sp-sv-card:focus-visible{border-color:var(--sp-accent);outline:none;transform:translateY(-2px);box-shadow:0 10px 24px -14px rgba(0,0,0,.35)}' +
      '.sp-sv-card.sp-on{border-color:var(--sp-accent);box-shadow:inset 0 0 0 1px var(--sp-accent)}' +
      '.sp-sv-tile{width:44px;height:44px;border-radius:12px;background:var(--sp-tile);display:flex;align-items:center;justify-content:center;overflow:hidden}' +
      '.sp-sv-tile img{width:26px;height:26px;display:block;object-fit:contain}' +
      '.sp-sv-tile svg{width:22px;height:22px;display:block}' +
      '.sp-sv-other{margin-top:12px;display:flex;gap:8px}' +
      '.sp-sv-other input{flex:1;border:1px solid var(--sp-line);border-radius:calc(var(--sp-radius) - 2px);padding:11px 13px;font:inherit;font-size:14px;color:var(--sp-fg);background:var(--sp-bg)}' +
      '.sp-sv-other input:focus{outline:2px solid var(--sp-accent);outline-offset:-1px}' +
      '.sp-sv-btn{appearance:none;border:0;background:var(--sp-accent);color:var(--sp-bg);border-radius:calc(var(--sp-radius) - 2px);padding:10px 18px;font:inherit;font-size:14px;font-weight:600;cursor:pointer}' +
      '.sp-sv-foot{display:flex;justify-content:space-between;align-items:center;margin-top:16px;font-size:12px;color:var(--sp-muted)}' +
      '.sp-sv-skip{appearance:none;border:0;background:none;color:var(--sp-muted);font:inherit;font-size:12.5px;cursor:pointer;padding:6px 8px;border-radius:8px}' +
      '.sp-sv-skip:hover{color:var(--sp-fg);background:var(--sp-tile)}' +
      '@media(prefers-color-scheme:dark){.sp-sv{--sp-bg:var(--sapience-bg,#141414);--sp-fg:var(--sapience-fg,#f5f5f5);--sp-muted:var(--sapience-muted,#9a9a9a);--sp-line:var(--sapience-line,#2a2a2a);--sp-tile:var(--sapience-tile,#1f1f1f);--sp-accent:var(--sapience-accent,#f5f5f5)}}'
    document.head.appendChild(st)
  }
  function surveySend(key, label, detail) {
    surveyMark(key)
    send({ survey: { answer_key: key, answer_label: label, detail: detail || null, path: location.pathname } })
  }
  // Builds the panel. `done(answered)` fires once, on answer or skip.
  function surveyPanel(opts, done) {
    surveyStyles()
    var cfg = Object.assign({}, SURVEY, opts && opts.config ? opts.config : {})
    var wrap = document.createElement('div')
    wrap.className = 'sp-sv'
    var panel = document.createElement('div')
    panel.className = 'sp-sv-panel'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', cfg.question)
    var q = document.createElement('p'); q.className = 'sp-sv-q'; q.textContent = cfg.question
    var sub = document.createElement('p'); sub.className = 'sp-sv-sub'; sub.textContent = cfg.subtitle || 'One tap. It helps us know what to do more of.'
    var grid = document.createElement('div'); grid.className = 'sp-sv-grid'
    var other = null, otherInput = null, finished = false
    function finish(answered) { if (finished) return; finished = true; done(answered) }
    function pick(card, btn) {
      Array.prototype.forEach.call(grid.children, function (c) { c.classList.remove('sp-on') })
      btn.classList.add('sp-on')
      if (card.key === 'other' || card.ask) {
        if (!other) {
          other = document.createElement('div'); other.className = 'sp-sv-other'
          otherInput = document.createElement('input'); otherInput.type = 'text'; otherInput.maxLength = 120
          otherInput.placeholder = card.placeholder || 'Where exactly?'
          var go = document.createElement('button'); go.className = 'sp-sv-btn'; go.type = 'button'; go.textContent = 'Continue'
          go.onclick = function () { surveySend(card.key, card.label, otherInput.value.trim()); finish(true) }
          otherInput.onkeydown = function (e) { if (e.key === 'Enter') go.onclick() }
          other.appendChild(otherInput); other.appendChild(go)
          grid.parentNode.insertBefore(other, grid.nextSibling)
        }
        otherInput.focus()
        return
      }
      if (other) { other.remove(); other = null }
      surveySend(card.key, card.label, null)
      finish(true)
    }
    ;(cfg.cards || []).forEach(function (card) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sp-sv-card'
      b.setAttribute('data-key', card.key)
      // The mark: a real favicon for a brand (via Google's favicon service, so
      // nothing is hosted or kept current by hand), an inline glyph otherwise.
      var tile = document.createElement('span'); tile.className = 'sp-sv-tile'
      if (card.icon && /^https?:/.test(card.icon)) {
        var im0 = document.createElement('img'); im0.alt = ''; im0.src = card.icon; im0.onerror = function () { tile.innerHTML = GLYPH.generic }
        tile.appendChild(im0)
      } else if (card.domain) {
        var im = document.createElement('img'); im.alt = ''; im.loading = 'eager'; im.referrerPolicy = 'no-referrer'
        im.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(card.domain) + '&sz=64'
        im.onerror = function () { tile.innerHTML = GLYPH.generic }
        tile.appendChild(im)
      } else {
        tile.innerHTML = GLYPH[card.icon] || GLYPH.generic
      }
      b.appendChild(tile)
      var lb = document.createElement('span'); lb.textContent = card.label; b.appendChild(lb)
      b.onclick = function () { pick(card, b) }
      grid.appendChild(b)
    })
    var foot = document.createElement('div'); foot.className = 'sp-sv-foot'
    var brand = document.createElement('span'); brand.textContent = cfg.footer || ''
    var skip = document.createElement('button'); skip.type = 'button'; skip.className = 'sp-sv-skip'; skip.textContent = cfg.skipLabel || 'Skip'
    skip.onclick = function () { surveyMark('skipped'); finish(false) }
    foot.appendChild(brand); foot.appendChild(skip)
    panel.appendChild(q); panel.appendChild(sub); panel.appendChild(grid); panel.appendChild(foot)
    wrap.appendChild(panel)
    return wrap
  }
  window.sapienceSurvey = {
    answered: surveyAnswered,
    mount: function (target, opts) {
      opts = opts || {}
      var el = typeof target === 'string' ? document.querySelector(target) : target
      if (!el) return
      if (surveyAnswered() && !opts.force) { if (opts.onComplete) opts.onComplete({ answered: false, skipped: true }); return }
      var node = surveyPanel(opts, function (answered) {
        if (opts.keep !== true) node.remove()
        if (opts.onComplete) opts.onComplete({ answered: answered })
      })
      el.innerHTML = ''
      el.appendChild(node)
    },
    open: function (opts) {
      opts = opts || {}
      if (surveyAnswered() && !opts.force) { if (opts.onComplete) opts.onComplete({ answered: false, skipped: true }); return }
      var overlay = document.createElement('div')
      overlay.className = 'sp-sv sp-sv-overlay'
      var node = surveyPanel(opts, function (answered) {
        overlay.remove()
        document.removeEventListener('keydown', esc)
        if (opts.onComplete) opts.onComplete({ answered: answered })
      })
      // The panel carries the .sp-sv styles; the overlay only positions it.
      overlay.appendChild(node.firstChild)
      var esc = function (e) { if (e.key === 'Escape') { surveyMark('skipped'); overlay.remove(); document.removeEventListener('keydown', esc); if (opts.onComplete) opts.onComplete({ answered: false }) } }
      document.addEventListener('keydown', esc)
      overlay.addEventListener('click', function (e) { if (e.target === overlay) esc({ key: 'Escape' }) })
      document.body.appendChild(overlay)
      var first = overlay.querySelector('.sp-sv-card'); if (first) first.focus()
    },
    // Ask before a CTA continues. Once answered (or skipped) the links behave
    // normally forever; the question is asked exactly once per browser.
    intercept: function (selector, opts) {
      opts = opts || {}
      document.addEventListener('click', function (e) {
        if (surveyAnswered()) return
        var a = e.target instanceof Element ? e.target.closest(selector) : null
        if (!a) return
        var href = a.getAttribute('href')
        if (!href) return
        e.preventDefault()
        e.stopPropagation()
        var target = a.getAttribute('target')
        window.sapienceSurvey.open({
          config: opts.config,
          onComplete: function () {
            if (target === '_blank') window.open(href, '_blank', 'noopener') || (location.href = href)
            else location.href = href
          },
        })
      }, true)
    },
  }
  // Declarative hooks: an attribute on the script tag, or a container div.
  var scriptEl = document.currentScript
  var interceptSel = scriptEl && scriptEl.getAttribute('data-survey-intercept')
  if (interceptSel) window.sapienceSurvey.intercept(interceptSel)
  var autoMount = function () {
    document.querySelectorAll('[data-sapience-survey]').forEach(function (el) {
      if (el.getAttribute('data-sapience-survey-mounted')) return
      el.setAttribute('data-sapience-survey-mounted', '1')
      window.sapienceSurvey.mount(el, {})
    })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount)
  else autoMount()

  // ---- route changes ----
  var lastPath = location.pathname
  var check = function () {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname
      resetImpressions() // a new pageview gets its own impression budget
      pageview()
    }
  }
  var push = history.pushState
  history.pushState = function () {
    push.apply(this, arguments)
    check()
  }
  window.addEventListener('popstate', check)

  // Flush anything still queued when the tab goes away.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && queue.length) send()
  })

  pageview()
})()
