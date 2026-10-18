import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);


// ============================================================
// STATE
// ============================================================

const state = {
    appointments: [],
    students: [],
    schedules: [],
    history: []
};


// ============================================================
// START
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const allowed =
            checkAdminSession();

        if (!allowed) {
            return;
        }


        setupTabs();
        setupAppointmentFilters();
        setupScheduleEvents();
        setupDailyListEvents();
        setupReportEvents();
        setupHistoryEvents();
        setupRescheduleEvents();


        setDefaultDates();


        await loadAdminAppointments();
    }
);


// ============================================================
// ADMIN SESSION
// ============================================================

function checkAdminSession() {

    const loggedIn =
        sessionStorage.getItem(
            "loggedIn"
        );

    const role =
        sessionStorage.getItem(
            "role"
        );

    const adminToken =
        sessionStorage.getItem(
            "adminToken"
        );

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


    const now =
        Math.floor(
            Date.now() / 1000
        );


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
// ADMIN EDGE FUNCTION REQUEST
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
                body,

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
// DEFAULT DATES
// ============================================================

function setDefaultDates() {

    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    if ($("scheduleDate")) {
        $("scheduleDate").value =
            today;
    }


    if ($("dailyAppointmentDate")) {
        $("dailyAppointmentDate").value =
            today;
    }


    if ($("reportEndDate")) {
        $("reportEndDate").value =
            today;
    }


    if ($("reportStartDate")) {

        const currentDate =
            new Date();

        const firstDayOfMonth =
            `${currentDate.getFullYear()}-${String(
                currentDate.getMonth() + 1
            ).padStart(2, "0")}-01`;

        $("reportStartDate").value =
            firstDayOfMonth;
    }


    if ($("rescheduleDate")) {
        $("rescheduleDate").min =
            today;
    }
}


// ============================================================
// TABS
// ============================================================

function setupTabs() {

    const buttons =
        document.querySelectorAll(
            ".adminTabButton"
        );


    buttons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                async () => {

                    const tab =
                        button.dataset.tab;


                    switchTab(
                        tab
                    );


                    if (
                        tab ===
                        "schedules"
                    ) {

                        await loadRegistrarSchedules();
                    }


                    if (
                        tab ===
                        "daily"
                    ) {

                        await generateDailyList();
                    }


                    if (
                        tab ===
                        "reports"
                    ) {

                        generateReport();
                    }


                    if (
                        tab ===
                        "history"
                    ) {

                        await loadHistoryLogs();
                    }
                }
            );
        }
    );
}


function switchTab(tabName) {

    const tabMap = {
        appointments:
            "tabAppointments",

        schedules:
            "tabSchedules",

        daily:
            "tabDaily",

        reports:
            "tabReports",

        history:
            "tabHistory"
    };


    Object
        .values(tabMap)
        .forEach(
            (id) => {

                const section =
                    $(id);

                if (section) {
                    section.classList.add(
                        "hidden"
                    );
                }
            }
        );


    const selected =
        $(tabMap[tabName]);


    if (selected) {

        selected.classList.remove(
            "hidden"
        );
    }


    document
        .querySelectorAll(
            ".adminTabButton"
        )
        .forEach(
            (button) => {

                const active =
                    button.dataset.tab ===
                    tabName;


                button.className =
                    active
                        ? "adminTabButton bg-[#0f4c2e] text-white px-4 py-2 rounded text-sm font-semibold"
                        : "adminTabButton bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm font-semibold hover:bg-gray-200";
            }
        );
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
            <td
                colspan="6"
                class="py-6 text-center text-gray-400"
            >
                Loading appointments...
            </td>
        </tr>
    `;


    try {

        const result =
            await adminRequest({
                action:
                    "list"
            });


        state.appointments =
            result.appointments ||
            [];


        state.students =
            result.students ||
            [];


        renderStatistics();
        renderAppointments();


    } catch (error) {

        console.error(
            "Load appointments error:",
            error
        );


        tbody.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="py-6 text-center text-red-500"
                >
                    ${escapeHTML(
                        error.message ||
                        "Unable to load appointments."
                    )}
                </td>
            </tr>
        `;


        handleUnauthorized(
            error
        );
    }
}


// ============================================================
// STATISTICS
// ============================================================

function renderStatistics() {

    const appointments =
        state.appointments;


    const countStatus =
        (status) =>
            appointments.filter(
                (appointment) =>
                    String(
                        appointment.status ||
                        "pending"
                    )
                        .toLowerCase() ===
                    status
            ).length;


    if ($("statTotal")) {

        $("statTotal").textContent =
            appointments.length;
    }


    if ($("statPending")) {

        $("statPending").textContent =
            countStatus(
                "pending"
            );
    }


    if ($("statApproved")) {

        $("statApproved").textContent =
            countStatus(
                "approved"
            );
    }


    if ($("statRescheduled")) {

        $("statRescheduled").textContent =
            countStatus(
                "rescheduled"
            );
    }


    if ($("statRejected")) {

        $("statRejected").textContent =
            countStatus(
                "rejected"
            );
    }
}


