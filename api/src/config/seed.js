import Category from '../models/category.model.js';

// Seeding Categories:
// pre-populating your database with data that needs to exist before your app can work properly.

const seedSystemCategories = async () => {
    try{
        // Check if a system category already exist
        const SysCategoryExists = await Category.findOne({ isSystem: true });

        if (!SysCategoryExists){
            await Category.create({
                name: 'Uncategorized',
                icon: '📁',
                color: '#1A56DB',
                isSystem: true,
            });
            console.log('System categories seeded');

        }else{
            console.log('System categories already exists');
        }

    }
    catch(error){
        console.error('Error when seeing system categories: ', error);
    }
}

export default seedSystemCategories;