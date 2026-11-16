// Turns rows read from the MySQL wq_db database into rows for Neon

// The number of the right answer, 1 to 3. The MySQL row has three flags, so this checks exactly one is set
export function correctAnswerOf(row) {
    const flags = [row.is_correct1, row.is_correct2, row.is_correct3].map(Number);
    const count = flags.filter((flag) => flag === 1).length;
    if (count !== 1) {
        throw new Error(`Question ${row.id} has ${count} correct answers`);
    }
    return flags.indexOf(1) + 1;
}

// Cloudinary's name for a question's photo, e.g. 'brazil-q1': the country, then the q-number in the file name
export function imagePublicId(country, imgPath) {
    const match = /\/(q\d+)-[^/]*$/.exec(imgPath);
    if (!match) {
        throw new Error(`No question number in ${imgPath}`);
    }
    const countrySlug = country.trim().toLowerCase().replace(/\s+/g, '-');
    return `${countrySlug}-${match[1]}`;
}

// A Neon question row, given the country's new id and the photo's Cloudinary address and name
export function toQuestion(row, countryId, photo) {
    return {
        countryId,
        imageUrl: photo.url,
        cloudinaryId: photo.publicId,
        question: row.question,
        hint: row.hint,
        answer1: row.answer1,
        answer2: row.answer2,
        answer3: row.answer3,
        correctAnswer: correctAnswerOf(row),
    };
}