// ============================================================
// SEARCH / FILTER
// ============================================================

function setupAppointmentFilters() {

    const search =
        $("appointmentSearch");

    const statusFilter =
        $("appointmentStatusFilter");

    const dateFilter =
        $("appointmentDateFilter");

    const clearButton =
        $("clearAppointmentFiltersBtn");


    if (search) {

        search.addEventListener(
            "input",
            renderAppointments
        );
    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            renderAppointments
        );
    }


    if (dateFilter) {

        dateFilter.addEventListener(
            "change",
            renderAppointments
        );
    }


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            () => {

                if (search) {
                    search.value = "";
                }


                if (statusFilter) {
                    statusFilter.value =
                        "all";
                }


                if (dateFilter) {
                    dateFilter.value =
                        "";
                }


                renderAppointments();
            }
        );
    }
}


// ============================================================
// RENDER APPOINTMENTS
// ============================================================

function renderAppointments() {

    const tbody =
        $("adminAppointmentsBody");


    if (!tbody) {
        return;
    }


    const search =
        (
            $("appointmentSearch")
                ?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    const statusFilter =
        (
            $("appointmentStatusFilter")
                ?.value ||
            "all"
        )
            .toLowerCase();


    const dateFilter =
        $("appointmentDateFilter")
            ?.value ||
        "";


    const filtered =
        state.appointments
            .filter(
                (appointment) => {

                    const student =
                        getStudentForAppointment(
                            appointment
                        );


                    const studentName =
                        student
                            ? `${student.first_name || ""} ${student.last_name || ""}`
                                .trim()
                                .toLowerCase()
                            : "";


                    const studentNumber =
                        String(
                            student?.student_number ||
                            ""
                        )
                            .toLowerCase();


                    const email =
                        String(
                            student?.email ||
                            ""
                        )
                            .toLowerCase();


                    const purpose =
                        String(
                            appointment.purpose ||
                            ""
                        )
                            .toLowerCase();


                    const notes =
                        String(
                            appointment.notes ||
                            ""
                        )
                            .toLowerCase();


                    const appointmentDate =
                        String(
                            appointment.appointment_date ||
                            ""
                        )
                            .toLowerCase();


                    const appointmentTime =
                        String(
                            appointment.appointment_time ||
                            ""
                        )
                            .toLowerCase();


                    const status =
                        String(
                            appointment.status ||
                            "pending"
                        )
                            .toLowerCase();


                    const matchesSearch =
                        !search ||
                        studentName.includes(search) ||
                        studentNumber.includes(search) ||
                        email.includes(search) ||
                        purpose.includes(search) ||
                        notes.includes(search) ||
                        appointmentDate.includes(search) ||
                        appointmentTime.includes(search);


                    const matchesStatus =
                        statusFilter === "all" ||
                        status === statusFilter;


                    const matchesDate =
                        !dateFilter ||
                        appointment.appointment_date ===
                        dateFilter;


                    return (
                        matchesSearch &&
                        matchesStatus &&
                        matchesDate
                    );
                }
            );


    if (
        filtered.length ===
        0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="py-10 text-center"
                >
                    <div class="text-gray-400">
                        <i class="fa-solid fa-magnifying-glass text-2xl mb-2"></i>
                        <p class="font-semibold">No appointment records found.</p>
                        <p class="text-xs mt-1">Try changing your search or filters.</p>
                    </div>
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        "";


    filtered.forEach(
        (appointment) => {

            const student =
                getStudentForAppointment(
                    appointment
                );


            const studentName =
                student
                    ? `${student.first_name || ""} ${student.last_name || ""}`
                        .trim()
                    : "Unknown Student";


            const studentNumber =
                student?.student_number ||
                "N/A";


            const status =
                String(
                    appointment.status ||
                    "pending"
                )
                    .toLowerCase();


            const row =
                document.createElement(
                    "tr"
                );


            row.className =
                "border-b border-gray-200 hover:bg-gray-50";


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
                    ${escapeHTML(appointment.purpose || "")}
                </td>

                <td class="py-4 px-4 text-gray-700">
                    <div>
                        ${formatDate(appointment.appointment_date)}
                    </div>
                    <div class="text-sm text-gray-500">
                        ${escapeHTML(appointment.appointment_time || "")}
                    </div>
                </td>

                <td class="py-4 px-4 text-gray-600 text-sm max-w-xs">
                    ${escapeHTML(appointment.notes || "None")}
                </td>

                <td class="py-4 px-4">
                    ${statusBadge(status)}
                </td>

                <td class="py-4 px-4 text-right">
                    ${actionButtons(appointment.id, status)}
                </td>
            `;


            tbody.appendChild(
                row
            );
        }
    );


    attachAppointmentActions();
}


// ============================================================
// GET STUDENT
// ============================================================

function getStudentForAppointment(
    appointment
) {

    return state.students.find(
        (student) =>
            student.id ===
            appointment.student_id
    );
}


// ============================================================
// STATUS BADGES
// ============================================================

function statusBadge(status) {

    if (
        status ===
        "approved"
    ) {

        return `
            <span
                class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"
            >
                Approved
            </span>
        `;
    }


    if (
        status ===
        "rejected"
    ) {

        return `
            <span
                class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"
            >
                Rejected
            </span>
        `;
    }


    if (
        status ===
        "rescheduled"
    ) {

        return `
            <span
                class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700"
            >
                Rescheduled
            </span>
        `;
    }


    if (
        status ===
        "cancelled"
    ) {

        return `
            <span
                class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700"
            >
                Cancelled
            </span>
        `;
    }


    return `
        <span
            class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700"
        >
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

    const inactive =
        status ===
            "cancelled";


    const approveDisabled =
        status ===
            "approved" ||
        inactive;


    const rejectDisabled =
        status ===
            "rejected" ||
        inactive;


    return `
        <div
            class="flex flex-wrap justify-end gap-2"
        >

            <button
                class="approveBtn bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                data-id="${appointmentId}"
                ${
                    approveDisabled
                        ? "disabled"
                        : ""
                }
            >
                Approve
            </button>


            <button
                class="rejectBtn bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                data-id="${appointmentId}"
                ${
                    rejectDisabled
                        ? "disabled"
                        : ""
                }
            >
                Reject
            </button>


            <button
                class="rescheduleBtn bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                data-id="${appointmentId}"
                ${
                    inactive
                        ? "disabled"
                        : ""
                }
            >
                Reschedule
            </button>

        </div>
    `;
}


// ============================================================
// APPOINTMENT BUTTON EVENTS
// ============================================================

function attachAppointmentActions() {

    document
        .querySelectorAll(
            ".approveBtn"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    async () => {

                        await updateAppointmentStatus(
                            button.dataset.id,
                            "approved"
                        );
                    }
                );
            }
        );


    document
        .querySelectorAll(
            ".rejectBtn"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    async () => {

                        await updateAppointmentStatus(
                            button.dataset.id,
                            "rejected"
                        );
                    }
                );
            }
        );


    document
        .querySelectorAll(
            ".rescheduleBtn"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openRescheduleModal(
                            button.dataset.id
                        );
                    }
                );
            }
        );
}


