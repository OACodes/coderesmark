// this middleware intercepts the error and finds out more information about that error

const errorMiddleware = (err, req, res, next) => {
    try{
        const statusCode = err.statusCode || 500;
        
        res.status(statusCode).json({
            success: false,
            message: err.message || 'Internal Server Error',
        });
    }catch(error){
        next(error);
    }
};

export default errorMiddleware;