// What Kestrel reads from its environment. The defaults are for development
// only: set every secret in a deployment.
import { readFileSync } from 'node:fs';

export const FENNEC_URL = (process.env.FENNEC_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
/** fennec-server's base for one tenant. */
export const tenantUrl = (tenant: string) => `${FENNEC_URL}/t/${tenant}`;

/** The node's own token: setup, the rollup worker. Never sent to a browser. */
export const OPERATOR_TOKEN = process.env.FENNEC_TOKEN ?? 'kestrel-dev-operator';
/** The node's admin token, which creates tenants. */
export const ADMIN_TOKEN = process.env.FENNEC_ADMIN_TOKEN ?? 'kestrel-dev-node-admin';
/** Signs the JWTs the node checks (scripts/db.sh writes it to the node's secret file). */
export const JWT_SECRET = process.env.FENNEC_JWT_SECRET ?? 'kestrel-dev-jwt-secret-of-at-least-32-bytes';
/** Signs the dashboard's session cookie. */
export const SESSION_SECRET = process.env.KESTREL_SESSION_SECRET ?? 'kestrel-dev-session-secret';
/** Plain http on localhost: the cookie without `Secure`. */
export const INSECURE_COOKIES = process.env.KESTREL_INSECURE_COOKIES === '1';

/** Kestrel's own tenant: the sites and who signs in. */
export const CONTROL = 'kestrel';
/** The market data tenant. */
export const MARKETS = 'markets';

/**
 * Take the visitor's country from this request header, which a CDN or a
 * proxy in front of Kestrel sets (Cloudflare's `cf-ipcountry`, say). Unset,
 * the country is the region of the browser's first language.
 */
export const COUNTRY_HEADER = process.env.KESTREL_COUNTRY_HEADER?.toLowerCase() || '';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
export const SITE_SCHEMA = read('schema.fennecql');
export const MARKETS_SCHEMA = read('markets.fennecql');
export const CONTROL_SCHEMA = read('control.fennecql');
