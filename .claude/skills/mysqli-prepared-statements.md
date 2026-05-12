# MySQLi Prepared Statements — WorldQuiz Reference

This project uses raw MySQLi (no PDO, no ORM). Every query that includes a variable must use a prepared statement.

## The pattern

```php
// 1. Prepare
$stmt = $conn->prepare("SELECT id, name FROM users WHERE email = ?");

// 2. Bind — type string: i=int, s=string, d=double, b=blob
$stmt->bind_param("s", $email);

// 3. Execute
$stmt->execute();

// 4. Get result (for SELECT)
$result = $stmt->get_result();
$row = $result->fetch_assoc();   // single row
// or
while ($row = $result->fetch_assoc()) { ... }  // multiple rows
```

## INSERT with auto-increment ID

```php
$stmt = $conn->prepare("INSERT INTO users (name, email, password, user_type) VALUES (?, ?, ?, ?)");
$stmt->bind_param("ssss", $name, $email, $hashed_password, $user_type);
$stmt->execute();
$new_id = $stmt->insert_id;  // get the generated ID
```

## UPDATE

```php
$stmt = $conn->prepare("UPDATE score SET star_tokens = star_tokens + ?, level = floor(star_tokens/100)+1 WHERE id = ?");
$stmt->bind_param("ii", $scoreChange, $user_id);
$stmt->execute();
```

## DELETE (the correct version — `delete_data.php` currently gets this wrong)

```php
// WRONG — SQL injection vulnerability
$sql = "DELETE FROM countries WHERE id=$id";
$conn->query($sql);

// CORRECT
$stmt = $conn->prepare("DELETE FROM countries WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
if ($stmt->affected_rows > 0) {
    header("Location: view_questions.php");
} else {
    die("Error deleting record.");
}
```

## Checking for errors

```php
if (!$stmt->execute()) {
    // Don't expose $conn->error to the browser in production
    error_log("Query failed: " . $stmt->error);
    die("A database error occurred.");
}
```

## Multiple bound parameters

```php
// bind_param type string must have one character per variable
$stmt = $conn->prepare(
    "INSERT INTO countries (country, img_path, hint, answer1, answer2, answer3, is_correct1, is_correct2, is_correct3)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
// s s s s s s  i  i  i  — 9 variables, 9 type chars
$stmt->bind_param("ssssssiii", $country, $img_path, $hint, $a1, $a2, $a3, $c1, $c2, $c3);
```

## What NOT to do

```php
// Never do this — SQL injection
$conn->query("SELECT * FROM users WHERE id = $user_id");
$conn->query("DELETE FROM users WHERE id=$_GET['delete']");
$conn->prepare("SELECT * FROM score WHERE id = $user_id"); // prepare doesn't protect string interpolation
```
