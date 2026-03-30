import express from 'express';
import connectToDatabase from './config/db.js';

const app = express();

// connect to database
connectToDatabase();

// express built in middlerware
// handles json data sent in requests and API Calls
app.use(express.json());
// helps process form data from html forms in simple format
app.use(express.urlencoded({ extended: false }));


app.get('/health', (req, res) => {
    res.send('CodeResMark Server is running!');
});

export default app;