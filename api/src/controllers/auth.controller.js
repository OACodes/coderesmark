import { login as loginService, register as registerService } from "../services/auth.service.js";

const login = async (req, res, next) => {
    try{
        const { user, accessToken, refreshToken } = await loginService(req.body);
        res.status(200).json({
            success: true,
            message: 'User logged in successfully!',
            data : {
                accessToken,
                user
            }
        });
    }catch(error){
        next(error);
    }
};


const register = async (req, res, next) => {
    try{
        const { user, accessToken, refreshToken } = await registerService(req.body);

        res.status(201).json({
            success: true,
            message: 'User registered successfully!',
            data : {
                accessToken,
                user
            }
        })
    }catch(error){
        next(error);
    }
};

export { login, register };