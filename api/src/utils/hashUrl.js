// api/src/utils/hashUrl.js
//
// Turns a (userId, normalizedUrl) pair into a fixed-length SHA-256
// fingerprint. This is the second step in the bookmark deduplication
// pipeline; bookmark.service.js#createBookmark calls this with the
// output of normalizeUrl() to produce the urlHash field that backs
// the unique compound index on (userId, urlHash).
//
// The function throws plain Error on invalid input. The caller
// (bookmark.service.js#createBookmark) is responsible for converting
// those to AppError with the right HTTP semantics.

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Hash a (userId, normalizedUrl) pair into a 64-character lowercase
 * hex SHA-256 digest.
 *
 * The digest is per-user by design: the same URL saved by two different
 * users produces two different hashes, so there is no cross-user
 * collision and no cross-user lookup is possible. See
 * docs/data-model.md §1.3 and docs/sprint-status.md divergence #5
 * for the privacy rationale.
 *
 * Steps (in order):
 *   1. Validate userId.
 *   2. Validate normalizedUrl.
 *   3. Coerce userId to a stable string (handles Mongoose ObjectId).
 *   4. Build the canonical input string with a separator.
 *   5. Hash and return the hex digest.
 *
 * @param  {string|ObjectId} userId          The owning user. Strings and
 *                                           Mongoose ObjectIds both
 *                                           accepted (ObjectId is coerced
 *                                           via .toString()). Other types
 *                                           (number, boolean, null, etc.)
 *                                           throw.
 * @param  {string}          normalizedUrl   The output of normalizeUrl().
 *                                           Must be a non-empty string.
 * @returns {string}                         64-character lowercase hex
 *                                           SHA-256 digest.
 * @throws  {Error}                          If userId is not a string or
 *                                           ObjectId, or is an empty
 *                                           string; or if normalizedUrl
 *                                           is not a non-empty string.
 */
export const hashUrl = (userId, normalizedUrl) => {
    // 1. userId validation. We accept strings and Mongoose ObjectId
    //    instances. Numbers, booleans, null, and undefined are
    //    rejected — passing a numeric userId is a programmer error
    //    upstream, and silent coercion would hide the bug.
    //    The type check must happen BEFORE the coercion: String(123)
    //    returns "123" and String(true) returns "true", both of
    //    which would pass a "is the coerced result non-empty?"
    //    check. The type is the only thing that distinguishes a
    //    real userId from a coerced primitive.
    const isString = typeof userId === 'string';
    const isObjectId = userId instanceof mongoose.Types.ObjectId;
    if (!isString && !isObjectId) {
        throw new Error(`Invalid userId: expected a string or ObjectId, got ${typeof userId}`);
    }
    const userIdStr = String(userId);
    if (userIdStr === '') {
        throw new Error(`Invalid userId: empty string`);
    }

    // 2. normalizedUrl validation. Must be a non-empty string. An
    //    empty URL would hash deterministically but produce a
    //    useless dedup key — fail loud at the boundary.
    if (typeof normalizedUrl !== 'string' || normalizedUrl.length === 0) {
        throw new Error(`Invalid normalizedUrl: expected a non-empty string, got ${typeof normalizedUrl}`);
    }

    // 3. Build the canonical input string. The ':' separator prevents
    //    concatenation ambiguity: without it, hashUrl("ab","c") and
    //    hashUrl("a","bc") would produce the same digest, because
    //    both would hash the string "abc". The separator is part of
    //    the contract — see docs/data-model.md §2 line 77
    //    ("SHA-256(userId + normalizedUrl)"). We use the colon
    //    explicitly rather than relying on concatenation alone.
    const input = `${userIdStr}:${normalizedUrl}`;

    // 4. Hash. SHA-256 is the documented algorithm; do not swap
    //    without a migration plan (the unique index is built on
    //    64-char hex digests of this algorithm). 'utf8' is the
    //    default but stated explicitly so the encoding choice is
    //    load-bearing in code review. 'hex' gives us the lowercase
    //    64-char representation that Mongo string comparisons can
    //    handle directly.
    return createHash('sha256').update(input, 'utf8').digest('hex');
};
