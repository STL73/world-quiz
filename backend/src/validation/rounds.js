import { z } from 'zod';

const CHOICE_MESSAGE = 'Choose answer 1, 2 or 3.';

// The button the player pressed, counted from the left as the answers are shown
export const answerSchema = z.object({
    choice: z.int({ error: CHOICE_MESSAGE }).min(1, CHOICE_MESSAGE).max(3, CHOICE_MESSAGE),
});

// A round id from the address
export { idParamsSchema as roundParamsSchema } from './common.js';
