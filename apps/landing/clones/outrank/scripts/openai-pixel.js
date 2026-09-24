var PIXEL_ID = document.currentScript && document.currentScript.getAttribute('data-pixel-id');
var DEBUG = document.currentScript && document.currentScript.getAttribute('data-debug') === 'true';

!(function (w, d, s, u) {
  if (w.oaiq) return;
  var q = function () {
    q.q.push(arguments);
  };
  q.q = [];
  w.oaiq = q;
  var j = d.createElement(s);
  j.async = 1;
  j.src = u;
  var f = d.getElementsByTagName(s)[0];
  f.parentNode.insertBefore(j, f);
})(window, document, 'script', 'https://bzrcdn.openai.com/sdk/oaiq.min.js');

if (PIXEL_ID) {
  window.oaiq('init', { pixelId: PIXEL_ID, debug: DEBUG });
}
