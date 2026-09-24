export type CsvRecord = { values: string[]; line: number };

// RFC-style quoted cells, escaped quotes and multiline values; retain the physical start line.
export function parseCsvRows(text: string): { records: CsvRecord[]; error?: string } {
  const records: CsvRecord[] = [];
  let values: string[] = [];
  let cell = "";
  let quoted = false;
  let afterQuote = false;
  let line = 1;
  let startLine = 1;
  const source = text.replace(/^\uFEFF/, "");
  const finish = () => {
    values.push(cell);
    if (values.length > 1 || values[0].trim()) records.push({ values, line: startLine });
    values = [];
    cell = "";
    afterQuote = false;
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; afterQuote = true; }
      else if (char === "\r" && source[i + 1] === "\n") { cell += "\n"; i++; line++; }
      else { cell += char; if (char === "\n" || char === "\r") line++; }
    } else if (char === "," || char === "\n" || char === "\r") {
      values.push(cell);
      cell = "";
      afterQuote = false;
      if (char !== ",") {
        if (values.length > 1 || values[0].trim()) records.push({ values, line: startLine });
        values = [];
        if (char === "\r" && source[i + 1] === "\n") i++;
        line++;
        startLine = line;
      }
    } else if (char === '"' && !cell && !afterQuote) {
      quoted = true;
    } else {
      if (char === '"' || afterQuote) return { records: [], error: `Malformed CSV near line ${line}` };
      cell += char;
    }
  }
  if (quoted) return { records: [], error: `Unclosed quote near line ${startLine}` };
  finish();
  return { records };
}