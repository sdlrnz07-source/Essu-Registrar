<?php
include 'db.php';
header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if (empty($email) || empty($password)) {
        echo json_encode(["status" => "error", "message" => "All fields are required."]);
        exit;
    }

    // 1. Check if user is an admin
    $stmt = $conn->prepare("SELECT id, username, password FROM admins WHERE username = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        if (password_verify($password, $row['password'])) {
            echo json_encode([
                "status" => "success", 
                "role" => "admin", 
                "message" => "Admin Login Successful!"
            ]);
            $stmt->close();
            $conn->close();
            exit;
        }
    }
    $stmt->close();

    // 2. Standard student check
    $stmt = $conn->prepare("SELECT id, first_name, password FROM students WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        if (password_verify($password, $row['password'])) {
            echo json_encode([
                "status" => "success", 
                "role" => "student", 
                "message" => "Student Login Successful!"
            ]);
            $stmt->close();
            $conn->close();
            exit;
        }
    }

    echo json_encode(["status" => "error", "message" => "Invalid email or password."]);
    $stmt->close();
    $conn->close();
}
?>