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

    if (emailError) emailError.textContent = "";
    if (passwordError) passwordError.textContent = "";

    if (email === "") {
        if (emailError) emailError.textContent = "Email is required.";
        return;
    }

    if (password.length < 8) {
        if (passwordError) passwordError.textContent = "Password must be at least 8 characters.";
        return;
    }

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);

    fetch("login.php", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            sessionStorage.setItem("loggedIn", "true");
            sessionStorage.setItem("role", data.role);
            alert(data.message);

            if (data.role === "admin") {
                window.location.href = "admin.html";
            } else {
                window.location.href = "student.html";
            }
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("An error occurred during login.");
    });
});