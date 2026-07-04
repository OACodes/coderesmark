import { getAllUserCategoriesService, getSingleCategoryService, createCategoryService, updateCategoryService, deleteCategoryService } from '../services/category.service.js';
import { validateCategoryInput } from '../utils/validator.js';
const getAllUserCategories = async (req, res, next) => {
    try{
        const AllUserCategories = await getAllUserCategoriesService(req.user.userId, req.user.userId);

        res.status(200).json({ success: true, data: AllUserCategories });
    }catch(error){
        next(error);
    }
}

const getSingleCategory = async (req, res, next) => {
    try{
        const SingleCategory = await getSingleCategoryService(req.params.id, req.user.userId);

        res.status(200).json({ success: true, data: SingleCategory });
    }catch(error){
        next(error);
    }
}


const createCategory = async (req, res, next) => {
    try{
        const validationErrors = validateCategoryInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors.join('; ')
            });
        }
        const { name, icon, color } = req.body;

        const category = await createCategoryService({ userId: req.user.userId, name, icon, color });

        res.status(201).json({ success: true, data: category });
    }catch(error){
        next(error);
    }
}

const updateCategory = async (req, res, next) => {
    try{
        const validationErrors = validateCategoryInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors.join('; ')
            });
        }

        const { name, icon, color } = req.body;

        const updatedCategory = await updateCategoryService(req.params.id, req.user.userId, { changedEntries: { name, icon, color } });
        res.status(200).json({ success: true, data: updatedCategory });
    }catch(error){
        next(error);
    }
}

const deleteCategory = async (req, res, next) => {
    try{
        const deleteCategory = await deleteCategoryService(req.params.id, req.user.userId);

        res.status(200).json({ success: true, message: 'Category has been deleted!', data: deleteCategory });
    }catch(error){
        next(error);
    }
}

export {
    getAllUserCategories,
    getSingleCategory,
    createCategory,
    updateCategory,
    deleteCategory
};