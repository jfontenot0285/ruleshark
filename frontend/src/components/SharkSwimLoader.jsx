function SharkFin() {
  return (
    <svg
      className="shark-loader-fin"
      viewBox="0 0 64 40"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Dorsal fin: curved leading edge faces swim direction (right) */}
      <path
        d="M18 36
           L34 3
           C40 9 47 22 50 36
           C40 37 28 37 18 36 Z"
        fill="#8b949e"
      />
      <path
        d="M22 35
           L35 8
           C39 14 44 24 47 34
           C38 35 28 35 22 35 Z"
        fill="#a8b0ba"
        opacity="0.85"
      />
      <path
        d="M34 4 L21 34"
        fill="none"
        stroke="#6b737c"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}

export default function SharkSwimLoader({
  label = "Running simulation…",
  count = 2,
}) {
  const finCount = Math.min(6, Math.max(1, Number(count) || 2));

  return (
    <div className="shark-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="shark-loader-scene">
        <div className="shark-loader-sky" aria-hidden="true" />

        {Array.from({ length: finCount }, (_, index) => {
          const reverse = index % 2 === 1;
          return (
            <div
              key={index}
              className={`shark-loader-swimmer ${reverse ? "is-reverse" : ""}`}
              aria-hidden="true"
              style={{
                animationDelay: `${index * 0.55}s`,
                ["--fin-bob-delay"]: `${index * 0.18}s`,
              }}
            >
              <SharkFin />
            </div>
          );
        })}

        <div className="shark-loader-water" aria-hidden="true">
          <svg
            className="shark-loader-wave shark-loader-wave-back"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M0,60 C150,30 300,90 450,60 C600,30 750,90 900,60 C1050,30 1150,70 1200,60 L1200,120 L0,120 Z"
              fill="rgba(40, 120, 190, 0.55)"
            />
          </svg>
          <svg
            className="shark-loader-wave shark-loader-wave-front"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M0,70 C200,100 400,40 600,70 C800,100 1000,40 1200,70 L1200,120 L0,120 Z"
              fill="rgba(30, 100, 170, 0.72)"
            />
          </svg>
        </div>
      </div>

      <p className="shark-loader-label">{label}</p>
    </div>
  );
}
