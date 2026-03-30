import mongoose from 'mongoose';
import { MONGO_URI, NODE_ENV } from './env.js';

if (!MONGO_URI){
    throw new Error('PLEASE Define A MONGO_URI environment variable within env<development/production>.local');
}

const connectToDatabase = async () => {
    try{
        await mongoose.connect(MONGO_URI);
        console.log(`Conneted to database in ${NODE_ENV} mode`);
    }
    catch(error){
        console.error('Error connecting to database: ', error);
        process.exit(1); // ends process and tells it is a failure
    }
}

export default connectToDatabase;