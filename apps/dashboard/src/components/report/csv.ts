type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => CsvValue;
}

function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(",")).join("\n");
  return `${header}\n${body}`;
}
