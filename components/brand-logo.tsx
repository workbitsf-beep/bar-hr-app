"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { BrandMark } from "./brand-mark";

type BrandLogoProps = {
  href?: string;
  size?: number;
  priority?: boolean;
  showIcon?: boolean;
  showSecondaryLabel?: boolean;
  label?: string;
  secondaryLabel?: string;
  textColor?: string;
  secondaryColor?: string;
  style?: CSSProperties;
  /** The ground the mark sits on: navy W on light, white W on dark. */
  tone?: "light" | "dark";
};

function BrandLogoContent({
  size,
  showIcon,
  showSecondaryLabel,
  label,
  secondaryLabel,
  textColor,
  secondaryColor,
  tone,
}: {
  size: number;
  showIcon: boolean;
  showSecondaryLabel: boolean;
  label: string;
  secondaryLabel: string;
  textColor: string;
  secondaryColor: string;
  tone: "light" | "dark";
}) {
  // With the icon, the mark alone: the name next to it was dropped on
  // 6 Oct 2026, and the tile with logo.png gave way to the vector mark.
  // The name stays for screen readers.
  if (showIcon) {
    return <BrandMark size={Math.round(size * 1.15)} tone={tone} title={label} />;
  }

  return (
    <span
      style={{
        display: "grid",
        gap: showSecondaryLabel ? 1 : 0,
        minWidth: 0,
      }}
    >
      <span
        className="brand-logo-label"
        style={{
          color: textColor,
          fontWeight: 800,
          fontSize: size >= 40 ? 18 : 16,
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {showSecondaryLabel && secondaryLabel.trim() ? (
        <span
          className="brand-logo-secondary-label"
          style={{
            color: secondaryColor,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            lineHeight: 1.1,
          }}
        >
          {secondaryLabel}
        </span>
      ) : null}
    </span>
  );
}

export function BrandLogo({
  href,
  size = 40,
  showIcon = false,
  showSecondaryLabel = false,
  label = "Workbit",
  secondaryLabel = "",
  textColor = "#0f172a",
  secondaryColor = "#64748b",
  style,
  tone = "light",
}: BrandLogoProps) {
  const sharedStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    textDecoration: "none",
    minWidth: 0,
    ...style,
  };

  if (href) {
    return (
      <Link href={href} style={sharedStyle}>
        <BrandLogoContent
          size={size}
          showIcon={showIcon}
          showSecondaryLabel={showSecondaryLabel}
          label={label}
          secondaryLabel={secondaryLabel}
          textColor={textColor}
          secondaryColor={secondaryColor}
          tone={tone}
        />
      </Link>
    );
  }

  return (
    <div style={sharedStyle}>
      <BrandLogoContent
        size={size}
        showIcon={showIcon}
        showSecondaryLabel={showSecondaryLabel}
        label={label}
        secondaryLabel={secondaryLabel}
        textColor={textColor}
        secondaryColor={secondaryColor}
        tone={tone}
      />
    </div>
  );
}
