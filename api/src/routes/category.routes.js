import { Router } from 'express';
import { getAllUserCategories, getSingleCategory, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller.js';

const categoryRouter = Router();

// get all user categories
categoryRouter.get('/:id', getAllUserCategories);

// get single category for user
categoryRouter.get('/:id', getSingleCategory);

// create category
categoryRouter.post('/:id', createCategory);

// update category
categoryRouter.patch('/:id', updateCategory);


// delete category
categoryRouter.delete('/:id', deleteCategory);

export default categoryRouter;