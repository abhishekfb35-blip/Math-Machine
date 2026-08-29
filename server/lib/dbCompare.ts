export function diffById<T extends { id: string }>(
  devRows: T[],
  prodRows: T[],
  fields: (keyof T)[],
) {
  const devMap = new Map(devRows.map((row) => [row.id, row]));
  const prodMap = new Map(prodRows.map((row) => [row.id, row]));
  const onlyInDev = devRows.filter((row) => !prodMap.has(row.id)).map((row) => row.id);
  const onlyInProd = prodRows.filter((row) => !devMap.has(row.id)).map((row) => row.id);
  const fieldMismatches: { id: string; field: string; dev: unknown; prod: unknown }[] = [];

  for (const devRow of devRows) {
    const prodRow = prodMap.get(devRow.id);
    if (!prodRow) continue;
    for (const field of fields) {
      if (JSON.stringify(devRow[field] ?? null) !== JSON.stringify(prodRow[field] ?? null)) {
        fieldMismatches.push({
          id: devRow.id,
          field: String(field),
          dev: devRow[field],
          prod: prodRow[field],
        });
      }
    }
  }

  return { devCount: devRows.length, prodCount: prodRows.length, onlyInDev, onlyInProd, fieldMismatches };
}

export function diffByContent<T>(
  devRows: T[],
  prodRows: T[],
  keyFn: (row: T) => string,
  labelFn: (row: T) => string,
) {
  const devKeys = new Set(devRows.map(keyFn));
  const prodKeys = new Set(prodRows.map(keyFn));
  return {
    devCount: devRows.length,
    prodCount: prodRows.length,
    onlyInDev: devRows.filter((row) => !prodKeys.has(keyFn(row))).map(labelFn),
    onlyInProd: prodRows.filter((row) => !devKeys.has(keyFn(row))).map(labelFn),
  };
}

export function diffSiteContent(
  devRows: Array<{ key: string; value: string }>,
  prodRows: Array<{ key: string; value: string }>,
) {
  const devMap = new Map(devRows.map((row) => [row.key, row.value]));
  const prodMap = new Map(prodRows.map((row) => [row.key, row.value]));
  return {
    devCount: devRows.length,
    prodCount: prodRows.length,
    onlyInDev: devRows.filter((row) => !prodMap.has(row.key)).map((row) => row.key),
    onlyInProd: prodRows.filter((row) => !devMap.has(row.key)).map((row) => row.key),
    valueChanged: devRows
      .filter((row) => prodMap.has(row.key) && prodMap.get(row.key) !== row.value)
      .map((row) => row.key),
  };
}