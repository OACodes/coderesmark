
export const validateCategoryInput = (body) => {
    const errors = [];

    if (!body.name) {
        errors.push('Category name is required');
    }
    if (body.name && typeof body.name !== 'string') {
        errors.push('Category name must be a string');
    }
    if (body.name && body.name.length > 50) {
        errors.push('Category name cannot exceed 50 characters');
    }
    if (body.icon && typeof body.icon !== 'string') {
        errors.push('Category icon must be a string');
    }
    if (body.color && typeof body.color !== 'string') {
        errors.push('Category color must be a string');
    }
    if (body.color && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
        errors.push('Category color must be valid hex format (e.g., #FF5733)');
    }
    return errors;
};