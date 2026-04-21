interface PreviewItem {
  n: string;
  t: string;
  d: string;
}

export function PlaceholderCard({
  milestone,
  title,
  body,
  previews,
}: {
  milestone: string;
  title: string;
  body: string;
  previews?: PreviewItem[];
}) {
  return (
    <div className="placeholder-card">
      <span className="tag">{milestone}</span>
      <h2>{title}</h2>
      <p>{body}</p>
      {previews && previews.length > 0 && (
        <div className="preview-grid">
          {previews.map((p) => (
            <div className="prev" key={p.n}>
              <div className="n">{p.n}</div>
              <div className="t">{p.t}</div>
              <div className="d">{p.d}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
