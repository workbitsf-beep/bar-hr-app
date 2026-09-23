function Bar({ width, height = 13 }: { width: string; height?: number }) {
  return <span className="wbc-skel" style={{ width, height }} />;
}

export default function Loading() {
  return (
    <div className="wbc-page" aria-busy="true" aria-label="Caricamento">
      <div className="wbc-page-head">
        <Bar width="42%" height={26} />
        <Bar width="78%" />
      </div>

      <div className="wbc-figure-band">
        {[0, 1, 2].map((index) => (
          <div key={index} className="wbc-figure">
            <Bar width="64%" height={9} />
            <Bar width="52%" height={26} />
            <Bar width="80%" height={9} />
          </div>
        ))}
      </div>

      <div className="wbc-section">
        <div className="wbc-section-head">
          <Bar width="26%" height={9} />
        </div>
        <div className="wbc-section-body wbc-flush">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="wbc-row">
              <span className="wbc-row-main">
                <Bar width="46%" height={14} />
                <Bar width="66%" height={10} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
.wbc-skel {
  display: block;
  border-radius: 6px;
  background: linear-gradient(90deg, #eeeef4 0%, #f7f7fb 50%, #eeeef4 100%);
  background-size: 200% 100%;
  animation: wbcSkel 1.25s ease-in-out infinite;
}

@keyframes wbcSkel {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .wbc-skel { animation: none; }
}
          `,
        }}
      />
    </div>
  );
}
