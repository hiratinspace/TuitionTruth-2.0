/**
 * Minimal RFC-4180 CSV parser. IPEDS directory files (HD*.csv) contain quoted
 * fields with embedded commas (institution names), so a naive split is wrong.
 * This state machine handles quoted fields, escaped quotes (""), and CRLF/LF
 * line endings. Kept dependency-free and pure so it is trivially testable.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = (): void => {
    row.push(field);
    field = "";
  };
  const pushRow = (): void => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < input.length) {
    const char = input[i];
    if (char === undefined) {
      break;
    }

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    if (char === "\r") {
      // Swallow CR; the following LF (if any) triggers the row push.
      if (input[i + 1] === "\n") {
        pushRow();
        i += 2;
        continue;
      }
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Flush the trailing field/row unless the input ended exactly on a newline.
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

/**
 * Parse CSV into an array of objects keyed by the header row. Trailing empty
 * lines are ignored.
 */
export function parseCsvRecords(input: string): Record<string, string>[] {
  const rows = parseCsv(input).filter((r) => !(r.length === 1 && r[0] === ""));
  const header = rows[0];
  if (header === undefined) {
    return [];
  }
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, idx) => {
      record[key] = cells[idx] ?? "";
    });
    return record;
  });
}
