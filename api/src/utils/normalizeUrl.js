// api/src/utils/normalizeUrl.js
//
// Turns any URL string into a single canonical form so that two URLs
// pointing to the same resource produce identical output. This is the
// first step in the bookmark deduplication pipeline; hashUrl() runs
// against the output of this function.
//
// The function throws plain Error on invalid input. The caller
// (bookmark.service.js#createBookmark) is responsible for converting
// those to AppError with the right HTTP semantics.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Query parameters that don't change the identity of the resource.
// Stripped during normalization. Add to this set deliberately —
// stripping too aggressively breaks legitimate query-string state.
const TRACKING_PARAMS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
    'mc_cid',
    'mc_eid',
    'ref',
    'ref_src',
]);

// Schemes that should NEVER be bookmarked. This is the security
// blocklist — the URL constructor accepts these as syntactically
// valid, so we have to reject them explicitly.
const BLOCKED_SCHEMES = new Set([
    'file:',
    'javascript:',
    'data:',
    'vbscript:',
    'chrome:',
    'chrome-extension:',
]);

// The only schemes we accept as legitimate bookmark targets.
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a raw URL string into canonical form.
 *
 * Steps (in order):
 *   1. Type-check the input.
 *   2. Parse with the URL constructor (catches malformed input).
 *   3. Reject blocked schemes (javascript:, file:, etc.).
 *   4. Reject non-http(s) schemes (ftp:, mailto:, etc.).
 *   5. Lowercase the host.
 *   6. Drop default ports (80 for http, 443 for https).
 *   7. Filter out tracking params; sort the rest alphabetically.
 *   8. Strip the fragment.
 *   9. Collapse trailing slashes on non-root paths.
 *  10. Return the resulting string.
 *
 * @param {string} rawUrl  The URL to normalize.
 * @returns {string}       The canonical form.
 * @throws {Error}         If input is not a string, malformed, or uses a
 *                         blocked/unsupported scheme.
 */
export const normalizeUrl = (rawUrl) => {
    // 1. Input type check — catch null/undefined/numbers before they reach
    //    the URL constructor (which would throw a less helpful error).
    if (typeof rawUrl !== 'string') {
        throw new Error(`Invalid URL: expected a string, got ${typeof rawUrl}`);
    }

    // 2. Parse. Wrapped in try/catch because the constructor throws on
    //    syntactically broken input (e.g. "not a url", "http://", "::::").
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error(`Invalid URL: ${rawUrl}`);
    }

    // 3. Security blocklist. The URL constructor accepts e.g.
    //    "javascript:alert(1)" as a valid URL instance, so we MUST
    //    check the scheme explicitly. This is the security boundary.
    if (BLOCKED_SCHEMES.has(parsed.protocol)) {
        throw new Error(`Blocked scheme: ${parsed.protocol}`);
    }

    // 4. Allowlist. Only http and https are valid bookmark targets.
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
        throw new Error(`Unsupported scheme: ${parsed.protocol}`);
    }

    // 5. Host is case-insensitive. Normalize to lowercase.
    parsed.hostname = parsed.hostname.toLowerCase();

    // 6. Default ports are redundant. Strip them so the canonical form
    //    doesn't carry noise.
    if (
        (parsed.protocol === 'https:' && parsed.port === '443') ||
        (parsed.protocol === 'http:' && parsed.port === '80')
    ) {
        parsed.port = '';
    }

    // 7. Filter out tracking params, sort the rest alphabetically.
    //    Sorting ensures "?a=1&b=2" and "?b=2&a=1" collapse to the
    //    same canonical form.
    const kept = [...parsed.searchParams.entries()]
        .filter(([key]) => !TRACKING_PARAMS.has(key))
        .sort(([a], [b]) => a.localeCompare(b));

    parsed.search = '';
    for (const [key, value] of kept) {
        parsed.searchParams.append(key, value);
    }

    // 8. Fragments are client-side only — never part of resource identity.
    parsed.hash = '';

    // 9. Build the canonical string from the structured fields. We
    //    avoid parsed.toString() because it always emits the path
    //    (including the bare "/" for root-only URLs), which makes the
    //    trailing-slash rule awkward to apply consistently. Building
    //    from the parts lets us collapse the trailing slash once, in
    //    one place, for all three cases:
    //      "https://example.com/"        -> "https://example.com"
    //      "https://example.com/foo/"    -> "https://example.com/foo"
    //      "https://example.com/?id=42"  -> "https://example.com?id=42"
    //    NOTE: some servers treat "/foo" and "/foo/" as different
    //    resources. This matches the behavior of GitHub, Twitter,
    //    and most major sites. If we find a site where it matters,
    //    flip this by removing the replace() call.
    const origin = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
    const query = parsed.search; // already cleared, then rebuilt alphabetically

    // 10. Emit the canonical form.
    return `${origin}${path}${query}`;
};
