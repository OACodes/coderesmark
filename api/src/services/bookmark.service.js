import User from '../models/user.model.js';
import Bookmark from '../models/bookmark.model.js';
import Category from '../models/category.model.js';

const getAllUserBookmarks = async (RequestId, userId) => {
    
    const user = User.findById(userId);
    if (!user){
        const error = new Error('User is not found');
        error.statusCode(404);
        throw(error);
    }

    // FIX LATER
    if (RequestId !== user){
        const error = new Error('You are not the owner of this account');
        error.statusCode(401);
        throw(error);
    }

    const userBookmarks = await Bookmark.find({ userId : requestId });

    return userBookmarks;
};

const createBookmark = async ({ userId, url, urlHash, title, favicon, category, tags, aiMetadata, status }) => {
    const bookmark = await Bookmark.create({
        userId: userId,
        url: url,
        urlHash: urlHash,
        title: title,
        favicon: favicon,
        category: tags,
        aiMetadata: aiMetadata,
        status: status
    });
    
    return bookmark;
};


const updateBookmark = async (requestId, userId) => { // NEED TO ADD CHANGED Fields

    const bookmark = await Bookmark.findById(userId);

    if (!bookmark){
        const error = new Error('Bookmark does not exist');
        error.statusCode(404);
        throw(error);
    }

    if (bookmark.userId !== requestId){
        const error = new Error('You are not the owner of this subscription');
        error.statusCode(401);
        throw(error);
    }
    const updatedBookmark = await Bookmark.updateOne( bookmark.userId, ); // ADD new changed fields
    
    return updatedBookmark;
}

const searchBookmarks = async (req, res, next) => {
    
}