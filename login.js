const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");  

if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function () {
        const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
        passwordInput.setAttribute("type", type);
        
        const icon = this.querySelector("i");
        if (icon) {
            icon.classList.toggle("fa-eye");
            icon.classList.toggle("fa-eye-slash");
        }
    });
}

document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const emailError = document.getElementById("emailError");
    const passwordError = document.getElementById("passwordError");

    emailError.textContent = "";
    passwordError.textContent = "";

    if (email === "") {
        emailError.textContent = "Email is required.";
        return;
    }

    if (password.length < 8) {
        passwordError.textContent = "Password must be at least 8 characters.";
        return;
    }

    if (email === "admin@essu.edu.ph" && password === "admin123") {
        sessionStorage.setItem("loggedIn", "true");
        sessionStorage.setItem("role", "admin");
        alert("Admin Login Successful!");
        window.location.href = "admin.html";
    } else if (email === "student@gmail.com" && password === "student123") {
        sessionStorage.setItem("loggedIn", "true");
        sessionStorage.setItem("role", "student");
        alert("Student Login Successful!");
        window.location.href = "student.html";
    } else if (email.toLowerCase().includes("admin")) {
        sessionStorage.setItem("loggedIn", "true");
        sessionStorage.setItem("role", "admin");
        alert("Admin Login Successful!");
        window.location.href = "admin.html";
    } else {
        sessionStorage.setItem("loggedIn", "true");
        sessionStorage.setItem("role", "student");
        alert("Student Login Successful!");
        window.location.href = "student.html";
    }
});