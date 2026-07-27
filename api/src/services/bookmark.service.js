import mongoose from 'mongoose';
import Bookmark from '../models/bookmark.model.js';
import Category from '../models/category.model.js';
import { AppError } from '../utils/AppError.js';
import { normalizeUrl } from '../utils/normalizeUrl.js';
import { hashUrl } from '../utils/hashUrl.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Fields the user is allowed to update on an existing bookmark. Anything
// outside this set (userId, url, urlHash, status, aiMetadata, timestamps)
// is system-managed and must not be writable from the request body.
const UPDATABLE_FIELDS = new Set(['title', 'tags', 'category', 'favicon']);

// Hard cap on getAllUserBookmarks to bound response size. The popup UI
// is not going to render more than this anyway; without the cap a
// user with 100k bookmarks would have them all returned in one shot.
const LIST_MAX_RESULTS = 100;

// Hard cap on searchBookmarks. Smaller than LIST_MAX_RESULTS because
// the search is sorted by relevance score — top-50 is the useful range.
const SEARCH_MAX_RESULTS = 50;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List every bookmark belonging to a single user, most recent first.
 *
 * The query filter ({ userId }) IS the authorization — there is no
 * separate ownership check because the database physically cannot
 * return documents owned by other users.
 *
 * @param  {string|ObjectId} userId   The authenticated user's id.
 * @returns {Promise<Bookmark[]>}     Array of bookmarks, newest first.
 *                                    Empty array if the user has none.
 *                                    Capped at LIST_MAX_RESULTS.
 * @throws  {AppError}                 400 USER_ID_REQUIRED if userId is missing.
 */
export const getAllUserBookmarks = async (userId) => {
    if (!userId) {
        throw new AppError('userId is required', 400, 'USER_ID_REQUIRED');
    }

    const userBookmarks = await Bookmark.find({ userId })
        .sort({ createdAt: -1 })
        .limit(LIST_MAX_RESULTS)
        .lean();
    return userBookmarks;
};

/**
 * Create a new bookmark for a user. Normalizes and dedups the URL
 * atomically via the (userId, urlHash) unique compound index.
 *
 * The dedup race is closed by using findOneAndUpdate with upsert:true:
 * a double-click on "Save" is serialized at the database level, and
 * the second request gets a 409 instead of an E11000 duplicate-key 500.
 *
 * @param  {object}        params
 * @param  {string|ObjectId} params.userId    The authenticated user's id.
 * @param  {string}        params.url         The raw URL to save.
 * @param  {string}        [params.title]     User-supplied title.
 * @param  {string}        [params.favicon]   User-supplied favicon URL.
 * @param  {string[]}      [params.tags]      User-supplied tags.
 * @param  {string|ObjectId|null} [params.category] Category id. If omitted
 *                                            or null, the bookmark is
 *                                            assigned to the system
 *                                            'Uncategorized' category.
 * @returns {Promise<Bookmark>}               The newly created bookmark.
 * @throws  {AppError}                         400 on bad input, 404 if a
 *                                            supplied category doesn't
 *                                            exist, 403 if the user
 *                                            doesn't own that category,
 *                                            409 on duplicate URL.
 */
