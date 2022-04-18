function _getTableValue(n, table) {
  const loopStart = table.loopStart;
  const data = table.data;
  if (n < loopStart) {
    return data[n];
  }
  n -= loopStart;
  n %= data.length - loopStart;
  return data[loopStart + n];
}

export default function getTableValue(x, table) {
  let n = Math.floor(x);
  if (table.linear) {
    const mu = x - n;
    const x0 = _getTableValue(n, table);
    const x1 = _getTableValue(n + 1, table);
    return x0 + mu * (x1 - x0);
  }
  return _getTableValue(n, table);
}
