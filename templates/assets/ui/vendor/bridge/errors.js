export class BridgeError extends Error {
    code;
    details;
    constructor(code, message, details = {}, options) {
        super(message, options);
        this.name = 'BridgeError';
        this.code = code;
        this.details = details;
    }
}