export const createBookmark = async ({ userId,
    url,
    title = undefined,
    favicon = undefined,
    tags = undefined,
    category = undefined,
}) => {

    // 1. userId is required.
    if (!userId) {
        throw new AppError('userId is required', 400, 'USER_ID_REQUIRED');
    }

    // 2. Normalize the URL. Switch on the error's .code property
    //    (set by normalizeUrl) so this layer is decoupled from the
    //    util's human-readable message text.
    let normalized;
    try {
        normalized = normalizeUrl(url);
    } catch (error) {
        switch (error.code) {
            case 'URL_INVALID_TYPE':
                throw new AppError('URL must be a string', 400, 'URL_INVALID_TYPE');
            case 'URL_INVALID':
                throw new AppError('URL is malformed', 400, 'URL_INVALID');
            case 'URL_BLOCKED_SCHEME':
                throw new AppError('URL uses a blocked scheme', 400, 'URL_BLOCKED_SCHEME');
            case 'URL_UNSUPPORTED_SCHEME':
                throw new AppError('URL must be http or https', 400, 'URL_UNSUPPORTED_SCHEME');
            default:
                // Unknown error from the util — surface as 500 with the
                // original message for debugging, but do not silently
                // proceed with normalized === undefined.
                throw new AppError(`URL processing failed: ${error.message}`, 500, 'URL_PROCESSING_FAILED');
        }
    }

    // 3. Compute the per-user URL hash.
    let urlHash;
    try {
        urlHash = hashUrl(userId, normalized);
    } catch (error) {
        throw new AppError(`Hashing failed: ${error.message}`, 500, 'HASH_FAILED');
    }

    // 4. Resolve the category. If the user supplied one, verify it
    //    exists and belongs to them. If they didn't (or passed null),
    //    fall back to the system 'Uncategorized' category so every
    //    bookmark has a category — the popup's "filter by category"
    //    UI degrades badly if any bookmark has none.
    let resolvedCategory;
    if (category !== undefined && category !== null) {
        if (!mongoose.Types.ObjectId.isValid(category)) {
            throw new AppError('Invalid category id', 400, 'CATEGORY_INVALID');
        }
        const foundCategory = await Category.findById(category);
        if (!foundCategory) {
            throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
        }
        // Compare via .toString() — bookmark.userId is a Mongoose
        // ObjectId; userId from the controller is a string. ObjectId
        // === String is always false even for the same underlying id.
        if (foundCategory.userId.toString() !== userId.toString()) {
            throw new AppError('You do not own this category', 403, 'CATEGORY_UNAUTHORIZED');
        }
        resolvedCategory = foundCategory._id;
    } else {
        const uncategorized = await Category.findOne({ isSystem: true, name: 'Uncategorized' });
        if (!uncategorized) {
            throw new AppError('System Uncategorized category is missing — run the seed', 500, 'UNCATEGORIZED_MISSING');
        }
        resolvedCategory = uncategorized._id;
    }

    // 5. Atomic upsert. The (userId, urlHash) compound index makes
    //    the find-and-insert one database operation, eliminating the
    //    TOCTOU race that a separate Bookmark.create() would have.
    //    updatedExisting tells us which path was taken.
    const bookmark = await Bookmark.findOneAndUpdate(
        { userId, urlHash },
        {
            $setOnInsert: {
                userId: userId,
                url: normalized,
                urlHash: urlHash,
                title: title,
                favicon: favicon,
                category: resolvedCategory,
                tags: tags,
            },
        },
        { upsert: true, new: true, includeResultMetadata: true }
    );

    // 6. updatedExisting: true means a document with this
    //    (userId, urlHash) already existed before this call — the
    //    user is trying to save a URL they've already saved.
    if (bookmark?.lastErrorObject?.updatedExisting === true) {
        throw new AppError('Bookmark already exists', 409, 'BOOKMARK_DUPLICATE');
    }

    if (!bookmark) {
        throw new AppError('Bookmark creation failed unexpectedly', 500, 'BOOKMARK_CREATE_FAILED');
    }

    return bookmark.value;
};

/**
 * Apply a partial update to one of the user's bookmarks.
 *
 * Only the fields listed in UPDATABLE_FIELDS can be changed. Setting
 * a category to null clears it (falls back to Uncategorized on save).
 *
 * @param  {string|ObjectId} bookmarkId   The bookmark to update.
 * @param  {string|ObjectId} userId       The authenticated user's id.
 * @param  {object}          updates      The fields to change. Keys
 *                                        must be in UPDATABLE_FIELDS;
 *                                        values must match the field's
 *                                        expected type (the controller
 *                                        is responsible for shape).
 * @returns {Promise<Bookmark>}            The post-update document.
 * @throws  {AppError}                      400 on bad input (invalid
 *                                        id, invalid updates object,
 *                                        illegal field, invalid category),
 *                                        404 if the bookmark doesn't
 *                                        exist, 403 if the user doesn't
 *                                        own it.
 */
export const updateBookmark = async (bookmarkId, userId, updates) => {
    // Confirming UserId Present
    if (!userId){
        throw new AppError('userId is required', 400, 'USER_ID_REQUIRED');
    }

    // Bookmark ID validation check
    if (!mongoose.Types.ObjectId.isValid(bookmarkId)){
        throw new AppError('Invalid bookmark id', 400, 'BOOKMARK_ID_INVALID');
    }

    const bookmark = await Bookmark.findById(bookmarkId);

    // Bookmark Existence Check
    if (!bookmark){
        throw new AppError('Bookmark not found', 404, 'BOOKMARK_NOT_FOUND');
    }

    // Ownership check. Direction: requesting user's id must match the
    // bookmark's userId. Compare via .toString() on both sides so the
    // ObjectId-vs-string type mismatch doesn't false-positive.
    if (bookmark.userId.toString() !== userId.toString()){
        throw new AppError('You are not the owner of this bookmark', 403, 'BOOKMARK_UNAUTHORIZED');
    }

    // Validate updates entries
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)){
        throw new AppError('Updates must be a non-null object', 400, 'INVALID_UPDATES');
    }

    // Whitelist updated fields
    const illegalKeys = Object.keys(updates).filter((key) => !UPDATABLE_FIELDS.has(key));
    if (illegalKeys.length > 0){
        throw new AppError(`Fields cannot be updated: ${illegalKeys.join(', ')}`, 400, 'FIELD_NOT_UPDATEABLE');
    }

    // Category existence and ownership check. Per Option A, `null`
    // means "clear the category" — fall back to the system
    // Uncategorized sentinel so the bookmark always has one.
    if (updates.category === null) {
        const uncategorized = await Category.findOne({ isSystem: true, name: 'Uncategorized' });
        if (!uncategorized) {
            throw new AppError('System Uncategorized category is missing — run the seed', 500, 'UNCATEGORIZED_MISSING');
        }
        updates.category = uncategorized._id;
    } else if (updates.category !== undefined){
        if (!mongoose.Types.ObjectId.isValid(updates.category)) {
            throw new AppError('Invalid category id', 400, 'CATEGORY_INVALID');
        }
        const foundCategory = await Category.findById(updates.category);
        if (!foundCategory) {
            throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
        }
        if (foundCategory.userId.toString() !== userId.toString()) {
            throw new AppError('You do not own this category', 403, 'CATEGORY_UNAUTHORIZED');
        }
        updates.category = foundCategory._id;
    }

    // ADD new changed fields
    const updatedBookmark = await Bookmark.findByIdAndUpdate(bookmarkId, updates, { new: true });
    return updatedBookmark;
};

