import mongoose from "mongoose";

const categorySchema  = mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    name:{
        type: String,
        required: true,
        trim: true,
        maxLength: [50, 'Category name cannot exceed 50 characters'],
    },
    icon:{
        type: String,
        default: '📁'
    },
    color:{
        type: String,
        default: '#1A56DB',
        match: [/^#[0-9A-Fa-f]{6}$/, 'Please provide a valid hex color'], // validates that it is a hex color
    },

    isSystem:{
        type: Boolean,
        default: false // category are user created
    }
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);

export default Category;