// ============================================================
// APPROVE / REJECT
// ============================================================

async function updateAppointmentStatus(
    appointmentId,
    newStatus
) {

    const confirmed =
        confirm(
            `Are you sure you want to ${newStatus} this appointment?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const result =
            await adminRequest({
                action:
                    "updateStatus",

                appointmentId,

                status:
                    newStatus
            });


        const emailSent =
            await sendAppointmentEmail(
                result.student,
                result.appointment,
                newStatus
            );


        await loadAdminAppointments();


        if (emailSent) {

            alert(
                `Appointment ${capitalize(
                    newStatus
                )} successfully.\n\nStudent notification and email were sent.`
            );

        } else {

            alert(
                `Appointment ${capitalize(
                    newStatus
                )} successfully.\n\nThe in-app notification was created, but the email could not be confirmed.`
            );
        }


    } catch (error) {

        console.error(
            "Appointment update error:",
            error
        );


        alert(
            error.message ||
            "Unable to update appointment."
        );


        handleUnauthorized(
            error
        );
    }
}


// ============================================================
// EMAIL
// ============================================================

async function sendAppointmentEmail(
    student,
    appointment,
    status
) {

    try {

        if (
            !student ||
            !student.email ||
            !appointment
        ) {

            return false;
        }


        const studentName =
            `${student.first_name || ""} ${student.last_name || ""}`
                .trim() ||
            "Student";


        const {
            data,
            error
        } =
            await supabase.functions.invoke(
                "send-appointment-email",
                {
                    body: {

                        email:
                            student.email,

                        studentName,

                        status,

                        purpose:
                            appointment.purpose,

                        appointmentDate:
                            appointment.appointment_date,

                        appointmentTime:
                            appointment.appointment_time
                    }
                }
            );


        if (error) {

            console.error(
                "Email error:",
                error
            );

            return false;
        }


        console.log(
            "Email result:",
            data
        );


        return true;


    } catch (error) {

        console.error(
            "Email notification failed:",
            error
        );

        return false;
    }
}


// ============================================================
// RESCHEDULE MODAL
// ============================================================

function setupRescheduleEvents() {

    $("closeRescheduleModalBtn")
        ?.addEventListener(
            "click",
            closeRescheduleModal
        );


    $("cancelRescheduleBtn")
        ?.addEventListener(
            "click",
            closeRescheduleModal
        );


    $("confirmRescheduleBtn")
        ?.addEventListener(
            "click",
            confirmReschedule
        );
}


function openRescheduleModal(
    appointmentId
) {

    const appointment =
        state.appointments.find(
            (item) =>
                String(
                    item.id
                ) ===
                String(
                    appointmentId
                )
        );


    if (!appointment) {
        return;
    }


    const student =
        getStudentForAppointment(
            appointment
        );


    const studentName =
        student
            ? `${student.first_name || ""} ${student.last_name || ""}`
                .trim()
            : "Unknown Student";


    $("rescheduleAppointmentId").value =
        appointment.id;


    $("rescheduleStudentName").value =
        studentName;


    $("rescheduleDate").value =
        appointment.appointment_date ||
        "";


    $("rescheduleTime").value =
        appointment.appointment_time ||
        "8:00 AM - 9:00 AM";


    $("rescheduleReason").value =
        "";


    const modal =
        $("rescheduleModal");


    modal.classList.remove(
        "hidden"
    );


    modal.classList.add(
        "flex"
    );
}


function closeRescheduleModal() {

    const modal =
        $("rescheduleModal");


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );


    modal.classList.remove(
        "flex"
    );
}


// ============================================================
// CONFIRM RESCHEDULE
// ============================================================

async function confirmReschedule() {

    const appointmentId =
        $("rescheduleAppointmentId")
            ?.value;


    const newDate =
        $("rescheduleDate")
            ?.value;


    const newTime =
        $("rescheduleTime")
            ?.value;


    const reason =
        $("rescheduleReason")
            ?.value
            .trim();


    if (
        !appointmentId ||
        !newDate ||
        !newTime
    ) {

        alert(
            "Please select a new date and time."
        );

        return;
    }


    const confirmed =
        confirm(
            `Reschedule this appointment to ${formatDate(
                newDate
            )} at ${newTime}?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const result =
            await adminRequest({
                action:
                    "reschedule",

                appointmentId,

                newDate,

                newTime,

                reason
            });


        const emailSent =
            await sendAppointmentEmail(
                result.student,
                result.appointment,
                "rescheduled"
            );


        closeRescheduleModal();


        await loadAdminAppointments();


        if (emailSent) {

            alert(
                "Appointment rescheduled successfully.\n\nThe student notification and email were sent."
            );

        } else {

            alert(
                "Appointment rescheduled successfully.\n\nThe student notification was created, but email delivery could not be confirmed."
            );
        }


    } catch (error) {

        console.error(
            "Reschedule error:",
            error
        );


        alert(
            error.message ||
            "Unable to reschedule appointment."
        );


        handleUnauthorized(
            error
        );
    }
}