/**
 * Delete one of the user's bookmarks.
 *
 * Uses an atomic findOneAndDelete with a {_id, userId} filter so the
 * existence check and ownership check happen in a single database
 * roundtrip. A null result is ambiguous: it could be "the bookmark
 * doesn't exist" or "the user doesn't own it" — both surface as 404.
 * This is an acceptable trade-off for the speedup; the previous
 * two-step version distinguished the two with a 403 on the
 * ownership case, at the cost of an extra DB call.
 *
 * Returns the deleted document so the controller can confirm what
 * was removed.
 *
 * @param  {string|ObjectId} bookmarkId   The bookmark to delete.
 * @param  {string|ObjectId} userId       The authenticated user's id.
 * @returns {Promise<Bookmark>}            The deleted document.
 * @throws  {AppError}                      400 on missing userId or
 *                                        invalid bookmark id, 404 if
 *                                        the bookmark doesn't exist OR
 *                                        the user doesn't own it.
 */
export const deleteBookmark = async (bookmarkId, userId) => {
    // Confirming UserId Present
    if (!userId){
        throw new AppError('userId is required', 400, 'USER_ID_REQUIRED');
    }

    // Bookmark ID validation check
    if (!mongoose.Types.ObjectId.isValid(bookmarkId)){
        throw new AppError('Invalid bookmark id', 400, 'BOOKMARK_ID_INVALID');
    }

    // Atomic delete. The {_id, userId} filter collapses the
    // existence check and the ownership check into one operation:
    // if the user doesn't own the bookmark, the filter doesn't
    // match, and the result is null. We then 404 — the response is
    // the same whether the bookmark doesn't exist or isn't theirs,
    // which is also slightly better for security (doesn't leak
    // existence of other users' bookmarks).
    const deleted = await Bookmark.findOneAndDelete({ _id: bookmarkId, userId });
    if (!deleted){
        throw new AppError('Bookmark not found', 404, 'BOOKMARK_NOT_FOUND');
    }

    return deleted;
};

/**
 * Full-text search across the user's bookmarks.
 *
 * Uses the text index defined in bookmark.model.js (on title,
 * aiMetadata.summary, and tags). Results are sorted by relevance
 * score descending and capped at SEARCH_MAX_RESULTS.
 *
 * @param  {string|ObjectId} userId   The authenticated user's id.
 * @param  {string}          query    The search text. Trimmed before
 *                                    passing to MongoDB.
 * @returns {Promise<Bookmark[]>}     Up to SEARCH_MAX_RESULTS matching
 *                                    bookmarks, most relevant first.
 *                                    Empty array if no matches.
 * @throws  {AppError}                 400 on missing userId, missing
 *                                    query, or query > 200 chars.
 */
export const searchBookmarks = async (userId, query) => {
    // Check for userId is present
    if (!userId){
        throw new AppError('userId is required', 400, 'USER_ID_REQUIRED');
    }

    // Check query to be string and non empty
    if (typeof query !== 'string' || query.trim() === ''){
        throw new AppError('Search query is required', 400, 'QUERY_REQUIRED');
    }

    if (query.length > 200){
        throw new AppError('Query exceeded 200 characters', 400, 'QUERY_CHARACTER_LENGTH_EXCEEDED');
    }

    const trimmedQuery = query.trim();
    // The $text operator depends on the text index in
    // bookmark.model.js (title, aiMetadata.summary, tags). If the
    // index is ever removed, this query will throw at the DB level.
    const filter = { userId, $text: { $search: trimmedQuery }};
    const bookmarks = await Bookmark.find(filter, { score: { $meta: 'textScore' }})
        .sort({ score: { $meta: 'textScore' }})
        .limit(SEARCH_MAX_RESULTS)
        .lean();

    return bookmarks;
};
