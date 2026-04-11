import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // allows indexing user field
    },
    url:{
        type: String,
        required: true,
    },
    urlHash:{
        type: String,
        required: true,
        unique: true, // SHA-256(userId + url) — prevents duplicates at DB level
    },
    title:{
        type: String,
        trim: true
    },
    favicon:{ // cached copy of the website's small icon
        type: String,
    },
    category:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
    },
    tags:{
        type: [String], // each bookmark has many tages
        default: [],
    },
    
    aiMetadata:{
        purpose: String, // E.g. "React sate management library"
        languages: [String],
        difficulty: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced'],
        },

        summary: String, // brief AI generated description
        classifiedAt: Date,
        confidence: {
            type: Number,
            min: 0,
            max: 1
        }
    },

    status: {
        type: String,
        enum: ['pending', 'classified', 'failed', 'needs-review'],
        default: 'pending', // always starts as pending until the AI has classified it
    },
}, { timestamps: true });

// Compound index — speeds up the most common query: "get all bookmarks for this user with this status"
bookmarkSchema.index({ userId: 1, status: 1 });

// Text index — powers full text search across title, summary and tags
bookmarkSchema.index({ title: 'text', 'aiMetadata.summary': 'text', tags: 'text' });


const Bookmark = mongoose.model('Bookmark', bookmarkSchema);
export default Bookmark;