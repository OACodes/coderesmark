export class AppError extends Error {
    constructor(message, statusCode, code){
        if (typeof(message) !== "string"){
            throw new Error(`AppError: message must be a string, you have ${typeof message}`);
        }
        if (typeof(statusCode) !== "number" || statusCode < 100 || statusCode > 599){
            throw new Error(`AppError: statusCode must be a number between 100-599, you have ${statusCode}`);
        }
        if (typeof(code) !== "string"){
            throw new Error(`AppError: code must be a string, got ${typeof code}`);
        }
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor); // Capture stack trace - shows where AppError was THROWN, not constructed
    }
}