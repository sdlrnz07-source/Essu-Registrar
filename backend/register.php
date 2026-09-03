<?php

header("Access-Control-Allow-Origin: https://essuregistrarappointment.netlify.app");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

header("Content-Type: application/json");

require_once "db.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid request method."
    ]);
    exit;
}

$firstName = trim($_POST["firstName"] ?? "");
$lastName = trim($_POST["lastName"] ?? "");
$studentNumber = trim($_POST["studentNumber"] ?? "");
$email = trim($_POST["email"] ?? "");
$password = $_POST["password"] ?? "";

if (
    empty($firstName) ||
    empty($lastName) ||
    empty($studentNumber) ||
    empty($email) ||
    empty($password)
) {
    echo json_encode([
        "status" => "error",
        "message" => "Please fill in all fields."
    ]);
    exit;
}

$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

$sql = "INSERT INTO students 
        (student_number, first_name, last_name, email, password)
        VALUES (?, ?, ?, ?, ?)";

$stmt = $conn->prepare($sql);

if (!$stmt) {
    echo json_encode([
        "status" => "error",
        "message" => "Database error."
    ]);
    exit;
}

$stmt->bind_param(
    "sssss",
    $studentNumber,
    $firstName,
    $lastName,
    $email,
    $hashedPassword
);

if ($stmt->execute()) {
    echo json_encode([
        "status" => "success",
        "message" => "Registration successful!"
    ]);
} else {
    if ($conn->errno === 1062) {
        echo json_encode([
            "status" => "error",
            "message" => "Student number or email already exists."
        ]);
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "Registration failed."
        ]);
    }
}

$stmt->close();
$conn->close();

?>