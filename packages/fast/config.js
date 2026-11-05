// Routes are opt-in. Partial configuration must never activate forwarding.
export function httpEndpoint(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new TypeError('Fast transport requires a valid HTTP(S) endpoint'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new TypeError('Fast transport requires an HTTP(S) endpoint without credentials or fragment');
  }
  return url;
}

export function configuredRoute(config = {}) {
  const values = ['provider', 'sourceURL', 'targetURL'].map(key => {
    const value = config[key];
    if (value === undefined) return '';
    if (typeof value !== 'string') throw new TypeError(`Fast ${key} must be a string`);
    return value.trim();
  });
  if (values.some(value => !value)) return undefined;
  const [provider, sourceURL, targetURL] = values;
  return { provider, sourceURL: httpEndpoint(sourceURL).href, targetURL: httpEndpoint(targetURL).href };
}

export function assertFastProvider(route, provider) {
  if (!route) throw new Error('Fast 通道未配置；请配置 provider、sourceURL 和 targetURL，或切回标准档');
  if (provider !== route.provider) throw new Error(`Fast 尚未配置供应商 ${provider} 的通道；请切回标准档或使用 ${route.provider}`);
}
