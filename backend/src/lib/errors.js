// An error the client is meant to see: the error handler sends its status and message as they
// are. Anything else that's thrown becomes a plain 500
export class AppError extends Error {
    constructor(status, message, details) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.details = details;
    }
}

// An error shown under one form field, `field` being the body's name for it
export function fieldError(status, field, message) {
    return new AppError(status, message, [{ path: `body.${field}`, message }]);
}

// A broken UNIQUE rule. Drizzle keeps Postgres's own error on `cause`
export const isUniqueViolation = (error) => (error.code ?? error.cause?.code) === '23505';

// A delete refused by ON DELETE RESTRICT: another table still uses the row
export const isRestrictViolation = (error) => (error.code ?? error.cause?.code) === '23001';
