/* The footer's dot field (treg.to closing chapter, hero-particles.js "closing" mode):
   one WebGL point draw over a grid of tiny glyphs (dot, ring, two squares), brighter
   toward the bottom, drifting on slow currents. The cursor pushes the dots aside and
   leaves a soft light trail. Loaded by main.js only when the page has a <footer>.
   Paused off screen and in a hidden tab; reduced motion never loads it (the CSS dot
   texture stays). No dependencies. */
(function () {
  "use strict";
  var host = document.querySelector("footer");
  if (!host || host.querySelector(".foot-field")) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduced.matches) return;
  var coarse = window.matchMedia("(pointer: coarse)");

  var canvas = document.createElement("canvas");
  canvas.className = "foot-field";
  canvas.setAttribute("aria-hidden", "true");
  // Styled inline too: the React pages' footer does not load styles.css.
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;contain:strict";
  var gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: "low-power" });
  if (!gl) return;

  var vertex = [
    "precision highp float;",
    "attribute vec3 aPoint;",
    "uniform vec2 uSize;",
    "uniform float uTime,uDpr,uCell;",
    "uniform vec3 uPointer;",
    "uniform vec3 uTrail[12];",
    "varying float vAlpha,vKind,vHeat;",
    "float segment(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;float t=clamp(dot(p-a,ab)/max(dot(ab,ab),.001),0.,1.);return length(p-a-t*ab);}",
    "void main(){",
    "  vec2 p=aPoint.xy;",
    "  p.x+=sin(aPoint.y*.012-uTime*.55)*2.5;",
    "  p.y+=sin(aPoint.x*.009+aPoint.y*.004-uTime*.42)*3.;",
    "  vec2 away=p-uPointer.xy;float d=length(away);",
    "  float proximity=exp(-pow(d/155.,2.))*uPointer.z;",
    "  p+=away/max(d,1.)*proximity*16.;",
    "  float heat=0.;",
    "  for(int i=0;i<11;i++){",
    "    float life=min(uTrail[i].z,uTrail[i+1].z);",
    "    float s=segment(p,uTrail[i].xy,uTrail[i+1].xy);",
    "    heat=max(heat,exp(-pow(s/70.,2.))*smoothstep(0.,.85,life));",
    "  }",
    "  float depth=clamp(aPoint.y/uSize.y,0.,1.);",
    "  float current=.5+.5*sin(aPoint.x*.008+aPoint.y*.011-uTime*.7+sin(aPoint.x*.003+uTime*.2));",
    "  float bottomQuiet=1.-.38*smoothstep(.5,1.,depth);",
    "  vKind=mod(floor(aPoint.z*31.),3.);",
    "  vAlpha=(.008+.16*pow(depth,1.8))*bottomQuiet*(.58+.42*current)*smoothstep(0.,.2,depth)*step(.10,aPoint.z);",
    "  vHeat=max(proximity*.38,heat*.26)*step(.10,aPoint.z);",
    "  gl_Position=vec4(p.x/uSize.x*2.-1.,1.-p.y/uSize.y*2.,0.,1.);",
    "  gl_PointSize=(min(uCell*.82,5.0)+proximity*.8)*uDpr;",
    "}"
  ].join("\n");
  var fragment = [
    "precision mediump float;",
    "varying float vAlpha,vKind,vHeat;",
    "float box(vec2 p,vec2 c,float r){return 1.-smoothstep(r-.045,r+.045,max(abs(p.x-c.x),abs(p.y-c.y)));}",
    "void main(){",
    "  vec2 p=gl_PointCoord-.5;float d=length(p);float glyph;",
    "  if(vKind<.5)glyph=1.-smoothstep(.17,.23,d);",
    "  else if(vKind<1.5)glyph=(1.-smoothstep(.35,.42,d))*smoothstep(.12,.19,d);",
    "  else glyph=max(box(p,vec2(-.12,-.12),.20),box(p,vec2(.12,.12),.20));",
    "  float a=glyph*mix(vAlpha,.64,vHeat);",
    "  vec3 col=mix(vec3(.88,.92,.96),vec3(1.),vHeat);",
    "  gl_FragColor=vec4(col*a,a);",
    "}"
  ].join("\n");

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    console.warn("[landing] footer field unavailable, keeping the dot texture", err);
    return;
  }
  gl.useProgram(program);
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  var attr = gl.getAttribLocation(program, "aPoint");
  gl.enableVertexAttribArray(attr);
  gl.vertexAttribPointer(attr, 3, gl.FLOAT, false, 0, 0);
  var u = {};
  ["uSize", "uTime", "uDpr", "uCell", "uPointer", "uTrail[0]"].forEach(function (n) { u[n] = gl.getUniformLocation(program, n); });
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  host.insertBefore(canvas, host.firstChild);
  host.classList.add("has-field");

  var width = 1, height = 1, count = 0, dpr = 1, cell = 6, time = 0, last = 0, visible = false, raf = 0;
  var px = -1000, py = -1000, pointerX = -1000, pointerY = -1000, power = 0, targetPower = 0, trail = [];
  var packed = new Float32Array(36);

  function size() {
    width = host.clientWidth;
    height = host.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    cell = Math.max(coarse.matches ? 8 : 6, Math.sqrt((width * height) / 60000));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    var pts = [], seed = 71;
    for (var y = -cell; y < height + cell; y += cell) {
      for (var x = -cell; x < width + cell; x += cell) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        pts.push(x, y, seed / 4294967296);
      }
    }
    count = pts.length / 3;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
  }

  host.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    var r = host.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    // Start at the entry point, then let the light follow just behind the cursor.
    if (power < 0.01) { px = x; py = y; }
    pointerX = x; pointerY = y; targetPower = 1;
  }, { passive: true });
  host.addEventListener("pointerleave", function () { targetPower = 0; });

  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) { last = 0; return; }
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    time += dt;
    power += (targetPower - power) * (1 - Math.exp(-dt * (targetPower ? 5 : 2.8)));
    var follow = 1 - Math.exp(-dt * 9);
    px += (pointerX - px) * follow;
    py += (pointerY - py) * follow;
    var prev = trail[trail.length - 1];
    if (targetPower && (!prev || now - prev.t >= 80)) {
      trail.push({ x: px, y: py, t: now });
      if (trail.length > 12) trail.shift();
    }
    trail = trail.filter(function (p) { return now - p.t < 1100; });
    packed.fill(0);
    for (var i = 0; i < trail.length; i++) {
      packed[i * 3] = trail[i].x;
      packed[i * 3 + 1] = trail[i].y;
      packed[i * 3 + 2] = 1 - (now - trail[i].t) / 1100;
    }
    gl.uniform2f(u.uSize, width, height);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uDpr, dpr);
    gl.uniform1f(u.uCell, cell);
    gl.uniform3f(u.uPointer, px, py, power);
    gl.uniform3fv(u["uTrail[0]"], packed);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, count);
    raf = requestAnimationFrame(frame);
  }
  function run() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }

  new ResizeObserver(size).observe(host);
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; run(); }, { rootMargin: "200px 0px" }).observe(host);
  document.addEventListener("visibilitychange", run);
  reduced.addEventListener("change", function () { if (reduced.matches) { visible = false; canvas.remove(); host.classList.remove("has-field"); } });
  size();
})();
