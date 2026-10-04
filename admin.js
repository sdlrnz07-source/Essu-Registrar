import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);


// ============================================================
// START
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    const allowed = checkAdminSession();

    if (!allowed) {
        return;
    }

    await loadAdminAppointments();
});


// ============================================================
// CHECK ADMIN SESSION
// ============================================================

function checkAdminSession() {

    const loggedIn =
        sessionStorage.getItem("loggedIn");

    const role =
        sessionStorage.getItem("role");

    const adminToken =
        sessionStorage.getItem("adminToken");

    const expiresAt =
        Number(
            sessionStorage.getItem(
                "adminTokenExpiresAt"
            )
        );


    if (
        loggedIn !== "true" ||
        role !== "admin" ||
        !adminToken
    ) {

        logoutAdmin(false);

        return false;
    }


    // Check expiration
    const now =
        Math.floor(Date.now() / 1000);


    if (
        !expiresAt ||
        expiresAt <= now
    ) {

        alert(
            "Your administrator session has expired. Please login again."
        );

        logoutAdmin(false);

        return false;
    }


    return true;
}


// ============================================================
// CALL ADMIN EDGE FUNCTION
// ============================================================

async function adminRequest(body) {

    const adminToken =
        sessionStorage.getItem(
            "adminToken"
        );


    if (!adminToken) {

        throw new Error(
            "Administrator session is missing."
        );
    }


    const {
        data,
        error
    } =
        await supabase.functions.invoke(
            "admin-appointments",
            {
                body: body,

                headers: {
                    "x-admin-token":
                        adminToken
                }
            }
        );


    if (error) {

        console.error(
            "Admin Edge Function error:",
            error
        );

        throw new Error(
            "Unable to communicate with the administrator service."
        );
    }


    if (
        !data ||
        data.error
    ) {

        throw new Error(
            data?.error ||
            "Administrator request failed."
        );
    }


    return data;
}


// ============================================================
// LOAD APPOINTMENTS
// ============================================================

