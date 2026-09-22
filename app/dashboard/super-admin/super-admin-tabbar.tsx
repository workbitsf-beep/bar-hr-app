"use client";

import Link from "next/link";

export function SuperAdminFab() {
  return (
    <>
      <Link href="/dashboard/super-admin/new" className="sa-fab" aria-label="Nuovo titolare e locale">
        +
      </Link>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .sa-fab {
              position: fixed;
              right: 18px;
              bottom: calc(92px + env(safe-area-inset-bottom, 0px));
              width: 52px;
              height: 52px;
              border-radius: 18px;
              background: linear-gradient(135deg, #7b2ff7, #a855f7);
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 26px;
              font-weight: 300;
              line-height: 1;
              text-decoration: none;
              box-shadow: 0 14px 28px rgba(123, 47, 247, 0.32);
              z-index: 250;
            }
          `,
        }}
      />
    </>
  );
}
