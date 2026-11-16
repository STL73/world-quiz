import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { notFound, errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.routes.js';
import { securityMiddleware } from './middleware/security.js';

// The app without app.listen(), so tests can send it requests without a port
const app = express();

app.use(helmet());
// Before the body is parsed: a blocked request costs as little as possible
app.use(securityMiddleware);
app.use(express.json());
// Fills req.cookies, where the session check will find the session cookie
app.use(cookieParser());

app.use('/api/v1/health', healthRouter);

// Both last: notFound catches every address no router answered, and errorHandler catches
// everything thrown above it
app.use(notFound);
app.use(errorHandler);

export default app;
