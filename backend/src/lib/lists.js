// Search text for ILIKE, found anywhere in the column. LIKE's own wildcards are escaped, so a
// typed % or _ matches only itself
export const containsPattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

// The page details every list answers with
export const pagination = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