// ============================================================
// REGISTRAR SCHEDULE EVENTS
// ============================================================

function setupScheduleEvents() {

    $("saveScheduleBtn")
        ?.addEventListener(
            "click",
            saveRegistrarSchedule
        );


    $("scheduleStatus")
        ?.addEventListener(
            "change",
            () => {

                if (
                    $("scheduleStatus").value ===
                    "BLOCKED"
                ) {

                    $("scheduleCapacity").value =
                        "0";

                    $("scheduleCapacity").disabled =
                        true;

                } else {

                    $("scheduleCapacity").disabled =
                        false;


                    if (
                        Number(
                            $("scheduleCapacity").value
                        ) === 0
                    ) {

                        $("scheduleCapacity").value =
                            "50";
                    }
                }
            }
        );
}


// ============================================================
// LOAD REGISTRAR SCHEDULES
// ============================================================

async function loadRegistrarSchedules() {

    const tbody =
        $("registrarSchedulesBody");


    if (!tbody) {
        return;
    }


    tbody.innerHTML = `
        <tr>
            <td
                colspan="4"
                class="py-6 text-center text-gray-400"
            >
                Loading schedules...
            </td>
        </tr>
    `;


    try {

        const result =
            await adminRequest({
                action:
                    "listSchedules"
            });


        state.schedules =
            result.schedules ||
            [];


        renderRegistrarSchedules();


    } catch (error) {

        console.error(
            "Schedule load error:",
            error
        );


        tbody.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="py-6 text-center text-red-500"
                >
                    ${escapeHTML(
                        error.message
                    )}
                </td>
            </tr>
        `;


        handleUnauthorized(
            error
        );
    }
}


// ============================================================
// RENDER REGISTRAR SCHEDULES
// ============================================================

function renderRegistrarSchedules() {

    const tbody =
        $("registrarSchedulesBody");


    if (!tbody) {
        return;
    }


    if (
        state.schedules.length ===
        0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="py-6 text-center text-gray-400"
                >
                    No registrar schedules configured.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        "";


    state.schedules.forEach(
        (schedule) => {

            const row =
                document.createElement(
                    "tr"
                );


            row.className =
                "border-b border-gray-200";


            row.innerHTML = `
                <td
                    class="py-4 px-4 font-medium text-gray-800"
                >
                    ${formatDate(
                        schedule.schedule_date
                    )}
                </td>


                <td
                    class="py-4 px-4"
                >
                    ${scheduleBadge(
                        schedule.status
                    )}
                </td>


                <td
                    class="py-4 px-4 text-gray-700"
                >
                    ${escapeHTML(
                        schedule.max_capacity
                    )}
                </td>


                <td
                    class="py-4 px-4 text-right"
                >

                    <button
                        class="deleteScheduleBtn bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700"
                        data-id="${schedule.id}"
                    >
                        Delete
                    </button>

                </td>
            `;


            tbody.appendChild(
                row
            );
        }
    );


    document
        .querySelectorAll(
            ".deleteScheduleBtn"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    async () => {

                        await deleteRegistrarSchedule(
                            button.dataset.id
                        );
                    }
                );
            }
        );
}


// ============================================================
// SCHEDULE BADGE
// ============================================================

function scheduleBadge(status) {

    const normalized =
        String(
            status ||
            ""
        )
            .toUpperCase();


    if (
        normalized ===
        "BLOCKED"
    ) {

        return `
            <span
                class="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"
            >
                Blocked
            </span>
        `;
    }


    if (
        normalized ===
        "LIMITED"
    ) {

        return `
            <span
                class="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700"
            >
                Limited
            </span>
        `;
    }


    return `
        <span
            class="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"
        >
            Open
        </span>
    `;
}


// ============================================================
// SAVE REGISTRAR SCHEDULE
// ============================================================

async function saveRegistrarSchedule() {

    const scheduleDate =
        $("scheduleDate")
            ?.value;


    const status =
        $("scheduleStatus")
            ?.value;


    let maxCapacity =
        Number(
            $("scheduleCapacity")
                ?.value
        );


    if (!scheduleDate) {

        alert(
            "Please select a schedule date."
        );

        return;
    }


    if (
        status ===
        "BLOCKED"
    ) {

        maxCapacity =
            0;
    }


    if (
        !Number.isFinite(
            maxCapacity
        ) ||
        maxCapacity < 0
    ) {

        alert(
            "Please enter a valid maximum capacity."
        );

        return;
    }


    try {

        await adminRequest({
            action:
                "saveSchedule",

            scheduleDate,

            status,

            maxCapacity
        });


        alert(
            "Registrar schedule saved successfully."
        );


        await loadRegistrarSchedules();


    } catch (error) {

        console.error(
            "Schedule save error:",
            error
        );


        alert(
            error.message ||
            "Unable to save registrar schedule."
        );


        handleUnauthorized(
            error
        );
    }
}


// ============================================================
// DELETE REGISTRAR SCHEDULE
// ============================================================

async function deleteRegistrarSchedule(
    scheduleId
) {

    const confirmed =
        confirm(
            "Delete this registrar schedule setting?"
        );


    if (!confirmed) {
        return;
    }


    try {

        await adminRequest({
            action:
                "deleteSchedule",

            scheduleId
        });


        await loadRegistrarSchedules();


    } catch (error) {

        console.error(
            "Delete schedule error:",
            error
        );


        alert(
            error.message ||
            "Unable to delete schedule."
        );
    }
}


// ============================================================
// DAILY APPOINTMENT LIST EVENTS
// ============================================================

function setupDailyListEvents() {

    $("generateDailyListBtn")
        ?.addEventListener(
            "click",
            generateDailyList
        );


    $("dailyAppointmentDate")
        ?.addEventListener(
            "change",
            generateDailyList
        );


    $("printDailyListBtn")
        ?.addEventListener(
            "click",
            printDailyList
        );
}


// ============================================================
// GENERATE DAILY LIST
// ============================================================

async function generateDailyList() {

    const date =
        $("dailyAppointmentDate")
            ?.value;


    const tbody =
        $("dailyAppointmentsBody");


    if (
        !date ||
        !tbody
    ) {

        return;
    }


    tbody.innerHTML = `
        <tr>
            <td
                colspan="5"
                class="py-6 text-center text-gray-400"
            >
                Loading daily appointments...
            </td>
        </tr>
    `;


    try {

        const result =
            await adminRequest({
                action:
                    "dailyList",

                date
            });


        const appointments =
            result.appointments ||
            [];


        const students =
            result.students ||
            [];


        $("dailyListTitle").textContent =
            `Daily Appointment Schedule — ${formatDate(
                date
            )}`;


        if (
            appointments.length ===
            0
        ) {

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="5"
                        class="py-8 text-center text-gray-400"
                    >
                        No approved or rescheduled appointments found for this date.
                    </td>
                </tr>
            `;

            return;
        }


        tbody.innerHTML =
            "";


        appointments.forEach(
            (appointment) => {

                const student =
                    students.find(
                        (item) =>
                            item.id ===
                            appointment.student_id
                    );


                const name =
                    student
                        ? `${student.first_name || ""} ${student.last_name || ""}`
                            .trim()
                        : "Unknown Student";


                const row =
                    document.createElement(
                        "tr"
                    );


                row.className =
                    "border-b border-gray-200";


                row.innerHTML = `
                    <td
                        class="py-3 px-4 font-medium"
                    >
                        ${escapeHTML(
                            appointment.appointment_time ||
                            ""
                        )}
                    </td>


                    <td
                        class="py-3 px-4"
                    >
                        ${escapeHTML(
                            name
                        )}
                    </td>


                    <td
                        class="py-3 px-4"
                    >
                        ${escapeHTML(
                            student?.student_number ||
                            "N/A"
                        )}
                    </td>


                    <td
                        class="py-3 px-4"
                    >
                        ${escapeHTML(
                            appointment.purpose ||
                            ""
                        )}
                    </td>


                    <td
                        class="py-3 px-4"
                    >
                        ${statusBadge(
                            String(
                                appointment.status ||
                                ""
                            )
                                .toLowerCase()
                        )}
                    </td>
                `;


                tbody.appendChild(
                    row
                );
            }
        );


    } catch (error) {

        console.error(
            "Daily list error:",
            error
        );


        tbody.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="py-6 text-center text-red-500"
                >
                    ${escapeHTML(
                        error.message
                    )}
                </td>
            </tr>
        `;


        handleUnauthorized(
            error
        );
    }
}


// ============================================================
// PRINT DAILY LIST
// ============================================================

function printDailyList() {

    const area =
        $("dailyPrintArea");


    if (!area) {
        return;
    }


    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        alert(
            "Please allow pop-ups to print the daily appointment list."
        );

        return;
    }


    printWindow.document.write(`
        <!DOCTYPE html>

        <html>

        <head>

            <title>
                ESSU Registrar Daily Appointment List
            </title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    padding: 30px;
                    color: #222;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                th,
                td {
                    border: 1px solid #999;
                    padding: 8px;
                    text-align: left;
                }

                th {
                    background: #f2f2f2;
                }

                .text-center {
                    text-align: center;
                }

                button {
                    display: none;
                }

            </style>

        </head>

        <body>

            ${area.innerHTML}

        </body>

        </html>
    `);


    printWindow.document.close();


    printWindow.focus();


    setTimeout(
        () => {

            printWindow.print();

        },
        300
    );
}


// ============================================================
// REPORTS & ANALYTICS EVENTS
// ============================================================

function setupReportEvents() {

    $("generateReportBtn")
        ?.addEventListener(
            "click",
            generateReport
        );


    $("clearReportFiltersBtn")
        ?.addEventListener(
            "click",
            () => {

                if ($("reportStartDate")) {
                    $("reportStartDate").value =
                        "";
                }


                if ($("reportEndDate")) {
                    $("reportEndDate").value =
                        "";
                }


                generateReport();
            }
        );


    $("printReportBtn")
        ?.addEventListener(
            "click",
            printSummaryReport
        );
}


// ============================================================
// GENERATE SUMMARY REPORT
// ============================================================

function generateReport() {

    const startDate =
        $("reportStartDate")
            ?.value ||
        "";


    const endDate =
        $("reportEndDate")
            ?.value ||
        "";


    if (
        startDate &&
        endDate &&
        startDate > endDate
    ) {

        alert(
            "The report start date cannot be later than the end date."
        );

        return;
    }


    const filteredAppointments =
        state.appointments.filter(
            (appointment) => {

                const appointmentDate =
                    appointment.appointment_date ||
                    "";


                if (
                    startDate &&
                    appointmentDate < startDate
                ) {

                    return false;
                }


                if (
                    endDate &&
                    appointmentDate > endDate
                ) {

                    return false;
                }


                return true;
            }
        );


    renderReportTotals(
        filteredAppointments
    );


    renderReportStatusSummary(
        filteredAppointments
    );


    renderReportPurposeSummary(
        filteredAppointments
    );


    updateReportLabels(
        startDate,
        endDate
    );
}


// ============================================================
// REPORT TOTAL CARDS
// ============================================================

function renderReportTotals(
    appointments
) {

    const countStatus =
        (status) =>
            appointments.filter(
                (appointment) =>
                    String(
                        appointment.status ||
                        "pending"
                    )
                        .toLowerCase() ===
                    status
            ).length;


    const values = {
        reportTotal:
            appointments.length,

        reportPending:
            countStatus(
                "pending"
            ),

        reportApproved:
            countStatus(
                "approved"
            ),

        reportRescheduled:
            countStatus(
                "rescheduled"
            ),

        reportRejected:
            countStatus(
                "rejected"
            ),

        reportCancelled:
            countStatus(
                "cancelled"
            )
    };


    Object
        .entries(values)
        .forEach(
            ([id, value]) => {

                if ($(id)) {
                    $(id).textContent =
                        value;
                }
            }
        );
}


// ============================================================
// REPORT SUMMARY BY STATUS
// ============================================================

function renderReportStatusSummary(
    appointments
) {

    const tbody =
        $("reportStatusSummaryBody");


    if (!tbody) {
        return;
    }


    const statuses = [
        "pending",
        "approved",
        "rescheduled",
        "rejected",
        "cancelled"
    ];


    const total =
        appointments.length;


    tbody.innerHTML =
        "";


    statuses.forEach(
        (status) => {

            const count =
                appointments.filter(
                    (appointment) =>
                        String(
                            appointment.status ||
                            "pending"
                        )
                            .toLowerCase() ===
                        status
                ).length;


            const percentage =
                total > 0
                    ? (
                        (count / total) *
                        100
                    ).toFixed(1)
                    : "0.0";


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `
                <td class="py-3 px-4">
                    ${statusBadge(status)}
                </td>

                <td class="py-3 px-4 text-right font-bold text-slate-700">
                    ${count}
                </td>

                <td class="py-3 px-4 text-right text-slate-500">
                    ${percentage}%
                </td>
            `;


            tbody.appendChild(
                row
            );
        }
    );
}


// ============================================================
// REPORT SUMMARY BY PURPOSE
// ============================================================

function renderReportPurposeSummary(
    appointments
) {

    const tbody =
        $("reportPurposeSummaryBody");


    if (!tbody) {
        return;
    }


    const total =
        appointments.length;


    const purposeCounts =
        new Map();


    appointments.forEach(
        (appointment) => {

            const purpose =
                String(
                    appointment.purpose ||
                    "Unspecified"
                )
                    .trim() ||
                "Unspecified";


            purposeCounts.set(
                purpose,
                (
                    purposeCounts.get(
                        purpose
                    ) ||
                    0
                ) + 1
            );
        }
    );


    const sortedPurposes =
        Array
            .from(
                purposeCounts.entries()
            )
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );


    if (
        sortedPurposes.length ===
        0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="3"
                    class="py-6 px-4 text-center text-slate-400"
                >
                    No appointment records found for this report period.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        "";


    sortedPurposes.forEach(
        ([purpose, count]) => {

            const percentage =
                total > 0
                    ? (
                        (count / total) *
                        100
                    ).toFixed(1)
                    : "0.0";


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `
                <td class="py-3 px-4 font-medium text-slate-700">
                    ${escapeHTML(
                        purpose
                    )}
                </td>

                <td class="py-3 px-4 text-right font-bold text-slate-700">
                    ${count}
                </td>

                <td class="py-3 px-4 text-right text-slate-500">
                    ${percentage}%
                </td>
            `;


            tbody.appendChild(
                row
            );
        }
    );
}


// ============================================================
// REPORT LABELS
// ============================================================

function updateReportLabels(
    startDate,
    endDate
) {

    const rangeLabel =
        $("reportRangeLabel");


    if (rangeLabel) {

        if (
            startDate &&
            endDate
        ) {

            rangeLabel.textContent =
                `${formatDate(
                    startDate
                )} to ${formatDate(
                    endDate
                )}`;

        } else if (startDate) {

            rangeLabel.textContent =
                `From ${formatDate(
                    startDate
                )}`;

        } else if (endDate) {

            rangeLabel.textContent =
                `Up to ${formatDate(
                    endDate
                )}`;

        } else {

            rangeLabel.textContent =
                "All appointment records";
        }
    }


    if ($("reportGeneratedAt")) {

        $("reportGeneratedAt").textContent =
            `Generated: ${new Date().toLocaleString(
                "en-US",
                {
                    year:
                        "numeric",

                    month:
                        "short",

                    day:
                        "numeric",

                    hour:
                        "numeric",

                    minute:
                        "2-digit"
                }
            )}`;
    }
}


// ============================================================
// PRINT SUMMARY REPORT
// ============================================================

function printSummaryReport() {

    generateReport();


    const area =
        $("reportPrintArea");


    if (!area) {
        return;
    }


    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        alert(
            "Please allow pop-ups to print the appointment summary report."
        );

        return;
    }


    printWindow.document.write(`
        <!DOCTYPE html>

        <html>

        <head>

            <title>
                ESSU Registrar Appointment Summary Report
            </title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    padding: 30px;
                    color: #222;
                }

                img {
                    max-width: 70px;
                    display: block;
                    margin: 0 auto 10px;
                }

                h4,
                h5,
                p {
                    text-align: center;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 12px;
                    margin-bottom: 24px;
                }

                th,
                td {
                    border: 1px solid #999;
                    padding: 8px;
                    text-align: left;
                }

                th {
                    background: #f2f2f2;
                }

                .grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    margin: 18px 0;
                }

                .grid > div {
                    border: 1px solid #bbb;
                    padding: 10px;
                }

                .text-right {
                    text-align: right;
                }

                button {
                    display: none !important;
                }

            </style>

        </head>

        <body>

            ${area.innerHTML}

        </body>

        </html>
    `);


    printWindow.document.close();


    printWindow.focus();


    setTimeout(
        () => {

            printWindow.print();

        },
        300
    );
}


// ============================================================
// HISTORY EVENTS
// ============================================================

function setupHistoryEvents() {

    $("refreshHistoryBtn")
        ?.addEventListener(
            "click",
            loadHistoryLogs
        );
}


// ============================================================
// LOAD HISTORY
// ============================================================

async function loadHistoryLogs() {

    const tbody =
        $("historyLogsBody");


    if (!tbody) {
        return;
    }


    tbody.innerHTML = `
        <tr>
            <td
                colspan="6"
                class="py-6 text-center text-gray-400"
            >
                Loading activity history...
            </td>
        </tr>
    `;


    try {

        const result =
            await adminRequest({
                action:
                    "historyLogs"
            });


        state.history =
            result.logs ||
            [];


        renderHistoryLogs();


    } catch (error) {

        console.error(
            "History load error:",
            error
        );


        tbody.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="py-6 text-center text-red-500"
                >
                    ${escapeHTML(
                        error.message
                    )}
                </td>
            </tr>
        `;


        handleUnauthorized(
            error
        );
    }
}


