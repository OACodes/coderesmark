import Category from '../models/category.model.js';
import { AppError } from '../utils/AppError.js';
const getAllUserCategoriesService = async (targetId, authUserId) => {
    if (targetId.toString() !== authUserId.toString()){
        throw new AppError('You are not authorized to access this category', 403, 'UNAUTHORIZED_OWNER');
    }

    const categories = await Category.find({ userId: targetId });
    return categories;
};


const getSingleCategoryService = async (categoryId, authUserId) => {
    const category = await Category.findById(categoryId);
    if (!category){
        throw new AppError('Category does not exist', 404, 'CATEGORY_NOT_FOUND');
    }

    if (category.userId.toString() !== authUserId.toString()){
        throw new AppError('You are not the owner of this category', 403, 'UNAUTHORIZED_OWNER');
    }

    return category;
}

const createCategoryService = async ({ userId, name, icon, color, isSystem }) => {
    if (!userId) {
        throw new AppError('User ID is required', 400, 'MISSING_USER_ID');
    }
    const newCategory = await Category.create({
        userId: userId,
        name: name,
        icon: icon,
        color: color,
        isSystem: isSystem || false
    });

    return newCategory;
};

// targetId = req.params.id
// authUserId = req.user.userId
const updateCategoryService = async (targetId, authUserId, { changedEntries }) => {
    const category = await Category.findById(targetId);
    if (!category){
        throw new AppError('Category does not exist', 404, 'CATEGORY_NOT_FOUND');
    }

    if (category.userId.toString() !== authUserId.toString()){
        throw new AppError('You are not authorized to access this category', 403, 'UNAUTHORIZED_OWNER');
    }

    const updatedCategory = await Category.findByIdAndUpdate(
        targetId,
        changedEntries,
        { new: true }
    );
    return updatedCategory;
}

const deleteCategoryService = async (targetId, authUserId) => {
    const category = await Category.findById(targetId);

    if (!category){
        throw new AppError('Category does not exist', 404, 'CATEGORY_NOT_FOUND');
    }

    if (category.userId.toString() !== authUserId.toString()){
        throw new AppError('You are not authorized to access this category', 403, 'UNAUTHORIZED_OWNER');
    }

    if (category.isSystem === true){
        throw new AppError('Cannot delete system category', 403, 'SYSTEM_CATEGORY_IMMUTABLE');
    }

    await Category.findByIdAndDelete(targetId);
    return category;
}


export {
    getAllUserCategoriesService,
    getSingleCategoryService,
    createCategoryService,
    updateCategoryService,
    deleteCategoryService
};