import type { Request, Response, NextFunction } from 'express';
export declare function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function tokenAuth(validToken: string): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function sanitizeInput(input: string, maxLength?: number): string;
export declare function securityHeaders(req: Request, res: Response, next: NextFunction): void;
export declare function generateToken(length?: number): string;
