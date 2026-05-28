import { getAllUserCategoriesService, getSingleCategoryService, createCategoryService, updateCategoryService, deleteCategoryService } from '../services/category.service.js';

const getAllUserCategories = async (req, res, next) => {
    try{
        const AllUserCategories = await getAllUserCategoriesService(req.params.id, req.user.userId);

        res.status(200).json({ success: true, data: AllUserCategories });
    }catch(error){
        next(error);
    }
}

const getSingleCategory = async (req, res, next) => {
    try{
        const SingleCategory = await getSingleCategoryService(req.params.id, req.user.userId);

        res.status(200).json({ success: true, data: category });
    }catch(error){
        next(error);
    }
}


const createCategory = async (req, res, next) => {
    try{
        const category = await createCategoryService(req.body);

        res.status(201).json({ success: true, data: category });
    }catch(error){
        next(error);
    }
}

const updateCategory = async (req, res, next) => {
    try{
        const updatedCategory = await updateCategoryService(req.params.id, req.user.userId, req.body);

        res.status(200).json({ success: true, data: updateCategory });
    }catch(error){
        next(error);
    }
}

const deleteCategory = async (req, res, next) => {
    try{
        const deleteCategory = await deleteCategoryService(req.params.id, req.user.userId);

        res.status(20).json({ success: true, message: 'Category has been deleted!' });
    }catch(error){
        next(error);
    }
}