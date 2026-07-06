// Expand a name-based formula (Replicon-style) into a login name or email.
// Supported tokens: $FName, $LName, $FNameLower, $LNameLower, $FInitial,
// $LInitial, $FInitialLower, $LInitialLower. Everything else is literal
// (e.g. "@liveroute.com"). Whitespace is stripped from the result.
export function applyNameFormula(formula, firstName = '', lastName = '') {
  const f = String(firstName).trim();
  const l = String(lastName).trim();
  const map = {
    '$FNameLower':    f.toLowerCase(),
    '$LNameLower':    l.toLowerCase(),
    '$FName':         f,
    '$LName':         l,
    '$FInitialLower': (f[0] || '').toLowerCase(),
    '$LInitialLower': (l[0] || '').toLowerCase(),
    '$FInitial':      (f[0] || '').toUpperCase(),
    '$LInitial':      (l[0] || '').toUpperCase(),
  };
  let out = String(formula || '');
  // Replace longer tokens first so $FNameLower isn't partially eaten by $FName.
  Object.keys(map).sort((a, b) => b.length - a.length).forEach(tok => {
    out = out.split(tok).join(map[tok]);
  });
  return out.replace(/\s+/g, '');
}

export const DEFAULT_LOGIN_FORMULA = '$FNameLower.$LNameLower';
export const DEFAULT_EMAIL_FORMULA = '$FNameLower.$LNameLower@liveroute.com';
