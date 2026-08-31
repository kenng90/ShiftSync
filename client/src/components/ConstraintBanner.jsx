export default function ConstraintBanner({ error, onPick }) {
  if (!error) return null;
  const data = error.payload || {};
  const violations = data.violations || [];
  const suggestions = data.suggestions || [];
  return (
    <div className="banner danger">
      <strong>{error.message}</strong>
      <ul>
        {violations.map((v) => (
          <li key={v.rule}>
            <span className="rule">{v.rule}</span> {v.message}
          </li>
        ))}
      </ul>
      {suggestions.length ? (
        <p>
          Try:{' '}
          {suggestions.map((s) => (
            <button key={s.userId} className="chip" type="button" onClick={() => onPick?.(s.userId)}>
              {s.name}
            </button>
          ))}
        </p>
      ) : null}
    </div>
  );
}
