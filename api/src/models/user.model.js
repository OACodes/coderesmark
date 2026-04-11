import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username:{
        type: String,
        required: [true, 'Username is required'],
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [30, 'Username cannot exceed 30 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        unique: true,
        match: [/\S+@\S+\.\S+/, 'Please fill in a valid email address']
    },

    passwordHash: {
        type: String,
        required: [true, 'Password is required'],
        select: false // this is for security; ensures it returns this field in queries by default
    },

    settings: {
        defaultView: {
            type: String,
            enum: ['grid', 'list'],
            default: 'grid',
        },

        autoClassify:{
            type: Boolean,
            default: true,
        },
    },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;

