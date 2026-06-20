"use client";

import { useEffect } from "react";

export function DyReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".dy-r");
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("dy-on");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.06 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