// ============================================================
// RENDER HISTORY
// ============================================================

function renderHistoryLogs() {

    const tbody =
        $("historyLogsBody");


    if (!tbody) {
        return;
    }


    if (
        state.history.length ===
        0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="py-6 text-center text-gray-400"
                >
                    No activity history found.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        "";


    state.history.forEach(
        (log) => {

            const student =
                log.student;


            const appointment =
                log.appointment;


            const studentName =
                student
                    ? `${student.first_name || ""} ${student.last_name || ""}`
                        .trim()
                    : "Unknown Student";


            const row =
                document.createElement(
                    "tr"
                );


            row.className =
                "border-b border-gray-200";


            row.innerHTML = `
                <td
                    class="py-3 px-4 text-sm"
                >
                    ${formatDateTime(
                        log.created_at
                    )}
                </td>


                <td
                    class="py-3 px-4"
                >
                    ${escapeHTML(
                        studentName
                    )}
                </td>


                <td
                    class="py-3 px-4"
                >
                    ${escapeHTML(
                        appointment?.purpose ||
                        "N/A"
                    )}
                </td>


                <td
                    class="py-3 px-4"
                >
                    ${statusBadge(
                        String(
                            log.old_status ||
                            "pending"
                        )
                            .toLowerCase()
                    )}
                </td>


                <td
                    class="py-3 px-4"
                >
                    ${statusBadge(
                        String(
                            log.new_status ||
                            ""
                        )
                            .toLowerCase()
                    )}
                </td>


                <td
                    class="py-3 px-4 text-sm text-gray-600"
                >
                    ${escapeHTML(
                        log.changed_by ||
                        "System"
                    )}
                </td>
            `;


            tbody.appendChild(
                row
            );
        }
    );
}


// ============================================================
// DATE FORMATTERS
// ============================================================

function formatDate(
    dateString
) {

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
            year:
                "numeric",

            month:
                "short",

            day:
                "numeric"
        }
    );
}


