import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        setupFiles: ['tests/setup.js'],
        // One file at a time: a round picks from every question on the test branch, so a file
        // adding questions must not run beside one playing rounds
        fileParallelism: false,
        // The Neon test branch sometimes answers slowly; 15 s still shows a hung test
        testTimeout: 15000,
        hookTimeout: 15000,
    },
});
