import { Router } from 'express';
import { getAllUserCategories, getSingleCategory, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller.js';
import verifyJWT from '../middleware/auth.middleware.js';

const categoryRouter = Router();

// Apply authentication middleware to all routes
categoryRouter.use(verifyJWT);

// Get all user categories
categoryRouter.get('/', getAllUserCategories);

// Get single category for user
categoryRouter.get('/details/:id', getSingleCategory);

// Create category
categoryRouter.post('/', createCategory);

// Update category
categoryRouter.patch('/:id', updateCategory);

// Delete category
categoryRouter.delete('/:id', deleteCategory);

export default categoryRouter;