"use client";

import { useEffect } from "react";

export function DyNavScroll() {
  useEffect(() => {
    const nav = document.getElementById("dy-nav");
    if (!nav) return;
    function onScroll() {
      if (window.scrollY > 12) {
        nav!.classList.add("scrolled");
      } else {
        nav!.classList.remove("scrolled");
      }
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return null;
}
