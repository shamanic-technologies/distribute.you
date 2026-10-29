var y="__framer_force_showing_editorbar_since",w="__framer_editor_button_position",c="2147483647";var N=300;var b="--framer-fresco-";function h(t,e){return`${b}${t}-${e}`}function E(t,e,n,o){return`var(${h(t,e)}, ${n}${o||""})`}function i(t,e,n){let o={};for(let r in t){let _=t[r];_!==void 0&&(o[r]=E(r,e,_,n))}return o}var u='"Inter Variable UI", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',k={monospace:'"Input Mono", Menlo, monospace',sansSerif:`${u}, emoji, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,sansSerifWithoutEmoji:u},T={micro:"9px",caption:"10px",base:"12px",baseLarge:"13px",heading:"16px",display:"20px"},R={base:450,heading:550},C={base:1.4,compact:1.2};var s={family:i(k,"font-family"),size:i(T,"font-size"),weight:i(R,"font-weight"),lineHeight:i(C,"line-height")};var I="__framer-editorbar-container",p="__framer-editorbar-label",x="__framer-editorbar-button",O="__framer-editorbar-button-tooltip-visible",a="__framer-editorbar-spinner",d="__framer-editorbar-spinner-track",S="__framer-editorbar-spinner-car",A=`
#${I} {
    align-items: center;
    display: flex;
    gap: 8px;
    position: fixed;
    z-index: calc(${c});
    width: max-content;
    cursor: pointer;
}

#${p} {
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

.${a} {
    display: block;
    width: 16px;
    height: 16px;
    transform-origin: 50% 50%;
    will-change: transform;
    animation: ${a}-spin 600ms linear infinite;
}

.${a} svg {
    display: block;
    overflow: visible;
}

.${d}, .${S} {
    fill: none;
    stroke: currentColor;
    stroke-width: 2px;
}

.${d} {
    opacity: 0.25;
}

.${S} {
    stroke-linecap: round;
    stroke-dasharray: 30 70;
}

@keyframes ${a}-spin {
    to {
        transform: rotate(360deg);
    }
}

#${p}.${O} {
    opacity: 1;
}

#${p}, #${x} {
    backdrop-filter: blur(10px);
    background-color: rgba(34, 34, 34, 0.8);
    box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 4px 0px, rgba(0, 0, 0, 0.05) 0px 1px 0px 0px, rgba(255, 255, 255, 0.15) 0px 0px 0px 1px;
    color: #fff;
}
`,g=document.createElement("style");g.innerHTML=A;document.head.appendChild(g);function m(t){let e=window.__framer_editorBarDependencies;if(!e)throw new Error("Dependencies not found");if(e.__version<1||e.__version>3)throw new Error("Unsupported version");let n=e[t];if(!n)throw new Error("Dependency not found");return n}var{createElement:f,memo:K,useCallback:F,useEffect:P,useRef:W,useState:X,useLayoutEffect:G}=m("react");function q(t,e,n){let{children:o,...r}=e??{};return n!==void 0&&(r.key=n),f(t,r,o)}function J(t,e,n){let{children:o,...r}=e??{};return n!==void 0&&(r.key=n),f(t,r,...o)}var l=class extends Error{};function ee(t,e){if(t)return;if(typeof e=="function")try{e=e()}catch{e="(assert message threw)"}typeof e=="string"&&e.length>2048&&(e=e.slice(0,2048)+"\u2026");let n=new l(e?"Assertion Error: "+e:"Assertion Error");if(n.stack)try{let o=n.stack.split(`
`);o[1]?.includes("assert")?(o.splice(1,1),n.stack=o.join(`
`)):o[0]?.includes("assert")&&(o.splice(0,1),n.stack=o.join(`
`))}catch{}throw n}function te(t,e){throw e instanceof Error?e:e!==void 0?new Error(String(e)):new Error(t?`Unexpected value: ${t}`:"Application entered invalid state")}export{y as a,w as b,c,N as d,I as e,p as f,x as g,O as h,a as i,d as j,S as k,m as l,K as m,F as n,P as o,W as p,X as q,ee as r,te as s,q as t,J as u};
//# sourceMappingURL=/__external/app.framerstatic.com/chunk-CS7BPPVU.mjs.map
