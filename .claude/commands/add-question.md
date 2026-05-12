---
description: Walk through adding a new quiz question to WorldQuiz correctly — validates the image path, constructs the correct SQL, and confirms only one answer is marked correct.
---

Add a new quiz question to the WorldQuiz `countries` table. Collect the following before writing any SQL:

1. **Country name** — e.g. `Japan`
2. **Image path** — must be relative to the project root, e.g. `Images/tokyo_tower.jpg`. Confirm the file exists in the `Images/` folder before proceeding.
3. **Hint** — a short clue that doesn't name the country directly
4. **Three answer options** — one correct, two plausible wrong answers
5. **Which answer is correct** — only one of `is_correct1`, `is_correct2`, `is_correct3` should be `1`; the others must be `0`

## Validation checklist before inserting

- [ ] Image file exists in `Images/`
- [ ] Exactly one `is_correct` value is `1`, the other two are `0`
- [ ] Hint does not directly state the answer
- [ ] All three answers are different

## Insert using `add_question.php` pattern (prepared statement)

```php
$stmt = $conn->prepare(
    "INSERT INTO countries (country, img_path, hint, answer1, answer2, answer3, is_correct1, is_correct2, is_correct3)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
$stmt->bind_param("sssssssii", $country, $img_path, $hint, $answer1, $answer2, $answer3, $is_correct1, $is_correct2, $is_correct3);
$stmt->execute();
```

Note: `is_correct1` and `is_correct2` are bound as strings in `add_question.php` — they should be integers. Flag this if it's still wrong.

After inserting, verify the row appears in `view_questions.php` and the image renders correctly in the quiz.
