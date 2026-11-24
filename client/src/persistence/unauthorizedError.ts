// Thrown by a repository when the server says nobody is signed in: the session ended or expired.
export class UnauthorizedError extends Error {
    constructor() {
        super('Your session has ended. Sign in again to keep saving to your account.');
        this.name = 'UnauthorizedError';
    }
}