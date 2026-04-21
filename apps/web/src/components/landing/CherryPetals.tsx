/* Six drifting cherry petals. CSS drives the fall + rotation loops. */

function Petal() {
  return (
    <svg className="petal" width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
      {/* 5-lobe petal; fill uses currentColor so each .petal can be tinted via CSS */}
      <path
        d="M8 1 C10 1 12 3 11.5 6 C13 6 14.5 8 13 10 C11.5 12 9 11.5 8 13 C7 11.5 4.5 12 3 10 C1.5 8 3 6 4.5 6 C4 3 6 1 8 1 Z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="8" cy="7" r="1.2" fill="#FBE2A8" />
    </svg>
  );
}

export function CherryPetals() {
  return (
    <div className="petals" aria-hidden="true">
      <Petal /><Petal /><Petal /><Petal /><Petal /><Petal />
    </div>
  );
}