async function loadAdminAppointments() {

    const tbody =
        $("adminAppointmentsBody");


    if (!tbody) {
        return;
    }


    tbody.innerHTML = `
        <tr>
            <td colspan="5"
                class="py-6 text-center text-gray-400">
                Loading appointments...
            </td>
        </tr>
    `;


    try {

        const result =
            await adminRequest({
                action: "list"
            });


        const appointments =
            result.appointments || [];


        const students =
            result.students || [];


        if (
            appointments.length === 0
        ) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="5"
                        class="py-6 text-center text-gray-400">
                        No appointments found.
                    </td>
                </tr>
            `;

            return;
        }


        tbody.innerHTML = "";


        appointments.forEach(
            (appointment) => {

                const student =
                    students.find(
                        (item) =>
                            item.id ===
                            appointment.student_id
                    );


                const studentName =
                    student
                        ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
                        : "Unknown Student";


                const studentNumber =
                    student?.student_number ||
                    "N/A";


                const status =
                    (
                        appointment.status ||
                        "pending"
                    ).toLowerCase();


                const row =
                    document.createElement(
                        "tr"
                    );


                row.className =
                    "border-b border-gray-200";


                row.innerHTML = `
                    <td class="py-4 px-4">
                        <div class="font-semibold text-gray-800">
                            ${escapeHTML(studentName)}
                        </div>

                        <div class="text-sm text-gray-500">
                            ${escapeHTML(studentNumber)}
                        </div>
                    </td>

                    <td class="py-4 px-4 text-gray-700">
                        ${escapeHTML(
                            appointment.purpose ||
                            ""
                        )}
                    </td>

                    <td class="py-4 px-4 text-gray-700">
                        <div>
                            ${formatDate(
                                appointment.appointment_date
                            )}
                        </div>

                        <div class="text-sm text-gray-500">
                            ${escapeHTML(
                                appointment.appointment_time ||
                                ""
                            )}
                        </div>
                    </td>

                    <td class="py-4 px-4">
                        ${statusBadge(status)}
                    </td>

                    <td class="py-4 px-4 text-right">
                        ${actionButtons(
                            appointment.id,
                            status
                        )}
                    </td>
                `;


                tbody.appendChild(
                    row
                );
            }
        );


        attachActionButtons();


    } catch (error) {

        console.error(
            "Load appointments error:",
            error
        );


        tbody.innerHTML = `
            <tr>
                <td colspan="5"
                    class="py-6 text-center text-red-500">
                    ${escapeHTML(
                        error.message ||
                        "Unable to load appointments."
                    )}
                </td>
            </tr>
        `;


        if (
            String(error.message)
                .toLowerCase()
                .includes("unauthorized")
        ) {

            alert(
                "Your administrator session is no longer valid. Please login again."
            );

            logoutAdmin(false);
        }
    }
}


// ============================================================
// STATUS BADGE
// ============================================================

function statusBadge(status) {

    if (status === "approved") {

        return `
            <span
                class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                Approved
            </span>
        `;
    }


    if (status === "rejected") {

        return `
            <span
                class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                Rejected
            </span>
        `;
    }


    if (status === "cancelled") {

        return `
            <span
                class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
                Cancelled
            </span>
        `;
    }


    return `
        <span
            class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
            Pending
        </span>
    `;
}


// ============================================================
// ACTION BUTTONS
// ============================================================

function actionButtons(
    appointmentId,
    status
) {

    const approveDisabled =
        status === "approved";


    const rejectDisabled =
        status === "rejected";


    return `
        <div class="flex justify-end gap-2">

            <button
                class="approveBtn bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-id="${appointmentId}"
                ${approveDisabled
                    ? "disabled"
                    : ""}
            >
                Approve
            </button>


            <button
                class="rejectBtn bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-id="${appointmentId}"
                ${rejectDisabled
                    ? "disabled"
                    : ""}
            >
                Reject
            </button>

        </div>
    `;
}


// ============================================================
// ATTACH BUTTON EVENTS
// ============================================================

function attachActionButtons() {

    document
        .querySelectorAll(
            ".approveBtn"
        )
        .forEach((button) => {

            button.addEventListener(
                "click",
                async function () {

                    await updateAppointmentStatus(
                        this.dataset.id,
                        "approved"
                    );
                }
            );
        });


    document
        .querySelectorAll(
            ".rejectBtn"
        )
        .forEach((button) => {

            button.addEventListener(
                "click",
                async function () {

                    await updateAppointmentStatus(
                        this.dataset.id,
                        "rejected"
                    );
                }
            );
        });
}


// ============================================================
// UPDATE STATUS
// ============================================================

async function updateAppointmentStatus(
    appointmentId,
    newStatus
) {

    const readableStatus =
        newStatus.charAt(0).toUpperCase() +
        newStatus.slice(1);


    const confirmed =
        confirm(
            `Are you sure you want to ${newStatus} this appointment?`
        );


    if (!confirmed) {
        return;
    }


    try {

        // ====================================================
        // ADMIN EDGE FUNCTION
        // Updates appointment
        // Creates history
        // Creates notification
        // ====================================================

        const result =
            await adminRequest({

                action:
                    "updateStatus",

                appointmentId:
                    appointmentId,

                status:
                    newStatus
            });


        console.log(
            "Appointment update result:",
            result
        );


        // ====================================================
        // SEND EMAIL
        // ====================================================

        let emailSent = false;


        try {

            const appointment =
                result.appointment;


            const student =
                result.student;


            if (
                appointment &&
                student &&
                student.email
            ) {

                const studentName =
                    `${student.first_name || ""} ${student.last_name || ""}`
                        .trim();


                const {
                    data: emailResult,
                    error: emailError
                } =
                    await supabase.functions.invoke(
                        "send-appointment-email",
                        {
                            body: {

                                email:
                                    student.email,

                                studentName:
                                    studentName ||
                                    "Student",

                                status:
                                    newStatus,

                                purpose:
                                    appointment.purpose,

                                appointmentDate:
                                    appointment.appointment_date,

                                appointmentTime:
                                    appointment.appointment_time
                            }
                        }
                    );


                if (emailError) {

                    console.error(
                        "Email error:",
                        emailError
                    );

                } else {

                    console.log(
                        "Email result:",
                        emailResult
                    );

                    emailSent = true;
                }
            }

        } catch (emailError) {

            console.error(
                "Email notification failed:",
                emailError
            );
        }


        // ====================================================
        // REFRESH TABLE
        // ====================================================

        await loadAdminAppointments();


        if (emailSent) {

            alert(
                `Appointment ${readableStatus} successfully.\n\nStudent notification and email were sent.`
            );

        } else {

            alert(
                `Appointment ${readableStatus} successfully.\n\nThe in-app notification was created, but the email could not be confirmed.`
            );
        }


    } catch (error) {

        console.error(
            "Update appointment error:",
            error
        );


        alert(
            error.message ||
            "Unable to update appointment."
        );


        if (
            String(error.message)
                .toLowerCase()
                .includes("unauthorized")
        ) {

            logoutAdmin(false);
        }
    }
}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return dateString;
    }


    return date.toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// LOGOUT
// ============================================================

async function logoutAdmin(
    redirect = true
) {

    try {

        // Clear any Supabase student session
        await supabase.auth.signOut();

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );
    }


    sessionStorage.clear();


    if (redirect) {

        window.location.href =
            "login.html";

    } else {

        window.location.href =
            "login.html";
    }
}


// ============================================================
// LOGOUT BUTTON
// ============================================================

const logoutButton =
    $("adminLogoutBtn");


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            await logoutAdmin();
        }
    );
}