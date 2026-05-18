"use client";

import { useEffect } from "react";
import { translateRuntimeValue } from "@/lib/language";

function translateNode(language: string, node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (
      node.parentElement &&
      ["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.parentElement.tagName)
    ) {
      return;
    }

    const textContent = node.textContent ?? "";
    const translated = translateRuntimeValue(language, textContent);

    if (translated !== textContent) {
      node.textContent = translated;
    }

    return;
  }

  if (!(node instanceof HTMLElement)) {
    return;
  }

  for (const attributeName of ["placeholder", "aria-label", "title"]) {
    const value = node.getAttribute(attributeName);

    if (!value) {
      continue;
    }

    const translated = translateRuntimeValue(language, value);

    if (translated !== value) {
      node.setAttribute(attributeName, translated);
    }
  }

  if (
    node instanceof HTMLInputElement &&
    (node.type === "button" || node.type === "submit" || node.type === "reset")
  ) {
    const translated = translateRuntimeValue(language, node.value);

    if (translated !== node.value) {
      node.value = translated;
    }
  }

  for (const child of Array.from(node.childNodes)) {
    translateNode(language, child);
  }
}

export function RuntimeLanguageSync({ language }: { language: string }) {
  useEffect(() => {
    const root = document.body;

    if (!root) {
      return;
    }

    document.documentElement.lang = language;

    const run = () => {
      translateNode(language, root);
    };

    run();

    const observer = new MutationObserver(() => {
      run();
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "aria-label", "title"],
    });

    return () => {
      observer.disconnect();
    };
  }, [language]);

  return null;
}
