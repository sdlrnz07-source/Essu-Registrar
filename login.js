const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function () {

        const type =
            passwordInput.getAttribute("type") === "password"
                ? "text"
                : "password";

        passwordInput.setAttribute("type", type);

        const icon = this.querySelector("i");

        if (icon) {
            icon.classList.toggle("fa-eye");
            icon.classList.toggle("fa-eye-slash");
        }
    });
}


document.getElementById("loginForm").addEventListener("submit", function (e) {

    e.preventDefault();

    const identifier = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const emailError = document.getElementById("emailError");
    const passwordError = document.getElementById("passwordError");

    emailError.textContent = "";
    passwordError.textContent = "";


    // Validate identifier
    if (identifier === "") {
        emailError.textContent = "Email or Admin Username is required.";
        return;
    }


    // Validate password
    if (password.length < 8) {
        passwordError.textContent = "Password must be at least 8 characters.";
        return;
    }


    // Create form data
    const formData = new FormData();

    formData.append("email", identifier);
    formData.append("password", password);


    // Send login request to PHP backend
    fetch("https://essuregistrar.free.nf/login.php", {
        method: "POST",
        body: formData
    })

    .then(response => response.json())

    .then(data => {

        if (data.status === "success") {

            // Save login information
            sessionStorage.setItem("loggedIn", "true");
            sessionStorage.setItem("role", data.role);


            // Student login
            if (data.role === "student") {

                sessionStorage.setItem(
                    "studentId",
                    data.student.id
                );

                sessionStorage.setItem(
                    "studentNumber",
                    data.student.student_number
                );

                sessionStorage.setItem(
                    "studentName",
                    data.student.first_name + " " + data.student.last_name
                );

                sessionStorage.setItem(
                    "studentEmail",
                    data.student.email
                );

                alert("Student Login Successful!");

                window.location.href = "student.html";
            }


            // Admin login
            else if (data.role === "admin") {

                sessionStorage.setItem(
                    "adminId",
                    data.admin.id
                );

                sessionStorage.setItem(
                    "adminUsername",
                    data.admin.username
                );

                alert("Admin Login Successful!");

                window.location.href = "admin.html";
            }

        } else {

            // Login failed
            alert(data.message || "Invalid email/username or password.");

        }

    })

    .catch(error => {

        console.error("Login Error:", error);

        alert(
            "Unable to connect to the server. Please try again later."
        );

    });

});