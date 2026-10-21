import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);


// ============================================================
// STATE
// ============================================================

const state = {
    appointments: [],
    students: [],
    schedules: [],
    history: [],
    appointmentRefreshTimer: null,
    historyFilters: {
        search: "",
        action: "all",
        date: ""
    }
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
        ensureAppointmentStatusOptions();
        setupScheduleEvents();
        setupDailyListEvents();
        setupReportEvents();
        setupHistoryEvents();
        setupRescheduleEvents();


        setDefaultDates();

        switchTab(
            "appointments"
        );

        await loadAdminAppointments();

        setupAutomaticAppointmentRefresh();
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
// BACK / FORWARD CACHE SECURITY
// ============================================================

function hasValidAdminSession() {

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

    const now =
        Math.floor(
            Date.now() / 1000
        );


    return (
        loggedIn === "true" &&
        role === "admin" &&
        Boolean(adminToken) &&
        Boolean(expiresAt) &&
        expiresAt > now
    );
}


window.addEventListener(
    "pageshow",
    () => {

        if (
            !hasValidAdminSession()
        ) {

            sessionStorage.clear();


            window.location.replace(
                "login.html"
            );
        }
    }
);


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
        appointments: "tabAppointments",
        schedules: "tabSchedules",
        daily: "tabDaily",
        reports: "tabReports",
        history: "tabHistory"
    };

    Object
        .values(tabMap)
        .forEach((id) => {

            const section =
                $(id);

            if (section) {
                section.classList.add(
                    "hidden"
                );
            }
        });

    const selected =
        $(tabMap[tabName]);

    if (selected) {
        selected.classList.remove(
            "hidden"
        );
    }

    const sharedClasses = [
        "adminTabButton",
        "flex-1",
        "min-w-[220px]",
        "py-3.5",
        "px-4",
        "rounded-xl",
        "font-bold",
        "text-sm",
        "transition",
        "duration-150",
        "flex",
        "items-center",
        "justify-center",
        "gap-2.5",
        "border-2",
        "bg-white"
    ];

    document
        .querySelectorAll(
            ".adminTabButton"
        )
        .forEach((button) => {

            const active =
                button.dataset.tab ===
                tabName;

            button.className =
                [
                    ...sharedClasses,

                    ...(active
                        ? [
                            "border-[#0f4c2e]",
                            "text-[#0f4c2e]",
                            "shadow-sm"
                        ]
                        : [
                            "border-transparent",
                            "text-slate-700",
                            "hover:border-[#0f4c2e]",
                            "hover:text-[#0f4c2e]"
                        ])
                ].join(" ");

            button.setAttribute(
                "aria-selected",
                active
                    ? "true"
                    : "false"
            );
        });
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
// AUTOMATIC APPOINTMENT REFRESH
// ============================================================

function setupAutomaticAppointmentRefresh() {

    if (
        state.appointmentRefreshTimer
    ) {
        clearInterval(
            state.appointmentRefreshTimer
        );
    }

    state.appointmentRefreshTimer =
        setInterval(
            async () => {

                if (
                    document.hidden ||
                    !hasValidAdminSession()
                ) {
                    return;
                }

                try {
                    await refreshAppointmentData(
                        false
                    );
                } catch (error) {
                    console.warn(
                        "Automatic appointment refresh failed:",
                        error
                    );
                }
            },
            2000
        );
}


async function refreshAppointmentData(
    forceRender = false
) {

    const result =
        await adminRequest({
            action: "list"
        });

    const newAppointments =
        result.appointments ||
        [];

    const newStudents =
        result.students ||
        [];

    const oldSnapshot =
        createAppointmentSnapshot(
            state.appointments
        );

    const newSnapshot =
        createAppointmentSnapshot(
            newAppointments
        );

    const changed =
        oldSnapshot !==
        newSnapshot;

    state.appointments =
        newAppointments;

    state.students =
        newStudents;

    if (
        changed ||
        forceRender
    ) {

        renderStatistics();
        renderAppointments();

        const dailySection =
            $("tabDaily");

        if (
            dailySection &&
            !dailySection.classList.contains(
                "hidden"
            )
        ) {
            await generateDailyList();
        }

        const reportsSection =
            $("tabReports");

        if (
            reportsSection &&
            !reportsSection.classList.contains(
                "hidden"
            )
        ) {
            generateReport();
        }
    }

    return changed;
}


function createAppointmentSnapshot(
    appointments
) {

    return JSON.stringify(
        [...appointments]
            .map((appointment) => ({
                id:
                    appointment.id,
                student_id:
                    appointment.student_id,
                purpose:
                    appointment.purpose,
                appointment_date:
                    appointment.appointment_date,
                appointment_time:
                    appointment.appointment_time,
                status:
                    appointment.status,
                notes:
                    appointment.notes,
                created_at:
                    appointment.created_at
            }))
            .sort(
                (a, b) =>
                    String(a.id)
                        .localeCompare(
                            String(b.id)
                        )
            )
    );
}


document.addEventListener(
    "visibilitychange",
    async () => {

        if (
            document.hidden ||
            !hasValidAdminSession()
        ) {
            return;
        }

        try {
            await refreshAppointmentData(
                true
            );
        } catch (error) {
            console.warn(
                "Appointment refresh after returning to the page failed:",
                error
            );
        }
    }
);


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

    $("appointmentSearch")
        ?.addEventListener(
            "input",
            renderAppointments
        );


    $("appointmentStatusFilter")
        ?.addEventListener(
            "change",
            renderAppointments
        );


    $("appointmentDateFilter")
        ?.addEventListener(
            "change",
            renderAppointments
        );


    $("clearAppointmentFiltersBtn")
        ?.addEventListener(
            "click",
            () => {

                if ($("appointmentSearch")) {

                    $("appointmentSearch").value =
                        "";
                }


                if ($("appointmentStatusFilter")) {

                    $("appointmentStatusFilter").value =
                        "all";
                }


                if ($("appointmentDateFilter")) {

                    $("appointmentDateFilter").value =
                        "";
                }


                renderAppointments();
            }
        );
}


// ============================================================
// ENSURE COMPLETED / EXPIRED FILTER OPTIONS
// ============================================================

