export function WorkReference({ referenceCode }: {
  referenceCode: string;
}) {
  return <span className="task-reference-block">
    <span className="task-reference">{referenceCode}</span>
  </span>;
}
