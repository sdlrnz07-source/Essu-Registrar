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

$identifier = trim($_POST["email"] ?? "");
$password = $_POST["password"] ?? "";

if (empty($identifier) || empty($password)) {
    echo json_encode([
        "status" => "error",
        "message" => "Please enter your email/username and password."
    ]);
    exit;
}


/*
 * ==========================================
 * CHECK STUDENT LOGIN
 * ==========================================
 */

$sql = "SELECT id, student_number, first_name, last_name, email, password
        FROM students
        WHERE email = ?
        LIMIT 1";

$stmt = $conn->prepare($sql);

if (!$stmt) {
    echo json_encode([
        "status" => "error",
        "message" => "Database error."
    ]);
    exit;
}

$stmt->bind_param("s", $identifier);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows === 1) {

    $student = $result->fetch_assoc();

    if (password_verify($password, $student["password"])) {

        echo json_encode([
            "status" => "success",
            "role" => "student",
            "message" => "Student login successful!",
            "student" => [
                "id" => $student["id"],
                "student_number" => $student["student_number"],
                "first_name" => $student["first_name"],
                "last_name" => $student["last_name"],
                "email" => $student["email"]
            ]
        ]);

        $stmt->close();
        $conn->close();
        exit;
    }
}

$stmt->close();


/*
 * ==========================================
 * CHECK ADMIN LOGIN
 * ==========================================
 */

$sql = "SELECT id, username, password
        FROM admins
        WHERE username = ?
        LIMIT 1";

$stmt = $conn->prepare($sql);

if (!$stmt) {
    echo json_encode([
        "status" => "error",
        "message" => "Database error."
    ]);
    exit;
}

$stmt->bind_param("s", $identifier);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows === 1) {

    $admin = $result->fetch_assoc();

    if (password_verify($password, $admin["password"])) {

        echo json_encode([
            "status" => "success",
            "role" => "admin",
            "message" => "Admin login successful!",
            "admin" => [
                "id" => $admin["id"],
                "username" => $admin["username"]
            ]
        ]);

        $stmt->close();
        $conn->close();
        exit;
    }
}

$stmt->close();
$conn->close();


/*
 * ==========================================
 * INVALID LOGIN
 * ==========================================
 */

echo json_encode([
    "status" => "error",
    "message" => "Invalid email/username or password."
]);

?>