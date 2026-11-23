import { z } from 'zod';

// An id from the address, which always arrives as text. Postgres integers end at 2147483647
export const idParamsSchema = z.object({
    id: z.coerce.number().int().positive().max(2147483647),
});