function ensureAppointmentStatusOptions() {

    const select =
        $("appointmentStatusFilter");


    if (!select) {
        return;
    }


    const existingValues =
        Array
            .from(
                select.options
            )
            .map(
                (option) =>
                    option.value
            );


    const extraOptions = [
        {
            value:
                "completed",

            label:
                "Completed"
        },

        {
            value:
                "expired",

            label:
                "Expired"
        },

        {
            value:
                "cancelled",

            label:
                "Cancelled"
        }
    ];


    extraOptions.forEach(
        ({
            value,
            label
        }) => {

            if (
                existingValues.includes(
                    value
                )
            ) {

                return;
            }


            const option =
                document.createElement(
                    "option"
                );


            option.value =
                value;


            option.textContent =
                label;


            select.appendChild(
                option
            );
        }
    );
}// ============================================================
// RENDER APPOINTMENTS
// NEWEST SUBMITTED REQUEST FIRST
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


    const sortedAppointments =
        [...state.appointments]
            .sort(
                (a, b) => {

                    const aTime =
                        new Date(
                            a.created_at ||
                            0
                        )
                            .getTime();


                    const bTime =
                        new Date(
                            b.created_at ||
                            0
                        )
                            .getTime();


                    return (
                        bTime -
                        aTime
                    );
                }
            );


    const filtered =
        sortedAppointments.filter(
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
                    studentName.includes(
                        search
                    ) ||
                    studentNumber.includes(
                        search
                    ) ||
                    email.includes(
                        search
                    ) ||
                    purpose.includes(
                        search
                    ) ||
                    notes.includes(
                        search
                    ) ||
                    appointmentDate.includes(
                        search
                    ) ||
                    appointmentTime.includes(
                        search
                    );


                const matchesStatus =
                    statusFilter ===
                        "all" ||
                    status ===
                        statusFilter;


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

                        <i
                            class="fa-solid fa-magnifying-glass text-2xl mb-2"
                        ></i>

                        <p class="font-semibold">
                            No appointment records found.
                        </p>

                        <p class="text-xs mt-1">
                            Try changing your search or filters.
                        </p>

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
                "border-b border-gray-200 hover:bg-gray-50 transition";


            row.innerHTML = `

                <td
                    class="py-4 px-4"
                >

                    <div
                        class="font-semibold text-gray-800"
                    >
                        ${escapeHTML(
                            studentName
                        )}
                    </div>


                    <div
                        class="text-sm text-gray-500"
                    >
                        ${escapeHTML(
                            studentNumber
                        )}
                    </div>


                    <div
                        class="text-xs text-slate-400 mt-1"
                    >
                        Created:
                        ${formatCreatedAt(
                            appointment.created_at
                        )}
                    </div>

                </td>


                <td
                    class="py-4 px-4 text-gray-700"
                >
                    ${escapeHTML(
                        appointment.purpose ||
                        ""
                    )}
                </td>


                <td
                    class="py-4 px-4 text-gray-700"
                >

                    <div>
                        ${formatDate(
                            appointment.appointment_date
                        )}
                    </div>


                    <div
                        class="text-sm text-gray-500"
                    >
                        ${escapeHTML(
                            appointment.appointment_time ||
                            ""
                        )}
                    </div>

                </td>


                <td
                    class="py-4 px-4 text-gray-600 text-sm max-w-xs"
                >
                    ${escapeHTML(
                        appointment.notes ||
                        "None"
                    )}
                </td>


                <td
                    class="py-4 px-4"
                >
                    ${statusBadge(
                        status
                    )}
                </td>


                <td
                    class="py-4 px-4 text-right whitespace-nowrap"
                >
                    ${actionButtons(
                        appointment.id,
                        status,
                        appointment.appointment_date
                    )}
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
// FORMAT CREATED AT
// ============================================================

function formatCreatedAt(
    value
) {

    if (!value) {
        return "Unknown";
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

        return "Unknown";
    }


    return date.toLocaleString(
        "en-PH",
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
// GET STUDENT FOR APPOINTMENT
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

function statusBadge(
    status
) {

    const normalized =
        String(
            status ||
            "pending"
        )
            .trim()
            .toLowerCase();


    if (
        normalized ===
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
        normalized ===
        "completed"
    ) {

        return `
            <span
                class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700"
            >
                Completed
            </span>
        `;
    }


    if (
        normalized ===
        "expired"
    ) {

        return `
            <span
                class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700"
            >
                Expired
            </span>
        `;
    }


    if (
        normalized ===
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
        normalized ===
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
        normalized ===
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
    status,
    appointmentDate
) {

    const normalizedStatus =
        String(
            status ||
            "pending"
        )
            .trim()
            .toLowerCase();


    const terminalStatuses = [
        "completed",
        "expired",
        "rejected",
        "cancelled"
    ];


    if (
        terminalStatuses.includes(
            normalizedStatus
        )
    ) {

        return `
            <div
                class="flex items-center justify-end whitespace-nowrap"
            >
                <span
                    class="text-sm font-medium text-slate-300 select-none"
                >
                    —
                </span>
            </div>
        `;
    }


    if (
        normalizedStatus ===
        "approved"
    ) {

        const today =
            new Date();


        today.setHours(
            0,
            0,
            0,
            0
        );


        const scheduledDate =
            appointmentDate
                ? new Date(
                    `${appointmentDate}T00:00:00`
                )
                : null;


        if (
            scheduledDate
        ) {

            scheduledDate.setHours(
                0,
                0,
                0,
                0
            );
        }


        const canComplete =
            scheduledDate &&
            !Number.isNaN(
                scheduledDate.getTime()
            ) &&
            scheduledDate.getTime() ===
                today.getTime();


        return `
            <div
                class="flex items-center justify-end gap-4 whitespace-nowrap"
            >

                ${
                    canComplete
                        ? `
                            <button
                                type="button"
                                class="completeBtn text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline transition"
                                data-id="${appointmentId}"
                            >
                                Mark Complete
                            </button>
                        `
                        : `
                            <span
                                class="text-sm font-medium text-slate-300 cursor-not-allowed select-none"
                                title="This appointment can only be marked complete on its scheduled date."
                            >
                                Mark Complete
                            </span>
                        `
                }


                <button
                    type="button"
                    class="rescheduleBtn text-sm font-semibold text-purple-700 hover:text-purple-900 hover:underline transition"
                    data-id="${appointmentId}"
                >
                    Reschedule
                </button>

            </div>
        `;
    }


    return `
        <div
            class="flex items-center justify-end gap-4 whitespace-nowrap"
        >

            <button
                type="button"
                class="approveBtn text-sm font-semibold text-emerald-700 hover:text-emerald-900 hover:underline transition"
                data-id="${appointmentId}"
            >
                Approve
            </button>


            <button
                type="button"
                class="rejectBtn text-sm font-semibold text-red-600 hover:text-red-800 hover:underline transition"
                data-id="${appointmentId}"
            >
                Reject
            </button>


            <button
                type="button"
                class="rescheduleBtn text-sm font-semibold text-purple-700 hover:text-purple-900 hover:underline transition"
                data-id="${appointmentId}"
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
                            "approved",
                            button
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
                            "rejected",
                            button
                        );
                    }
                );
            }
        );


    document
        .querySelectorAll(
            ".completeBtn"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    async () => {

                        await updateAppointmentStatus(
                            button.dataset.id,
                            "completed",
                            button
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
// UPDATE APPOINTMENT STATUS
// NO CONFIRM POPUP
// ============================================================

async function updateAppointmentStatus(
    appointmentId,
    newStatus,
    triggerButton = null
) {

    if (
        triggerButton
    ) {

        triggerButton.disabled =
            true;


        triggerButton.classList.add(
            "opacity-50",
            "pointer-events-none"
        );
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


        await refreshAppointmentData(
            true
        );


        try {

            await loadHistoryLogs();

        } catch (historyError) {

            console.warn(
                "History refresh after appointment update failed:",
                historyError
            );
        }


        const label =
            newStatus ===
                "completed"
                ? "Appointment marked complete."
                : `Appointment ${capitalize(
                    newStatus
                )}.`;


        showAdminNotice(
            emailSent
                ? `${label} Student notification and email were sent.`
                : `${label} Student notification was created.`,
            "success"
        );


    } catch (error) {

        console.error(
            "Appointment update error:",
            error
        );


        showAdminNotice(
            error.message ||
            "Unable to update appointment.",
            "error"
        );


        handleUnauthorized(
            error
        );


    } finally {

        if (
            triggerButton &&
            document.body.contains(
                triggerButton
            )
        ) {

            triggerButton.disabled =
                false;


            triggerButton.classList.remove(
                "opacity-50",
                "pointer-events-none"
            );
        }
    }
}


// ============================================================
// EMAIL NOTIFICATION
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
// RESCHEDULE MODAL EVENTS
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


// ============================================================
// OPEN RESCHEDULE MODAL
// ============================================================

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


    if (
        $("rescheduleAppointmentId")
    ) {

        $("rescheduleAppointmentId").value =
            appointment.id;
    }


    if (
        $("rescheduleStudentName")
    ) {

        $("rescheduleStudentName").value =
            studentName;
    }


    if (
        $("rescheduleDate")
    ) {

        $("rescheduleDate").value =
            appointment.appointment_date ||
            "";
    }


    if (
        $("rescheduleTime")
    ) {

        $("rescheduleTime").value =
            appointment.appointment_time ||
            "8:00 AM - 9:00 AM";
    }


    if (
        $("rescheduleReason")
    ) {

        $("rescheduleReason").value =
            "";
    }


    const modal =
        $("rescheduleModal");


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "hidden"
    );


    modal.classList.add(
        "flex"
    );
}


// ============================================================
// CLOSE RESCHEDULE MODAL
// ============================================================

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
// NO SECOND BROWSER CONFIRM POPUP
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

        showAdminNotice(
            "Please select a new appointment date and time.",
            "error"
        );


        return;
    }


    const confirmButton =
        $("confirmRescheduleBtn");


    if (
        confirmButton
    ) {

        confirmButton.disabled =
            true;


        confirmButton.classList.add(
            "opacity-60",
            "pointer-events-none"
        );
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


        await refreshAppointmentData(
            true
        );


        try {

            await loadHistoryLogs();

        } catch (historyError) {

            console.warn(
                "History refresh after reschedule failed:",
                historyError
            );
        }


        showAdminNotice(
            emailSent
                ? "Appointment rescheduled successfully. The student notification and email were sent."
                : "Appointment rescheduled successfully. The student notification was created.",
            "success"
        );


    } catch (error) {

        console.error(
            "Reschedule error:",
            error
        );


        showAdminNotice(
            error.message ||
            "Unable to reschedule appointment.",
            "error"
        );


        handleUnauthorized(
            error
        );


    } finally {

        if (
            confirmButton
        ) {

            confirmButton.disabled =
                false;


            confirmButton.classList.remove(
                "opacity-60",
                "pointer-events-none"
            );
        }
    }
}


