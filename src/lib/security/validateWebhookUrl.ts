import dns from 'dns';
import net from 'net';

/**
 * Checks whether an IPv4 address belongs to a private, loopback, or link-local range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // invalid format treated as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 172.16.0.0/12 (Private 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link-local & AWS/Cloud Metadata e.g. 169.254.169.254)
  if (a === 169 && b === 254) return true;

  return false;
}

/**
 * Checks whether an IPv6 address belongs to a loopback, unique local, or link-local range.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // ::1 or ::
  if (normalized === '::1' || normalized === '::') return true;
  // fc00::/7 (Unique local)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // fe80::/10 (Link-local)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (normalized.includes('::ffff:')) {
    const v4Part = normalized.split('::ffff:')[1];
    if (v4Part && net.isIPv4(v4Part)) {
      return isPrivateIPv4(v4Part);
    }
  }

  return false;
}

/**
 * Validates a webhook URL to prevent SSRF vulnerabilities.
 * Returns { valid: boolean, reason?: string }
 */
export async function validateWebhookUrl(urlStr: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    if (!urlStr || typeof urlStr !== 'string') {
      return { valid: false, reason: 'Missing or invalid webhook URL string' };
    }

    const parsed = new URL(urlStr);

    // 1. Scheme check: only allow https:
    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Blocked: only https:// webhooks are allowed for security' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Reject obvious local hostnames
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === '0.0.0.0'
    ) {
      return { valid: false, reason: 'Blocked: unsafe webhook URL target (local domain)' };
    }

    // 3. Check direct IP address literals
    if (net.isIPv4(hostname)) {
      if (isPrivateIPv4(hostname)) {
        return { valid: false, reason: 'Blocked: unsafe webhook URL target (private/link-local IPv4)' };
      }
    } else if (net.isIPv6(hostname)) {
      if (isPrivateIPv6(hostname)) {
        return { valid: false, reason: 'Blocked: unsafe webhook URL target (private/link-local IPv6)' };
      }
    } else {
      // 4. DNS resolution to check underlying IP addresses
      try {
        const addresses = await dns.promises.lookup(hostname, { all: true });
        for (const addr of addresses) {
          if (addr.family === 4 && isPrivateIPv4(addr.address)) {
            return { valid: false, reason: `Blocked: unsafe webhook URL target (${hostname} resolves to private IP ${addr.address})` };
          }
          if (addr.family === 6 && isPrivateIPv6(addr.address)) {
            return { valid: false, reason: `Blocked: unsafe webhook URL target (${hostname} resolves to private IP ${addr.address})` };
          }
        }
      } catch (dnsErr) {
        return { valid: false, reason: `Blocked: unable to resolve webhook hostname ${hostname}` };
      }
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `Blocked: invalid URL format - ${err.message}` };
  }
}
