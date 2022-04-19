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

export function getTableValue(x, table) {
  let n = Math.floor(x);
  if (table.linear) {
    const mu = x - n;
    const x0 = _getTableValue(n, table);
    const x1 = _getTableValue(n + 1, table);
    return x0 + mu * (x1 - x0);
  }
  return _getTableValue(n, table);
}

export function parseTable(str) {
  const tokens = str.replace("|", " | ").split(" ");
  let lastToken = tokens.pop();
  if (!lastToken.startsWith("/")) {
    tokens.push(lastToken);
    lastToken = "/100";
  }

  const linear = lastToken.endsWith("l");
  if (linear) {
    lastToken = lastToken.slice(0, -1);
  }
  const scale = parseInt(lastToken.slice(1));

  const data = [];

  let loopStart = Infinity;
  let index = 0;

  tokens.forEach(token => {
    if (!token.length) {
      return;
    }
    if (token === "|") {
      loopStart = index;
      return;
    }
    data.push(parseInt(token) / scale);
    index++;
  });

  loopStart = Math.min(data.length - 1, loopStart);

  return { linear, loopStart, data };
}
