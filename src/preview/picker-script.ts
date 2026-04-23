export const PICKER_SCRIPT = `
<style>
  .__h { outline: 2px solid #7F77DD !important; background: rgba(127,119,221,0.08) !important; }
  .__f { outline: 2px dashed #1D9E75 !important; background: rgba(29,158,117,0.10) !important; }
  .__p { outline: 2px solid #F59E0B !important; background: rgba(245,158,11,0.12) !important; }
  * { cursor: crosshair !important; user-select: none !important; }
</style>
<script>
(function () {
  var SKIP = ['HTML','BODY','HEAD','SCRIPT','STYLE','NOSCRIPT'];
  var hoverEl = null;
  var fieldSelectors = [];
  var pickingPagination = false;

  function skip(el) { return !el || SKIP.indexOf(el.tagName) >= 0; }
  function cleanCls(c) { return !/^(css-|sc-|_|js-)/.test(c) && c.length < 40 && c.indexOf('__') < 0; }

  function seg(el) {
    var tag = el.tagName.toLowerCase();
    var cls = Array.from(el.classList || []).filter(cleanCls).slice(0, 1);
    return cls.length ? tag + '.' + cls[0] : tag;
  }

  function fullSel(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && /^[a-zA-Z]/.test(el.id)) return '#' + CSS.escape(el.id);
    var parts = [], cur = el;
    while (cur && cur !== document.body && cur.nodeType === 1) {
      var s = seg(cur), p = cur.parentElement;
      if (p) {
        var sb = Array.from(p.children).filter(function (x) { return x.tagName === cur.tagName; });
        if (sb.length > 1) s += ':nth-of-type(' + (sb.indexOf(cur) + 1) + ')';
      }
      parts.unshift(s);
      cur = cur.parentElement;
      if (cur && cur.id && /^[a-zA-Z]/.test(cur.id)) { parts.unshift('#' + CSS.escape(cur.id)); break; }
    }
    return parts.join(' > ');
  }

  function qs(sel) {
    try { return Array.from(document.querySelectorAll(sel)); } catch (_) { return []; }
  }

  function findListSel(el) {
    var tag = el.tagName.toLowerCase();
    var cls = Array.from(el.classList || []).filter(cleanCls).slice(0, 1);
    var cands = cls.length ? [tag + '.' + cls[0], '.' + cls[0]] : [];
    if (el.parentElement) cands.push(fullSel(el.parentElement) + ' > ' + tag);
    var cur = el.parentElement, depth = 0;
    while (cur && cur !== document.body && depth < 8) {
      var s = seg(cur);
      var m = qs(s);
      if (m.length >= 2 && m.length <= 100) cands.push(s);
      cur = cur.parentElement; depth++;
    }
    for (var i = 0; i < cands.length; i++) {
      var hits = qs(cands[i]);
      if (hits.length >= 2) return { sel: cands[i], count: hits.length };
    }
    return null;
  }

  function paint() {
    qs('.__f').forEach(function (n) { n.classList.remove('__f'); });
    fieldSelectors.forEach(function (sel) {
      qs(sel).forEach(function (n) { n.classList.add('__f'); n.classList.remove('__h'); });
    });
  }

  function clearHover() {
    if (hoverEl && !hoverEl.classList.contains('__f') && !hoverEl.classList.contains('__p'))
      hoverEl.classList.remove('__h');
    hoverEl = null;
  }

  function isValidId(id) { return id && /^[a-zA-Z]/.test(id); }

  function shortPaginationSelector(el) {
    if (!el || el.nodeType !== 1) return '';

    // 1. rel="next" — most reliable, stays stable across pages
    if (el.getAttribute('rel') === 'next') return 'a[rel="next"]';

    // 2. aria-label containing "next"
    var aria = el.getAttribute('aria-label') || '';
    if (/next/i.test(aria))
      return el.tagName.toLowerCase() + '[aria-label="' + aria.replace(/"/g, '\\"') + '"]';

    // 3. Visible text is a recognized "next" glyph (›, », >, Next)
    var text = (el.innerText || '').trim();
    if (text && /^(›|»|next|>)$/i.test(text)) {
      // Try to anchor with a stable ancestor id
      var cur = el.parentElement;
      for (var d = 0; d < 5 && cur && cur !== document.body; d++) {
        if (isValidId(cur.id)) {
          var cls = Array.from(el.classList || []).filter(cleanCls)[0];
          return '#' + CSS.escape(cur.id) + ' ' +
                 el.tagName.toLowerCase() +
                 (cls ? '.' + cls : '') +
                 '[href]';
        }
        cur = cur.parentElement;
      }
      // No stable ancestor id — use stable class + href
      var cls = Array.from(el.classList || []).filter(cleanCls)[0];
      if (cls) return el.tagName.toLowerCase() + '.' + cls + '[href]';
    }

    // 4. data-* attributes — stable even when DOM order shifts
    var dataAttrs = Array.from(el.attributes || []).filter(function (a) {
      return a.name.indexOf('data-') === 0;
    });
    if (dataAttrs.length)
      return el.tagName.toLowerCase() +
             '[' + dataAttrs[0].name + '="' + dataAttrs[0].value.replace(/"/g, '\\"') + '"]';

    // 5. Element has a stable id
    if (isValidId(el.id)) return '#' + CSS.escape(el.id);

    // 6. Stable class without nth-of-type
    var cls = Array.from(el.classList || []).filter(cleanCls)[0];
    if (cls) return el.tagName.toLowerCase() + '.' + cls;

    // 7. Last resort: full positional selector (fragile, but better than nothing)
    return fullSel(el);
  }

  document.addEventListener('mousemove', function (e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || skip(el) || el === hoverEl) return;
    clearHover();
    hoverEl = el;
    if (!el.classList.contains('__f') && !el.classList.contains('__p'))
      el.classList.add('__h');
    window.parent.postMessage({
      type: 'EP_HOVER',
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || '').slice(0, 80).trim()
    }, '*');
  }, { passive: true });

  document.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || skip(el)) return;
    var exact = fullSel(el);

    if (pickingPagination) {
      qs('.__p').forEach(function (n) { n.classList.remove('__p'); });
      el.classList.add('__p');
      var shortSel = shortPaginationSelector(el);
      window.parent.postMessage({
        type: 'EP_PAGINATION_PICKED',
        sel: shortSel || exact,
        text: (el.innerText || '').slice(0, 40).trim()
      }, '*');
      return;
    }

    var list = findListSel(el);
    window.parent.postMessage({
      type: 'EP_CLICK',
      exact: exact,
      listSel: list ? list.sel : null,
      listCount: list ? list.count : 0,
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || '').slice(0, 80).trim()
    }, '*');
  }, true);

  document.addEventListener('submit', function (e) {
    e.preventDefault(); e.stopPropagation();
  }, true);

  window.addEventListener('message', function (e) {
    if (!e.data) return;

    if (e.data.type === 'EP_ADD_FIELD') {
      if (e.data.sel && fieldSelectors.indexOf(e.data.sel) < 0)
        fieldSelectors.push(e.data.sel);
      paint();
    }

    if (e.data.type === 'EP_REMOVE_FIELD') {
      fieldSelectors = fieldSelectors.filter(function (s) { return s !== e.data.sel; });
      paint();
    }

    if (e.data.type === 'EP_SET_PAGINATION_MODE') {
      pickingPagination = e.data.active === true;
    }

    if (e.data.type === 'EP_CLEAR_PAGINATION') {
      qs('.__p').forEach(function (n) { n.classList.remove('__p'); });
    }

    if (e.data.type === 'EP_RESET') {
      fieldSelectors = [];
      pickingPagination = false;
      qs('.__f, .__h, .__p').forEach(function (n) {
        n.classList.remove('__f', '__h', '__p');
      });
      hoverEl = null;
    }
  });
})();
</script>`;