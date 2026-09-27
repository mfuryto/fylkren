export type ClassificationMarking = {
  name: string;
  abbreviation: string;
};

export function ClassificationControls({
  value,
  onChange,
  markings,
}: {
  value: string;
  onChange: (value: string) => void;
  markings: ClassificationMarking[];
}) {
  if (markings.length === 0) return null;

  const selected = markings.find((marking) =>
    value.startsWith(`(${marking.abbreviation}) `),
  );
  const unmarked = selected
    ? value.slice(selected.abbreviation.length + 3)
    : value;

  return (
    <div className="classification-controls" aria-label="Klassifiseringsmerking">
      <span>Merking:</span>
      <button
        className={!selected ? "selected" : ""}
        type="button"
        onClick={() => onChange(unmarked)}
      >
        Ingen
      </button>
      {markings.map((marking) => (
        <button
          className={
            selected?.abbreviation === marking.abbreviation ? "selected" : ""
          }
          type="button"
          key={marking.abbreviation}
          title={marking.name}
          onClick={() => onChange(`(${marking.abbreviation}) ${unmarked}`)}
        >
          {marking.name} ({marking.abbreviation})
        </button>
      ))}
    </div>
  );
}
