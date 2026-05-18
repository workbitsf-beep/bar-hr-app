import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";

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
};

function BrandLogoContent({
  size,
  priority,
  showIcon,
  showSecondaryLabel,
  label,
  secondaryLabel,
  textColor,
  secondaryColor,
}: {
  size: number;
  priority: boolean;
  showIcon: boolean;
  showSecondaryLabel: boolean;
  label: string;
  secondaryLabel: string;
  textColor: string;
  secondaryColor: string;
}) {
  return (
    <>
      {showIcon ? (
        <span
          style={{
            width: size,
            height: size,
            borderRadius: 14,
            overflow: "hidden",
            background: "#ffffff",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 10px 22px rgba(15, 23, 42, 0.08)",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            src="/logo.png"
            alt="Workbit logo"
            width={size}
            height={size}
            priority={priority}
            sizes={`${size}px`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </span>
      ) : null}

      <span
        style={{
          display: "grid",
          gap: showSecondaryLabel ? 1 : 0,
          minWidth: 0,
        }}
      >
        <span
          style={{
            color: textColor,
            fontWeight: 600,
            fontSize: size >= 40 ? 18 : 16,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        {showSecondaryLabel ? (
          <span
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
    </>
  );
}

export function BrandLogo({
  href,
  size = 40,
  priority = false,
  showIcon = false,
  showSecondaryLabel = false,
  label = "Workbit",
  secondaryLabel = "ShiftHub",
  textColor = "#0f172a",
  secondaryColor = "#64748b",
  style,
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
          priority={priority}
          showIcon={showIcon}
          showSecondaryLabel={showSecondaryLabel}
          label={label}
          secondaryLabel={secondaryLabel}
          textColor={textColor}
          secondaryColor={secondaryColor}
        />
      </Link>
    );
  }

  return (
    <div style={sharedStyle}>
      <BrandLogoContent
        size={size}
        priority={priority}
        showIcon={showIcon}
        showSecondaryLabel={showSecondaryLabel}
        label={label}
        secondaryLabel={secondaryLabel}
        textColor={textColor}
        secondaryColor={secondaryColor}
      />
    </div>
  );
}
