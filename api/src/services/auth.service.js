import mongoose from "mongoose";
import jwt from 'jsonwebtoken';
import bcrypt from "bcryptjs";
import User from '../models/user.model.js';
import Category from '../models/category.model.js';
import { JWT_ACCESS_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRY } from "../config/env.js";
import client from '../config/redis.js';

export const generateTokens = async (userId) => {
    const accessToken = jwt.sign({ userId: userId }, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
    const refreshToken = jwt.sign({ userId: userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });

    // redis client here
    // Store in redis container TTL for 7days
    await client.set(refreshToken, userId, 'EX', 7 * 24 * 60 * 60); // Expries after 7 days

    return { accessToken, refreshToken };
}

export const register = async ({ username, email, password }) => {

    const session = await mongoose.startSession();
    try{
        // valid username, password, and email
        session.startTransaction();

        const existingUser = await User.findOne({ email });
        if (existingUser){
            const error = new Error('User already exists');
            error.statusCode = 409;
            throw error;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [newUser] = await User.create([{ username, email, passwordHash: hashedPassword }], {session});
        const defaultCategory = await Category.create([{
            userId: newUser._id,
            name:'General',
            icon:'📁',
            color:'#1A56DB',
            isSystem:false
        }], {session});

        const { accessToken, refreshToken } = await generateTokens(newUser._id);

        await session.commitTransaction();
        return { user: newUser, accessToken, refreshToken };
    }
    catch(error){
        await session.abortTransaction();
        throw error;
    }

    finally{
        session.endSession();
    }
};

export const login = async ({ email, password }) => {
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user){
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }

    const checkPassword = await bcrypt.compare(password, user.passwordHash);
    if (!checkPassword){
        const error = new Error('Invalid Password');
        error.statusCode = 401;
        throw error;
    }

    const { accessToken, refreshToken } = await generateTokens(user._id);
    return { user, accessToken, refreshToken };
};

export const signOut = async ( userId ) => {

};