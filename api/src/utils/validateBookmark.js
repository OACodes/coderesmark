// api/src/utils/validateBookmark.js
//
// Request-body validator for POST /api/v1/bookmarks. Sits between
// the controller and the service in the request lifecycle; throws
// AppError on any shape/field violation so the controller can let
// the error middleware handle the HTTP response.
//
// Unlike normalizeUrl and hashUrl, which throw plain Error and let
// the service translate to AppError, this validator throws AppError
// directly. The reason: the validator is called from the controller,
// and per CLAUDE.md §5.1 controllers never try/catch for flow control —
// they pass to next(err). Whatever the validator throws flies straight
// to the error middleware, so the validator must speak HTTP semantics.
// normalizeUrl and hashUrl are called from the service, which owns the
// translation layer, so they speak plain Error.

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import mongoose from 'mongoose';
import { AppError } from './AppError.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate and clean the request body for POST /api/v1/bookmarks.
 *
 * Validates:
 *   - body is a non-null object
 *   - url is required, a non-empty string, and ≤ 2048 chars
 *   - title, if present, is a string ≤ 200 chars
 *   - favicon, if present, is a string ≤ 2048 chars
 *   - tags, if present, is an array of ≤ 20 strings, each ≤ 200 chars
 *   - category, if present, is a valid 24-char hex ObjectId
 *
 * On success, returns a cleaned object with the validated fields,
 * ready to be passed to bookmark.service.js#createBookmark.
 *
 * @param  {object} body    The req.body from the controller.
 * @returns {object}        A cleaned object with the validated fields.
 * @throws  {AppError}      400 with a per-field code on any violation.
 */
export const validateBookmarkInput = (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError('Request body is required', 400, 'INVALID_BODY');
    }
    if (!body.url) {
        throw new AppError('URL for Bookmark is required', 400, 'URL_REQUIRED');
    }
    if (typeof body.url !== 'string') {
        throw new AppError('Bookmark URL must be a string', 400, 'URL_INVALID_TYPE');
    }
    if (body.url.length > 2048) {
        throw new AppError('Bookmark URL cannot exceed 2048 characters', 400, 'URL_CHARACTER_LENGTH_EXCEEDED');
    }
    if (body.title !== undefined) {
        if (typeof body.title !== 'string') {
            throw new AppError('Bookmark title must be a string', 400, 'TITLE_INVALID_TYPE');
        }
        if (body.title.length > 200) {
            throw new AppError('Bookmark title cannot exceed 200 characters', 400, 'TITLE_CHARACTER_LENGTH_EXCEEDED');
        }
    }

    if (body.favicon !== undefined && typeof body.favicon !== 'string') {
        throw new AppError('Bookmark favicon must be a string', 400, 'FAVICON_INVALID_TYPE');
    }
    if (body.favicon !== undefined && body.favicon.length > 2048) {
        throw new AppError('Bookmark favicon cannot exceed 2048 characters', 400, 'FAVICON_CHARACTER_LENGTH_EXCEEDED');
    }

    if (body.tags !== undefined) {
        if (!Array.isArray(body.tags)) {
            throw new AppError('Bookmark tags must be an array', 400, 'TAGS_INVALID_TYPE');
        }
        if (body.tags.length > 20) {
            throw new AppError('Bookmark exceeds 20 tags limit', 400, 'TAGS_LIMIT_EXCEEDED');
        }
        for (const tag of body.tags) {
            if (typeof tag !== 'string') {
                throw new AppError('Each bookmark tag must be a string', 400, 'TAG_INVALID_TYPE');
            }
            if (tag.length > 200) {
                throw new AppError(`Bookmark tag exceeded 200 characters`, 400, 'TAG_CHARACTER_LENGTH_EXCEEDED');
            }
        }
    }
    if (body.category !== undefined && !mongoose.Types.ObjectId.isValid(body.category)) {
        throw new AppError('category must be a valid 24-character hex ObjectId', 400, 'CATEGORY_INVALID');
    }

    return {
        url: body.url,
        title: body.title ? body.title.trim() : undefined,
        favicon: body.favicon,
        tags: body.tags,
        category: body.category,
    };
};
