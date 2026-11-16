import { describe, it, expect } from 'vitest';

import { correctAnswerOf, imagePublicId, toQuestion } from '../scripts/transform.js';

// Question 1 exactly as mysql2 returns it from wq_db: the flags are numbers
const brazilQ1 = {
    id: 1,
    country: 'Brazil',
    img_path: 'Images/Brasil/q1-jesus christ statue in rio.jpg',
    question: 'Which statue is this?',
    hint: 'Arms outstretched from a mountain peak, overlooking a famous bay city.',
    answer1: 'Jesus Christ in Bolivia',
    is_correct1: 0,
    answer2: 'Jesus Christ in Rio',
    is_correct2: 1,
    answer3: 'Jesus Christ in Portugal',
    is_correct3: 0,
};

describe('correctAnswerOf', () => {
    it('turns three flags into the number of the right answer', () => {
        expect(correctAnswerOf(brazilQ1)).toBe(2);
    });

    it('refuses a question with two right answers', () => {
        expect(() => correctAnswerOf({ ...brazilQ1, is_correct1: 1 })).toThrow('Question 1 has 2 correct answers');
    });

    it('refuses a question with no right answer', () => {
        expect(() => correctAnswerOf({ ...brazilQ1, is_correct2: 0 })).toThrow('Question 1 has 0 correct answers');
    });
});

describe('imagePublicId', () => {
    it('names a photo after its country and question number', () => {
        expect(imagePublicId('Brazil', brazilQ1.img_path)).toBe('brazil-q1');
    });

    it('turns spaces in a country name into hyphens', () => {
        expect(imagePublicId('United Kingdom', 'Images/United Kingdom/q4-big ben.jpg')).toBe('united-kingdom-q4');
    });

    it('refuses a file name without a question number', () => {
        expect(() => imagePublicId('Brazil', 'Images/Brasil/rio.jpg')).toThrow('No question number in Images/Brasil/rio.jpg');
    });
});

describe('toQuestion', () => {
    it('builds a Neon question row from a MySQL row, a country id and an uploaded photo', () => {
        const photo = { url: 'https://res.cloudinary.com/demo/image/upload/v1/brazil-q1', publicId: 'world-quiz/development/questions/brazil-q1' };
        expect(toQuestion(brazilQ1, 7, photo)).toEqual({
            countryId: 7,
            imageUrl: photo.url,
            cloudinaryId: photo.publicId,
            question: 'Which statue is this?',
            hint: 'Arms outstretched from a mountain peak, overlooking a famous bay city.',
            answer1: 'Jesus Christ in Bolivia',
            answer2: 'Jesus Christ in Rio',
            answer3: 'Jesus Christ in Portugal',
            correctAnswer: 2,
        });
    });
});