// ============================================================
// ADMIN NOTICE
// ============================================================

function showAdminNotice(
    message,
    type = "success"
) {

    let notice =
        $("adminActionNotice");


    if (!notice) {

        notice =
            document.createElement(
                "div"
            );


        notice.id =
            "adminActionNotice";


        document.body.appendChild(
            notice
        );
    }


    const success =
        type ===
        "success";


    notice.className = [
        "fixed",
        "top-24",
        "right-5",
        "z-[9999]",
        "max-w-sm",
        "rounded-xl",
        "shadow-xl",
        "px-4",
        "py-3",
        "text-sm",
        "font-semibold",
        "transition-all",
        "duration-200",
        "pointer-events-none",

        success
            ? "bg-[#0f4c2e] text-white"
            : "bg-red-600 text-white"
    ]
        .join(
            " "
        );


    notice.textContent =
        message;


    requestAnimationFrame(
        () => {

            notice.classList.add(
                "opacity-100",
                "translate-y-0"
            );
        }
    );


    clearTimeout(
        showAdminNotice.timer
    );


    showAdminNotice.timer =
        setTimeout(
            () => {

                notice.classList.add(
                    "opacity-0"
                );

            },
            3500
        );
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

                const status =
                    $("scheduleStatus")
                        ?.value;


                if (
                    status ===
                    "BLOCKED"
                ) {

                    if (
                        $("scheduleCapacity")
                    ) {

                        $("scheduleCapacity").value =
                            "0";


                        $("scheduleCapacity").disabled =
                            true;
                    }

                } else {

                    if (
                        $("scheduleCapacity")
                    ) {

                        $("scheduleCapacity").disabled =
                            false;


                        if (
                            Number(
                                $("scheduleCapacity").value
                            ) ===
                            0
                        ) {

                            $("scheduleCapacity").value =
                                "50";
                        }
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
                class="py-8 text-center text-gray-400"
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
                    class="py-8 text-center text-red-500"
                >
                    ${escapeHTML(
                        error.message ||
                        "Unable to load registrar schedules."
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
                    class="py-8 text-center text-gray-400"
                >
                    No registrar schedules configured.
                </td>
            </tr>
        `;


        return;
    }


    tbody.innerHTML =
        "";


    [...state.schedules]
        .sort(
            (a, b) =>
                String(
                    b.schedule_date ||
                    ""
                )
                    .localeCompare(
                        String(
                            a.schedule_date ||
                            ""
                        )
                    )
        )
        .forEach(
            (schedule) => {

                const row =
                    document.createElement(
                        "tr"
                    );


                row.className =
                    "border-b border-gray-200 hover:bg-gray-50 transition";


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
                        class="py-4 px-4 text-right whitespace-nowrap"
                    >

                        <button
                            type="button"
                            class="deleteScheduleBtn text-sm font-semibold text-red-600 hover:text-red-800 hover:underline transition"
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
                            button.dataset.id,
                            button
                        );
                    }
                );
            }
        );
}


// ============================================================
// SCHEDULE BADGE
// ============================================================

function scheduleBadge(
    status
) {

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


    if (
        !scheduleDate
    ) {

        showAdminNotice(
            "Please select a registrar schedule date.",
            "error"
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

        showAdminNotice(
            "Please enter a valid maximum capacity.",
            "error"
        );


        return;
    }


    const button =
        $("saveScheduleBtn");


    if (
        button
    ) {

        button.disabled =
            true;


        button.classList.add(
            "opacity-60",
            "pointer-events-none"
        );
    }


    try {

        await adminRequest({
            action:
                "saveSchedule",

            scheduleDate,

            status,

            maxCapacity
        });


        await loadRegistrarSchedules();


        showAdminNotice(
            "Registrar schedule saved successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "Schedule save error:",
            error
        );


        showAdminNotice(
            error.message ||
            "Unable to save registrar schedule.",
            "error"
        );


        handleUnauthorized(
            error
        );


    } finally {

        if (
            button
        ) {

            button.disabled =
                false;


            button.classList.remove(
                "opacity-60",
                "pointer-events-none"
            );
        }
    }
}


// ============================================================
// DELETE REGISTRAR SCHEDULE
// NO NATIVE CONFIRM POPUP
// ============================================================

async function deleteRegistrarSchedule(
    scheduleId,
    triggerButton = null
) {

    if (
        triggerButton
    ) {

        triggerButton.disabled =
            true;


        triggerButton.classList.add(
            "opacity-50",
            "pointer-events-none"
        );
    }


    try {

        await adminRequest({
            action:
                "deleteSchedule",

            scheduleId
        });


        await loadRegistrarSchedules();


        showAdminNotice(
            "Registrar schedule deleted successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "Delete schedule error:",
            error
        );


        showAdminNotice(
            error.message ||
            "Unable to delete registrar schedule.",
            "error"
        );


        handleUnauthorized(
            error
        );


    } finally {

        if (
            triggerButton &&
            document.body.contains(
                triggerButton
            )
        ) {

            triggerButton.disabled =
                false;


            triggerButton.classList.remove(
                "opacity-50",
                "pointer-events-none"
            );
        }
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
                class="py-8 text-center text-gray-400"
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


        if (
            $("dailyListTitle")
        ) {

            $("dailyListTitle").textContent =
                `Daily Appointment Schedule — ${formatDate(
                    date
                )}`;
        }


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
                        No appointment records found for this date.
                    </td>
                </tr>
            `;


            return;
        }


        tbody.innerHTML =
            "";


        appointments
            .sort(
                (a, b) =>
                    String(
                        a.appointment_time ||
                        ""
                    )
                        .localeCompare(
                            String(
                                b.appointment_time ||
                                ""
                            )
                        )
            )
            .forEach(
                (appointment) => {

                    const student =
                        students.find(
                            (item) =>
                                item.id ===
                                appointment.student_id
                        );


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
                                studentName
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
                    class="py-8 text-center text-red-500"
                >
                    ${escapeHTML(
                        error.message ||
                        "Unable to generate the daily appointment list."
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

    const selectedDate =
        $("dailyAppointmentDate")
            ?.value ||
        "";


    const reportDate =
        selectedDate
            ? formatDate(
                selectedDate
            )
            : "Date not specified";


    const rows =
        Array.from(
            $("dailyAppointmentsBody")
                ?.querySelectorAll(
                    "tr"
                ) ||
            []
        );


    const printRows =
        rows.length
            ? rows
                .map(
                    (row) =>
                        row.outerHTML
                )
                .join(
                    ""
                )
            : `
                <tr>
                    <td
                        colspan="5"
                        style="text-align:center;"
                    >
                        No appointment records found.
                    </td>
                </tr>
            `;


    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        showAdminNotice(
            "Please allow pop-ups so the daily appointment list can be printed.",
            "error"
        );


        return;
    }


    printWindow.document.write(`
        <!DOCTYPE html>

        <html lang="en">

        <head>

            <meta charset="UTF-8">

            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            >


            <title>
                ESSU Registrar Daily Appointment List
            </title>


            <style>

                @page {
                    size: A4 portrait;
                    margin:
                        15mm
                        15mm
                        17mm;
                }


                * {
                    box-sizing:
                        border-box;
                }


                html,
                body {
                    margin:
                        0;

                    padding:
                        0;

                    background:
                        #ffffff;

                    color:
                        #111111;

                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;
                }


                body {
                    font-size:
                        10px;
                }


                .document {
                    width:
                        100%;
                }


                .header {
                    display:
                        flex;

                    justify-content:
                        space-between;

                    align-items:
                        flex-start;

                    width:
                        100%;

                    margin-bottom:
                        25px;
                }


                .essu-wordmark {
                    width:
                        290px;

                    height:
                        auto;

                    display:
                        block;
                }


                .bagong-logo {
                    width:
                        92px;

                    height:
                        auto;

                    display:
                        block;
                }


                .title {
                    text-align:
                        center;

                    margin-bottom:
                        18px;
                }


                .title h1 {
                    margin:
                        0;

                    font-size:
                        16px;

                    font-weight:
                        700;

                    letter-spacing:
                        0.2px;
                }


                .title p {
                    margin:
                        4px
                        0
                        0;

                    font-size:
                        9px;
                }


                .title .date {
                    margin-top:
                        5px;

                    font-weight:
                        700;

                    color:
                        #0f4c2e;
                }


                table {
                    width:
                        100%;

                    border-collapse:
                        collapse;

                    table-layout:
                        fixed;

                    margin-top:
                        4px;

                    font-size:
                        9px;
                }


                th,
                td {
                    border:
                        1px solid
                        #8f99a6;

                    padding:
                        6px
                        7px;

                    text-align:
                        left;

                    vertical-align:
                        middle;

                    line-height:
                        1.25;
                }


                th {
                    background:
                        #f3f4f6;

                    font-weight:
                        700;
                }


                th:nth-child(1),
                td:nth-child(1) {
                    width:
                        16%;
                }


                th:nth-child(2),
                td:nth-child(2) {
                    width:
                        22%;
                }


                th:nth-child(3),
                td:nth-child(3) {
                    width:
                        18%;
                }


                th:nth-child(4),
                td:nth-child(4) {
                    width:
                        28%;
                }


                th:nth-child(5),
                td:nth-child(5) {
                    width:
                        16%;
                }


                span[class*="rounded-full"] {
                    display:
                        inline-block !important;

                    padding:
                        1px
                        5px !important;

                    border-radius:
                        999px !important;

                    font-size:
                        8px !important;
                }


                .footer {
                    width:
                        62%;

                    margin-top:
                        28px;

                    padding-top:
                        5px;

                    border-top:
                        1px solid
                        #111111;

                    font-size:
                        8.5px;

                    line-height:
                        1.25;
                }


                @media print {

                    body {
                        -webkit-print-color-adjust:
                            exact;

                        print-color-adjust:
                            exact;
                    }


                    thead {
                        display:
                            table-header-group;
                    }


                    tr {
                        break-inside:
                            avoid;
                    }


                    .header,
                    .footer {
                        break-inside:
                            avoid;
                    }
                }

            </style>

        </head>


        <body>

            <div
                class="document"
            >


                <header
                    class="header"
                >

                    <img
                        src="img/header.jpg"
                        alt="Eastern Samar State University"
                        class="essu-wordmark"
                    >


                    <img
                        src="img/header bp.png"
                        alt="Bagong Pilipinas"
                        class="bagong-logo"
                    >

                </header>


                <section
                    class="title"
                >

                    <h1>
                        DAILY APPOINTMENT LIST
                    </h1>


                    <p>
                        Office of the University Registrar
                    </p>


                    <div
                        class="date"
                    >
                        ${escapeHTML(
                            reportDate
                        )}
                    </div>

                </section>


                <table>

                    <thead>

                        <tr>

                            <th>
                                Time Slot
                            </th>

                            <th>
                                Student Name
                            </th>

                            <th>
                                Student Number
                            </th>

                            <th>
                                Purpose of Visit
                            </th>

                            <th>
                                Status
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${printRows}

                    </tbody>

                </table>


                <footer
                    class="footer"
                >

                    Borongan City 6800
                    <br>

                    Eastern Samar, Philippines
                    <br>

                    info@essu.edu.ph
                    <br>

                    https://essu.edu.ph

                </footer>

            </div>


            <script>

                window.addEventListener(
                    "load",
                    () => {

                        setTimeout(
                            () => {

                                window.focus();

                                window.print();

                            },
                            350
                        );
                    }
                );

            <\/script>

        </body>

        </html>
    `);


    printWindow.document.close();
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

                if (
                    $("reportStartDate")
                ) {
                    $("reportStartDate").value =
                        "";
                }


                if (
                    $("reportEndDate")
                ) {
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

        showAdminNotice(
            "The report start date cannot be later than the end date.",
            "error"
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
            ),

        reportCompleted:
            countStatus(
                "completed"
            ),

        reportExpired:
            countStatus(
                "expired"
            )
    };


    Object
        .entries(
            values
        )
        .forEach(
            ([id, value]) => {

                if (
                    $(id)
                ) {

                    $(id).textContent =
                        value;
                }
            }
        );
}


// ============================================================
// REPORT STATUS SUMMARY
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
        "completed",
        "expired",
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
                        (
                            count /
                            total
                        ) *
                        100
                    ).toFixed(
                        1
                    )
                    : "0.0";


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td
                    class="py-3 px-4"
                >
                    ${statusBadge(
                        status
                    )}
                </td>


                <td
                    class="py-3 px-4 text-right font-bold text-slate-700"
                >
                    ${count}
                </td>


                <td
                    class="py-3 px-4 text-right text-slate-500"
                >
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
// REPORT PURPOSE SUMMARY
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
                    b[1] -
                    a[1]
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
                        (
                            count /
                            total
                        ) *
                        100
                    ).toFixed(
                        1
                    )
                    : "0.0";


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td
                    class="py-3 px-4 font-medium text-slate-700"
                >
                    ${escapeHTML(
                        purpose
                    )}
                </td>


                <td
                    class="py-3 px-4 text-right font-bold text-slate-700"
                >
                    ${count}
                </td>


                <td
                    class="py-3 px-4 text-right text-slate-500"
                >
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
// UPDATE REPORT LABELS
// ============================================================

function updateReportLabels(
    startDate,
    endDate
) {

    const rangeLabel =
        $("reportRangeLabel");


    if (
        rangeLabel
    ) {

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


        } else if (
            startDate
        ) {

            rangeLabel.textContent =
                `From ${formatDate(
                    startDate
                )}`;


        } else if (
            endDate
        ) {

            rangeLabel.textContent =
                `Up to ${formatDate(
                    endDate
                )}`;


        } else {

            rangeLabel.textContent =
                "All appointment records";
        }
    }


    if (
        $("reportGeneratedAt")
    ) {

        $("reportGeneratedAt").textContent =
            `Generated: ${new Date().toLocaleString(
                "en-PH",
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


    const startDate =
        $("reportStartDate")
            ?.value ||
        "";


    const endDate =
        $("reportEndDate")
            ?.value ||
        "";


    let reportPeriod =
        "All Appointment Records";


    if (
        startDate &&
        endDate
    ) {

        reportPeriod =
            `${formatDate(
                startDate
            )} to ${formatDate(
                endDate
            )}`;


    } else if (
        startDate
    ) {

        reportPeriod =
            `From ${formatDate(
                startDate
            )}`;


    } else if (
        endDate
    ) {

        reportPeriod =
            `Up to ${formatDate(
                endDate
            )}`;
    }


    const total =
        Number(
            $("reportTotal")
                ?.textContent ||
            0
        );


    const pending =
        Number(
            $("reportPending")
                ?.textContent ||
            0
        );


    const approved =
        Number(
            $("reportApproved")
                ?.textContent ||
            0
        );


    const rescheduled =
        Number(
            $("reportRescheduled")
                ?.textContent ||
            0
        );


    const rejected =
        Number(
            $("reportRejected")
                ?.textContent ||
            0
        );


    const cancelled =
        Number(
            $("reportCancelled")
                ?.textContent ||
            0
        );


    const completed =
        Number(
            $("reportCompleted")
                ?.textContent ||
            0
        );


    const expired =
        Number(
            $("reportExpired")
                ?.textContent ||
            0
        );


    const statusRows =
        Array.from(
            $("reportStatusSummaryBody")
                ?.querySelectorAll(
                    "tr"
                ) ||
            []
        )
            .map(
                (row) =>
                    row.outerHTML
            )
            .join(
                ""
            );


    const purposeRows =
        Array.from(
            $("reportPurposeSummaryBody")
                ?.querySelectorAll(
                    "tr"
                ) ||
            []
        )
            .map(
                (row) =>
                    row.outerHTML
            )
            .join(
                ""
            );


    const generatedAt =
        new Date()
            .toLocaleString(
                "en-PH",
                {
                    year:
                        "numeric",

                    month:
                        "long",

                    day:
                        "numeric",

                    hour:
                        "numeric",

                    minute:
                        "2-digit"
                }
            );


    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        showAdminNotice(
            "Please allow pop-ups so the appointment report can be printed.",
            "error"
        );


        return;
    }


    printWindow.document.write(`
        <!DOCTYPE html>

        <html lang="en">

        <head>

            <meta charset="UTF-8">

            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            >


            <title>
                ESSU Registrar Appointment Summary Report
            </title>


            <style>

                @page {
                    size:
                        A4 portrait;

                    margin:
                        14mm
                        15mm
                        17mm;
                }


                * {
                    box-sizing:
                        border-box;
                }


                html,
                body {
                    margin:
                        0;

                    padding:
                        0;

                    background:
                        #ffffff;

                    color:
                        #111111;

                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;
                }


                body {
                    font-size:
                        9px;
                }


                .document {
                    width:
                        100%;
                }


                .header {
                    display:
                        flex;

                    justify-content:
                        space-between;

                    align-items:
                        flex-start;

                    width:
                        100%;

                    margin-bottom:
                        18px;
                }


                .essu-wordmark {
                    width:
                        290px;

                    height:
                        auto;

                    display:
                        block;
                }


                .bagong-logo {
                    width:
                        92px;

                    height:
                        auto;

                    display:
                        block;
                }


                .title {
                    text-align:
                        center;

                    margin-bottom:
                        14px;
                }


                .title h1 {
                    margin:
                        0;

                    font-size:
                        15px;

                    font-weight:
                        700;

                    letter-spacing:
                        0.1px;
                }


                .title p {
                    margin:
                        3px
                        0
                        0;

                    font-size:
                        8.5px;
                }


                .period {
                    display:
                        inline-block;

                    margin-top:
                        5px;

                    padding:
                        3px
                        8px;

                    border:
                        1px solid
                        #d1d5db;

                    border-radius:
                        4px;

                    font-size:
                        8px;

                    font-weight:
                        700;
                }


                .summary-grid {
                    display:
                        grid;

                    grid-template-columns:
                        repeat(
                            4,
                            1fr
                        );

                    gap:
                        6px;

                    margin-bottom:
                        12px;
                }


                .summary-card {
                    border:
                        1px solid
                        #cbd5e1;

                    border-radius:
                        5px;

                    padding:
                        7px;

                    min-height:
                        46px;
                }


                .summary-label {
                    font-size:
                        7.5px;

                    color:
                        #475569;

                    margin-bottom:
                        4px;
                }


                .summary-value {
                    font-size:
                        14px;

                    font-weight:
                        700;

                    color:
                        #111827;
                }


                .summary-sections {
                    display:
                        grid;

                    grid-template-columns:
                        1fr
                        1fr;

                    gap:
                        10px;

                    align-items:
                        start;
                }


                .summary-box {
                    border:
                        1px solid
                        #d1d5db;

                    border-radius:
                        5px;

                    padding:
                        7px;

                    break-inside:
                        avoid;
                }


                .summary-box h2 {
                    margin:
                        0
                        0
                        6px;

                    font-size:
                        9px;

                    font-weight:
                        700;
                }


                table {
                    width:
                        100%;

                    border-collapse:
                        collapse;

                    font-size:
                        7.8px;

                    table-layout:
                        auto;
                }


                th,
                td {
                    border:
                        1px solid
                        #8f99a6;

                    padding:
                        4px
                        5px;

                    text-align:
                        left;

                    vertical-align:
                        middle;

                    line-height:
                        1.2;
                }


                th {
                    background:
                        #f3f4f6;

                    font-weight:
                        700;
                }


                td:nth-child(2),
                td:nth-child(3),
                th:nth-child(2),
                th:nth-child(3) {
                    text-align:
                        right;
                }


                span[class*="rounded-full"] {
                    display:
                        inline-block !important;

                    padding:
                        1px
                        4px !important;

                    border-radius:
                        999px !important;

                    font-size:
                        7px !important;

                    white-space:
                        nowrap;
                }


                .generated-info {
                    display:
                        flex;

                    justify-content:
                        space-between;

                    gap:
                        20px;

                    margin-top:
                        11px;

                    font-size:
                        7.5px;

                    color:
                        #475569;
                }


                .footer {
                    width:
                        62%;

                    margin-top:
                        20px;

                    padding-top:
                        5px;

                    border-top:
                        1px solid
                        #111111;

                    font-size:
                        8.5px;

                    line-height:
                        1.25;
                }


                @media print {

                    body {
                        -webkit-print-color-adjust:
                            exact;

                        print-color-adjust:
                            exact;
                    }


                    tr {
                        break-inside:
                            avoid;
                    }


                    .header,
                    .footer,
                    .summary-card,
                    .summary-box {
                        break-inside:
                            avoid;
                    }
                }

            </style>

        </head>


        <body>

            <div
                class="document"
            >


                <header
                    class="header"
                >

                    <img
                        src="img/header.jpg"
                        alt="Eastern Samar State University"
                        class="essu-wordmark"
                    >


                    <img
                        src="img/header bp.png"
                        alt="Bagong Pilipinas"
                        class="bagong-logo"
                    >

                </header>


                <section
                    class="title"
                >

                    <h1>
                        APPOINTMENT SUMMARY REPORT
                    </h1>


                    <p>
                        Office of the University Registrar
                    </p>


                    <div
                        class="period"
                    >
                        ${escapeHTML(
                            reportPeriod
                        )}
                    </div>

                </section>


                <section
                    class="summary-grid"
                >

                    <div class="summary-card">
                        <div class="summary-label">
                            Total
                        </div>

                        <div class="summary-value">
                            ${total}
                        </div>
                    </div>


                    <div class="summary-card">
                        <div class="summary-label">
                            Pending
                        </div>

                        <div class="summary-value">
                            ${pending}
                        </div>
                    </div>


                    <div class="summary-card">
                        <div class="summary-label">
                            Approved
                        </div>

                        <div class="summary-value">
                            ${approved}
                        </div>
                    </div>


                    <div class="summary-card">
                        <div class="summary-label">
                            Rescheduled
                        </div>

                        <div class="summary-value">
                            ${rescheduled}
                        </div>
                    </div>


                    <div class="summary-card">
                        <div class="summary-label">
                            Rejected
                        </div>

                        <div class="summary-value">
                            ${rejected}
                        </div>
                    </div>


                    <div class="summary-card">
                        <div class="summary-label">
                            Cancelled
                        </div>

                        <div class="summary-value">
                            ${cancelled}
                        </div>
                    </div>


                    <div class="summary-card">
                        <div class="summary-label">
                            Completed
                        </div>

                        <div class="summary-value">
                            ${completed}
                        </div>
                    </div>


                    <div class="summary-card">
                        <div class="summary-label">
                            Expired
                        </div>

                        <div class="summary-value">
                            ${expired}
                        </div>
                    </div>

                </section>


                <section
                    class="summary-sections"
                >

                    <div
                        class="summary-box"
                    >

                        <h2>
                            Summary by Status
                        </h2>


                        <table>

                            <thead>

                                <tr>

                                    <th>
                                        Status
                                    </th>

                                    <th>
                                        Count
                                    </th>

                                    <th>
                                        Percentage
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                ${statusRows}

                            </tbody>

                        </table>

                    </div>


                    <div
                        class="summary-box"
                    >

                        <h2>
                            Summary by Purpose
                        </h2>


                        <table>

                            <thead>

                                <tr>

                                    <th>
                                        Purpose
                                    </th>

                                    <th>
                                        Count
                                    </th>

                                    <th>
                                        Percentage
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                ${purposeRows}

                            </tbody>

                        </table>

                    </div>

                </section>


                <div
                    class="generated-info"
                >

                    <span>
                        Generated by:
                        ESSU Registrar Admin Portal
                    </span>


                    <span>
                        ${escapeHTML(
                            generatedAt
                        )}
                    </span>

                </div>


                <footer
                    class="footer"
                >

                    Borongan City 6800
                    <br>

                    Eastern Samar, Philippines
                    <br>

                    info@essu.edu.ph
                    <br>

                    https://essu.edu.ph

                </footer>

            </div>


            <script>

                window.addEventListener(
                    "load",
                    () => {

                        setTimeout(
                            () => {

                                window.focus();

                                window.print();

                            },
                            350
                        );
                    }
                );

            <\/script>

        </body>

        </html>
    `);


    printWindow.document.close();
}


// ============================================================
// ACTIVITY HISTORY EVENTS
// ============================================================

function setupHistoryEvents() {

    createHistoryFilterControls();


    $("refreshHistoryBtn")
        ?.addEventListener(
            "click",
            loadHistoryLogs
        );
}


// ============================================================
// HISTORY FILTERS
// CATEGORY REMOVED
// ============================================================

function createHistoryFilterControls() {

    if (
        $("historyFilterControls")
    ) {

        return;
    }


    const tbody =
        $("historyLogsBody");


    if (!tbody) {
        return;
    }


    const tableContainer =
        tbody.closest(
            ".overflow-x-auto"
        );


    if (!tableContainer) {
        return;
    }


    const controls =
        document.createElement(
            "div"
        );


    controls.id =
        "historyFilterControls";


    controls.className =
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4";


    controls.innerHTML = `

        <div>

            <label
                class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
                Search
            </label>


            <input
                id="historySearch"
                type="text"
                placeholder="Student, purpose, status..."
                class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f4c2e]"
            >

        </div>


        <div>

            <label
                class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
                Action
            </label>


            <select
                id="historyActionFilter"
                class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f4c2e]"
            >

                <option value="all">
                    All Actions
                </option>

                <option value="approved">
                    Approved
                </option>

                <option value="rejected">
                    Rejected
                </option>

                <option value="rescheduled">
                    Rescheduled
                </option>

                <option value="completed">
                    Completed
                </option>

                <option value="expired">
                    Expired
                </option>

                <option value="cancelled">
                    Cancelled
                </option>

            </select>

        </div>


        <div>

            <label
                class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
                Date
            </label>


            <div
                class="flex gap-2"
            >

                <input
                    id="historyDateFilter"
                    type="date"
                    class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f4c2e]"
                >


                <button
                    id="clearHistoryFiltersBtn"
                    type="button"
                    class="border border-slate-200 hover:border-[#0f4c2e] hover:text-[#0f4c2e] px-4 rounded-xl text-sm font-semibold transition"
                >
                    Clear
                </button>

            </div>

        </div>
    `;


    tableContainer
        .parentElement
        ?.insertBefore(
            controls,
            tableContainer
        );


    $("historySearch")
        ?.addEventListener(
            "input",
            () => {

                state.historyFilters.search =
                    $("historySearch")
                        ?.value
                        .trim()
                        .toLowerCase() ||
                    "";


                renderHistoryLogs();
            }
        );


    $("historyActionFilter")
        ?.addEventListener(
            "change",
            () => {

                state.historyFilters.action =
                    $("historyActionFilter")
                        ?.value ||
                    "all";


                renderHistoryLogs();
            }
        );


    $("historyDateFilter")
        ?.addEventListener(
            "change",
            () => {

                state.historyFilters.date =
                    $("historyDateFilter")
                        ?.value ||
                    "";


                renderHistoryLogs();
            }
        );


    $("clearHistoryFiltersBtn")
        ?.addEventListener(
            "click",
            () => {

                state.historyFilters = {
                    search:
                        "",

                    action:
                        "all",

                    date:
                        ""
                };


                if (
                    $("historySearch")
                ) {

                    $("historySearch").value =
                        "";
                }


                if (
                    $("historyActionFilter")
                ) {

                    $("historyActionFilter").value =
                        "all";
                }


                if (
                    $("historyDateFilter")
                ) {

                    $("historyDateFilter").value =
                        "";
                }


                renderHistoryLogs();
            }
        );
}
// ============================================================
// LOAD ACTIVITY HISTORY
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
                class="py-8 text-center text-gray-400"
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


        state.history.sort(
            (a, b) =>
                new Date(
                    b.created_at ||
                    0
                ) -
                new Date(
                    a.created_at ||
                    0
                )
        );


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
                    class="py-8 text-center text-red-500"
                >
                    ${escapeHTML(
                        error.message ||
                        "Unable to load activity history."
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
// FILTER HISTORY
// ============================================================

function getFilteredHistoryLogs() {

    const search =
        state.historyFilters
            .search ||
        "";


    const action =
        state.historyFilters
            .action ||
        "all";


    const date =
        state.historyFilters
            .date ||
        "";


    return state.history.filter(
        (log) => {

            const student =
                log.student;


            const appointment =
                log.appointment;


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


            const purpose =
                String(
                    appointment?.purpose ||
                    ""
                )
                    .toLowerCase();


            const oldStatus =
                String(
                    log.old_status ||
                    ""
                )
                    .toLowerCase();


            const newStatus =
                String(
                    log.new_status ||
                    ""
                )
                    .toLowerCase();


            const changedBy =
                String(
                    log.changed_by ||
                    ""
                )
                    .toLowerCase();


            const logDate =
                getLocalISODate(
                    log.created_at
                );


            const matchesSearch =
                !search ||
                studentName.includes(
                    search
                ) ||
                studentNumber.includes(
                    search
                ) ||
                purpose.includes(
                    search
                ) ||
                oldStatus.includes(
                    search
                ) ||
                newStatus.includes(
                    search
                ) ||
                changedBy.includes(
                    search
                );


            const matchesAction =
                action ===
                    "all" ||
                newStatus ===
                    action;


            const matchesDate =
                !date ||
                logDate ===
                    date;


            return (
                matchesSearch &&
                matchesAction &&
                matchesDate
            );
        }
    );
}


// ============================================================
// RENDER ACTIVITY HISTORY
// ============================================================

function renderHistoryLogs() {

    const tbody =
        $("historyLogsBody");


    if (!tbody) {
        return;
    }


    const logs =
        getFilteredHistoryLogs();


    if (
        logs.length ===
        0
    ) {

        tbody.innerHTML = `
            <tr>

                <td
                    colspan="6"
                    class="py-10 text-center text-gray-400"
                >

                    <i
                        class="fa-solid fa-clock-rotate-left text-2xl mb-2"
                    ></i>


                    <p
                        class="font-semibold"
                    >
                        No matching activity found.
                    </p>


                    <p
                        class="text-xs mt-1"
                    >
                        Change the search, action, or date filter.
                    </p>

                </td>

            </tr>
        `;


        return;
    }


    tbody.innerHTML =
        "";


    logs.forEach(
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


            const studentNumber =
                student?.student_number ||
                "";


            const row =
                document.createElement(
                    "tr"
                );


            row.className =
                "border-b border-gray-200 hover:bg-slate-50 transition";


            row.innerHTML = `

                <td
                    class="py-3.5 px-4 text-sm whitespace-nowrap"
                >
                    ${formatDateTime(
                        log.created_at
                    )}
                </td>


                <td
                    class="py-3.5 px-4"
                >

                    <div
                        class="font-semibold text-slate-800"
                    >
                        ${escapeHTML(
                            studentName
                        )}
                    </div>


                    ${
                        studentNumber
                            ? `
                                <div
                                    class="text-xs text-slate-400 mt-0.5"
                                >
                                    ${escapeHTML(
                                        studentNumber
                                    )}
                                </div>
                            `
                            : ""
                    }

                </td>


                <td
                    class="py-3.5 px-4"
                >
                    ${escapeHTML(
                        appointment?.purpose ||
                        "N/A"
                    )}
                </td>


                <td
                    class="py-3.5 px-4"
                >
                    ${
                        log.old_status
                            ? statusBadge(
                                String(
                                    log.old_status
                                )
                                    .toLowerCase()
                            )
                            : `
                                <span
                                    class="text-xs text-slate-400"
                                >
                                    —
                                </span>
                            `
                    }
                </td>


                <td
                    class="py-3.5 px-4"
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
                    class="py-3.5 px-4"
                >
                    ${escapeHTML(
                        formatChangedBy(
                            log.changed_by
                        )
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
// FORMAT CHANGED BY
// ============================================================

function formatChangedBy(
    value
) {

    const normalized =
        String(
            value ||
            ""
        )
            .trim();


    if (!normalized) {
        return "System";
    }


    if (
        normalized.toLowerCase() ===
        "system"
    ) {
        return "System";
    }


    if (
        normalized.toLowerCase() ===
        "student"
    ) {
        return "Student";
    }


    if (
        normalized.toLowerCase() ===
        "admin"
    ) {
        return "Administrator";
    }


    return normalized;
}


// ============================================================
// LOCAL DATE HELPERS
// ============================================================

function getLocalTodayISO() {

    const today =
        new Date();


    const year =
        today.getFullYear();


    const month =
        String(
            today.getMonth() + 1
        )
            .padStart(
                2,
                "0"
            );


    const day =
        String(
            today.getDate()
        )
            .padStart(
                2,
                "0"
            );


    return `${year}-${month}-${day}`;
}


function getLocalISODate(
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
        return "";
    }


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        )
            .padStart(
                2,
                "0"
            );


    const day =
        String(
            date.getDate()
        )
            .padStart(
                2,
                "0"
            );


    return `${year}-${month}-${day}`;
}


// ============================================================
// DATE FORMATTER
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
        "en-PH",
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


// ============================================================
// DATE / TIME FORMATTER
// ============================================================

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
        "en-PH",
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
// CAPITALIZE
// ============================================================

function capitalize(
    value
) {

    const text =
        String(
            value ||
            ""
        );


    if (!text) {
        return "";
    }


    return (
        text
            .charAt(
                0
            )
            .toUpperCase() +
        text.slice(
            1
        )
    );
}


// ============================================================
// ESCAPE HTML
// ============================================================

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

    const message =
        String(
            error?.message ||
            ""
        )
            .toLowerCase();


    if (
        message.includes(
            "unauthorized"
        ) ||
        message.includes(
            "administrator session"
        ) ||
        message.includes(
            "expired"
        )
    ) {

        showAdminNotice(
            "Your administrator session is no longer valid. Please login again.",
            "error"
        );


        setTimeout(
            () => {

                logoutAdmin(
                    false
                );

            },
            800
        );
    }
}


// ============================================================
// LOGOUT
// NO CONFIRMATION POPUP
// ============================================================

async function logoutAdmin(
    redirect = true
) {

    if (
        state.appointmentRefreshTimer
    ) {

        clearInterval(
            state.appointmentRefreshTimer
        );


        state.appointmentRefreshTimer =
            null;
    }


    try {

        await supabase.auth.signOut();


    } catch (error) {

        console.error(
            "Logout error:",
            error
        );
    }


    sessionStorage.removeItem(
        "loggedIn"
    );


    sessionStorage.removeItem(
        "role"
    );


    sessionStorage.removeItem(
        "adminEmail"
    );


    sessionStorage.removeItem(
        "adminToken"
    );


    sessionStorage.removeItem(
        "adminTokenExpiresAt"
    );


    sessionStorage.clear();


    window.location.replace(
        "login.html"
    );
}


// ============================================================
// LOGOUT BUTTON
// CLICK = IMMEDIATE LOGOUT
// ============================================================

$("adminLogoutBtn")
    ?.addEventListener(
        "click",
        async () => {

            await logoutAdmin();
        }
    );
    $("adminLogoutBtn")
    ?.addEventListener(
        "click",
        async () => {

            await logoutAdmin();
        }
    );