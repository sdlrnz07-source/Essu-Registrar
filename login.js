import { supabase } from "./supabase.js";

const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");


// ============================================================
// SHOW / HIDE PASSWORD
// ============================================================

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


// ============================================================
// LOGIN
// ============================================================

document
    .getElementById("loginForm")
    .addEventListener("submit", async function (e) {

        e.preventDefault();


        const email =
            document
                .getElementById("email")
                .value
                .trim();


        const password =
            document
                .getElementById("password")
                .value;


        const emailError =
            document.getElementById("emailError");


        const passwordError =
            document.getElementById("passwordError");


        // Clear previous messages
        emailError.textContent = "";
        passwordError.textContent = "";


        // ====================================================
        // VALIDATION
        // ====================================================

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

            // ====================================================
            // ADMIN LOGIN
            // ====================================================

            if (
                email.toLowerCase() ===
                "essuadmin@edu.ph"
            ) {

                const {
                    data,
                    error
                } =
                    await supabase.functions.invoke(
                        "admin-login",
                        {
                            body: {
                                email: email,
                                password: password
                            }
                        }
                    );


                console.log(
                    "Admin login result:",
                    {
                        data,
                        error
                    }
                );


                if (
                    error ||
                    !data ||
                    !data.success ||
                    !data.token
                ) {

                    passwordError.textContent =
                        "Invalid email or password.";

                    return;
                }


                // ====================================================
                // STORE ADMIN SESSION
                // ====================================================

                sessionStorage.setItem(
                    "loggedIn",
                    "true"
                );


                sessionStorage.setItem(
                    "role",
                    "admin"
                );


                sessionStorage.setItem(
                    "adminEmail",
                    data.admin.email
                );


                sessionStorage.setItem(
                    "adminToken",
                    data.token
                );


                sessionStorage.setItem(
                    "adminTokenExpiresAt",
                    String(data.expiresAt)
                );


                // Remove old student session values
                sessionStorage.removeItem(
                    "studentId"
                );

                sessionStorage.removeItem(
                    "studentNumber"
                );

                sessionStorage.removeItem(
                    "userEmail"
                );


                // ====================================================
                // REDIRECT ADMIN
                // ====================================================

                window.location.replace(
                    "admin.html"
                );


                return;
            }



            // ====================================================
            // STUDENT LOGIN
            // ====================================================

            const {
                data,
                error
            } =
                await supabase.auth
                    .signInWithPassword({
                        email: email,
                        password: password
                    });


            if (error) {

                console.error(
                    "Student login error:",
                    error
                );


                passwordError.textContent =
                    "Invalid email or password.";

                return;
            }


            if (!data.user) {

                passwordError.textContent =
                    "Login failed. Please try again.";

                return;
            }


            // ====================================================
            // STORE STUDENT SESSION
            // ====================================================

            sessionStorage.setItem(
                "loggedIn",
                "true"
            );


            sessionStorage.setItem(
                "role",
                "student"
            );


            sessionStorage.setItem(
                "userEmail",
                data.user.email
            );


            // Remove any old admin session
            sessionStorage.removeItem(
                "adminEmail"
            );

            sessionStorage.removeItem(
                "adminToken"
            );

            sessionStorage.removeItem(
                "adminTokenExpiresAt"
            );


            // ====================================================
            // REDIRECT STUDENT
            // ====================================================

            window.location.replace(
                "student.html"
            );


        } catch (error) {

            console.error(
                "Unexpected login error:",
                error
            );


            passwordError.textContent =
                "Unable to login. Please try again.";
        }
    });