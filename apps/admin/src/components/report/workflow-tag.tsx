// Deterministic colored pill for a workflow name. Same workflow name maps
// to the same hue across pages so a recipient can scan a report and visually
// group emails / leads by workflow without reading the text.

function workflowColor(name: string): { bg: string; text: string; border: string } {
  if (!name) return { bg: "#f3f4f6", text: "#6b7280", border: "#e5e7eb" };
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return {
    bg: `hsl(${hue}, 70%, 95%)`,
    text: `hsl(${hue}, 55%, 28%)`,
    border: `hsl(${hue}, 55%, 78%)`,
  };
}

export function WorkflowTag({ name }: { name: string }) {
  if (!name) return <span className="text-gray-400">—</span>;
  const { bg, text, border } = workflowColor(name);
  return (
    <span
      className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap"
      style={{ backgroundColor: bg, color: text, borderColor: border }}
    >
      {name}
    </span>
  );
}
