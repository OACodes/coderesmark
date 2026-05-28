import { Router } from "express";
import verifyJWT from '../middleware/auth.middleware.js';
const bookmarkRouter = Router();

// NOTE: remember auth is required for some of these routes

// get all users bookmarks
bookmarkRouter.get('/', );

// create a bookmark ()
bookmarkRouter.post('/',);

// create a bookmark by for specific user
bookmarkRouter.post('/:id', );

// update a bookmark (by Id cause it will be for a specific user)
bookmarkRouter.patch('/:id', );

// delete a category (by Id cause it will be for a specific user that has it)
bookmarkRouter.delete('/:id', );

export default bookmarkRouter;