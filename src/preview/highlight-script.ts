export const HIGHLIGHT_SCRIPT = (selector: string) => `
<script>
  (function() {
    function highlight() {
      try {
        var els = document.querySelectorAll(${JSON.stringify(selector)});
        if (els.length === 0) {
          window.parent.postMessage({ type: 'PREVIEW_ERROR', message: 'No elements found for selector: ${selector}' }, '*');
          return;
        }
        els.forEach(function(el) {
          el.style.outline = '3px solid #f59e0b';
          el.style.outlineOffset = '2px';
          el.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
          el.style.borderRadius = '2px';
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
        });
        window.parent.postMessage({ type: 'PREVIEW_READY', count: els.length }, '*');
      } catch(e) {
        window.parent.postMessage({ type: 'PREVIEW_ERROR', message: e.message }, '*');
      }
    }
    var attempts = 0;
    var maxAttempts = 10;
    function tryHighlight() {
      var els = document.querySelectorAll(${JSON.stringify(selector)});
      if (els.length > 0 || attempts >= maxAttempts) {
        highlight();
      } else {
        attempts++;
        setTimeout(tryHighlight, 300);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(tryHighlight, 100);
      });
    } else {
      setTimeout(tryHighlight, 100);
    }
  })();
</script>`;