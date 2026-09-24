var S="__framer_force_showing_editorbar_since",C="__framer_editor_button_position",a="2147483647";var R=300;var g="--framer-fresco-";function m(t,e){return`${g}${t}-${e}`}function y(t,e,n,o){return`var(${m(t,e)}, ${n}${o||""})`}function i(t,e,n){let o={};for(let r in t){let l=t[r];l!==void 0&&(o[r]=y(r,e,l,n))}return o}var u='"Inter Variable UI", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',b={monospace:'"Input Mono", Menlo, monospace',sansSerif:`${u}, emoji, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,sansSerifWithoutEmoji:u},E={micro:"9px",caption:"10px",base:"12px",baseLarge:"13px",heading:"16px",display:"20px"},T={base:450,heading:550};var s={family:i(b,"font-family"),size:i(E,"font-size"),weight:i(T,"font-weight")};var h="__framer-editorbar-container",c="__framer-editorbar-label",x="__framer-editorbar-button",k="__framer-editorbar-button-tooltip-visible",O=`
#${h} {
    align-items: center;
    display: flex;
    gap: 8px;
    position: fixed;
    z-index: calc(${a});
    width: max-content;
    cursor: pointer;
}

#${c} {
    background-color: #111;
    border-radius: 8px;
    font-family: ${s.family.sansSerif};
    font-size: ${s.size.base};
    height: fit-content;
    opacity: 0;
    padding: 4px 8px;
    transition: opacity 0.4s ease-out;
    font-weight: ${s.weight.base};
    flex-shrink: 0;
    position: fixed;
    width: max-content;
    pointer-events: none;
    user-select: none;
}

#${x} {
    all: unset;
    align-items: center;
    border-radius: 15px;
    display: flex;
    height: 30px;
    justify-content: center;
    width: 30px;
    flex-shrink: 0;
}

#${c}.${k} {
    opacity: 1;
}

#${c}, #${x} {
    backdrop-filter: blur(10px);
    background-color: rgba(34, 34, 34, 0.8);
    box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 4px 0px, rgba(0, 0, 0, 0.05) 0px 1px 0px 0px, rgba(255, 255, 255, 0.15) 0px 0px 0px 1px;
    color: #fff;
}
`,d=document.createElement("style");d.innerHTML=O;document.head.appendChild(d);function _(t){let e=window.__framer_editorBarDependencies;if(!e)throw new Error("Dependencies not found");if(e.__version<1||e.__version>3)throw new Error("Unsupported version");let n=e[t];if(!n)throw new Error("Dependency not found");return n}var{createElement:p,memo:M,useCallback:z,useEffect:j,useRef:F,useState:K,useLayoutEffect:H}=_("react");function G(t,e,n){let{children:o,...r}=e??{};return n!==void 0&&(r.key=n),p(t,r,o)}function P(t,e,n){let{children:o,...r}=e??{};return n!==void 0&&(r.key=n),p(t,r,...o)}var f=class extends Error{};function Z(t,e){if(t)return;if(typeof e=="function")try{e=e()}catch{e="(assert message threw)"}typeof e=="string"&&e.length>2048&&(e=e.slice(0,2048)+"\u2026");let n=new f(e?"Assertion Error: "+e:"Assertion Error");if(n.stack)try{let o=n.stack.split(`
`);o[1]?.includes("assert")?(o.splice(1,1),n.stack=o.join(`
`)):o[0]?.includes("assert")&&(o.splice(0,1),n.stack=o.join(`
`))}catch{}throw n}function q(t,e){throw e instanceof Error?e:e!==void 0?new Error(String(e)):new Error(t?`Unexpected value: ${t}`:"Application entered invalid state")}export{S as a,C as b,a as c,R as d,h as e,c as f,x as g,k as h,_ as i,M as j,z as k,j as l,F as m,K as n,Z as o,q as p,G as q,P as r};
//# sourceMappingURL=/__external/app.framerstatic.com/chunk-BAHUFDKX.mjs.map