function formatDateTime(
    value
) {

    if (!value) {
        return "";
    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;
    }


    return date.toLocaleString(
        "en-US",
        {
            year:
                "numeric",

            month:
                "short",

            day:
                "numeric",

            hour:
                "numeric",

            minute:
                "2-digit"
        }
    );
}


// ============================================================
// HELPERS
// ============================================================

function capitalize(
    value
) {

    return String(
        value ||
        ""
    )
        .charAt(0)
        .toUpperCase() +
        String(
            value ||
            ""
        )
            .slice(1);
}


function escapeHTML(
    value
) {

    return String(
        value ??
        ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// ============================================================
// UNAUTHORIZED HANDLING
// ============================================================

function handleUnauthorized(
    error
) {

    if (
        String(
            error?.message ||
            ""
        )
            .toLowerCase()
            .includes(
                "unauthorized"
            )
    ) {

        alert(
            "Your administrator session is no longer valid. Please login again."
        );


        logoutAdmin(
            false
        );
    }
}


// ============================================================
// LOGOUT
// ============================================================

async function logoutAdmin(
    redirect = true
) {

    try {

        await supabase.auth.signOut();

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );
    }


    sessionStorage.clear();


    window.location.href =
        "login.html";
}


// ============================================================
// LOGOUT BUTTON
// ============================================================

$("adminLogoutBtn")
    ?.addEventListener(
        "click",
        async () => {

            await logoutAdmin();
        }
    );