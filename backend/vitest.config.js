import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        setupFiles: ['tests/setup.js'],
        // The Neon test branch sometimes answers slowly; 15 s still shows a hung test
        testTimeout: 15000,
        hookTimeout: 15000,
    },
});
