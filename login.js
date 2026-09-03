import { supabase } from "./supabase.js";

const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

// Show / hide password
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


// LOGIN
document.getElementById("loginForm").addEventListener("submit", async function (e) {

    e.preventDefault();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const emailError =
        document.getElementById("emailError");

    const passwordError =
        document.getElementById("passwordError");


    // Clear previous errors
    emailError.textContent = "";
    passwordError.textContent = "";


    // Validation
    if (email === "") {

        emailError.textContent =
            "Email is required.";

        return;
    }


    if (password === "") {

        passwordError.textContent =
            "Password is required.";

        return;
    }


    if (password.length < 8) {

        passwordError.textContent =
            "Password must be at least 8 characters.";

        return;
    }


    try {

        // Ask Supabase to verify the email and password
        const { data, error } =
            await supabase.auth.signInWithPassword({

                email: email,

                password: password

            });


        // Supabase rejected the login
        if (error) {

            console.error("Login error:", error);

            passwordError.textContent =
                "Invalid email or password.";

            return;
        }


        // Make sure Supabase actually returned a user
        if (!data.user) {

            passwordError.textContent =
                "Login failed. Please try again.";

            return;
        }


        // Save login information
        sessionStorage.setItem(
            "loggedIn",
            "true"
        );

        sessionStorage.setItem(
            "userEmail",
            data.user.email
        );


        // Admin account
        if (
            data.user.email.toLowerCase() ===
            "admin@essu.edu.ph"
        ) {

            sessionStorage.setItem(
                "role",
                "admin"
            );

            alert("Admin Login Successful!");

            window.location.href =
                "admin.html";

            return;
        }


        // Student account
        sessionStorage.setItem(
            "role",
            "student"
        );

        alert("Student Login Successful!");

        window.location.href =
            "student.html";


    } catch (error) {

        console.error(
            "Unexpected login error:",
            error
        );

        passwordError.textContent =
            "Unable to login. Please try again.";

    }

});