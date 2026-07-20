"use client";

import {
  ElementType,
  ReactNode,
  CSSProperties,
  ComponentPropsWithoutRef,
  createElement,
  useEffect,
  useState,
} from "react";

type AnimationLevel = "full" | "soft" | "minimal";
type RevealDirection = "up" | "left" | "right" | "scale";

type RevealOnScrollProps<T extends ElementType> = Omit<
  ComponentPropsWithoutRef<T>,
  "as" | "children" | "className" | "style"
> & {
  as?: T;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  direction?: RevealDirection;
  once?: boolean;
  disabled?: boolean;
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AnimatedBackground({
  level = "soft",
  className,
}: {
  level?: AnimationLevel;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={joinClassNames("workbit-animated-background", `workbit-animated-background--${level}`, className)}
    >
      <span className="workbit-animated-background__orb workbit-animated-background__orb--one" />
      <span className="workbit-animated-background__orb workbit-animated-background__orb--two" />
      <span className="workbit-animated-background__mesh" />
      <span className="workbit-animated-background__ray" />
      {level !== "minimal" ? <span className="workbit-animated-background__fog" /> : null}
    </div>
  );
}

export function RevealOnScroll<T extends ElementType = "div">({
  as,
  children,
  className,
  style,
  delay = 0,
  direction = "up",
  once = true,
  disabled = false,
  ...props
}: RevealOnScrollProps<T>) {
  const Component = as ?? "div";
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(disabled);

  useEffect(() => {
    if (disabled) {
      setVisible(true);
      return;
    }

    if (!node) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          setVisible(true);

          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setVisible(false);
        }
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.08,
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [disabled, node, once]);

  return createElement(
    Component,
    {
      ...props,
      ref: setNode,
      className: joinClassNames(
        "workbit-reveal",
        `workbit-reveal--${direction}`,
        visible && "workbit-reveal--visible",
        className
      ),
      style: {
        ...style,
        "--workbit-reveal-delay": `${Math.max(0, delay)}ms`,
      } as CSSProperties,
    },
    children
  );
}

export function AnimatedPage({
  children,
  level = "soft",
  className,
  style,
}: {
  children: ReactNode;
  level?: AnimationLevel;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={joinClassNames("workbit-animated-page", className)} style={style}>
      <AnimatedBackground level={level} />
      <div className="workbit-animated-page__content">{children}</div>
    </div>
  );
}

export function AnimatedSection({
  children,
  className,
  style,
  delay,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
}) {
  return (
    <RevealOnScroll as="section" className={className} style={style} delay={delay}>
      {children}
    </RevealOnScroll>
  );
}

export function AnimatedCard({
  children,
  className,
  style,
  delay,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
}) {
  return (
    <RevealOnScroll as="section" className={joinClassNames("workbit-animated-card", className)} style={style} delay={delay}>
      {children}
    </RevealOnScroll>
  );
}

export function PressFeedback({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={joinClassNames("workbit-press-feedback", className)} style={style}>
      {children}
    </span>
  );
}

export function SuccessPulse({
  tone = "green",
  active,
}: {
  tone?: "green" | "red" | "purple";
  active: boolean;
}) {
  if (!active) {
    return null;
  }

  return <span aria-hidden="true" className={`workbit-success-pulse workbit-success-pulse--${tone}`} />;
}
