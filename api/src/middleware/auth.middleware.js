import jwt from 'jsonwebtoken';
import { JWT_ACCESS_SECRET } from '../config/env.js';

const verifyJWT = (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization;
    try{
        if (authHeader && authHeader.startsWith('Bearer')){
            token = authHeader.split(' ')[1];
        }

        if (!token){
            return res.status(401).json({ message: 'Unauthorized by token'});
        }

        const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
        req.user = { userId: decoded.userId };
        next();

    }catch(error){
        res.status(401).json({ message: 'Unauthorized', error: error.message });
    }
}

export default verifyJWT;