import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { notFound, errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.routes.js';
import authRouter from './routes/auth.routes.js';
import roundsRouter from './routes/rounds.routes.js';
import adminQuestionsRouter from './routes/adminQuestions.routes.js';
import adminCountriesRouter from './routes/adminCountries.routes.js';
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
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/rounds', roundsRouter);
app.use('/api/v1/admin/questions', adminQuestionsRouter);
app.use('/api/v1/admin/countries', adminCountriesRouter);

// Both last: notFound catches every address no router answered, and errorHandler catches
// everything thrown above it
app.use(notFound);
app.use(errorHandler);

export default app;
