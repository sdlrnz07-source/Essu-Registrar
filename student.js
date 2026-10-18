import { supabase } from "./supabase.js";


// ============================================================
// TIME SLOTS
// ============================================================

const TIME_SLOTS = [
    "8:00 AM - 9:00 AM",
    "9:00 AM - 10:00 AM",
    "10:00 AM - 11:00 AM",
    "1:00 PM - 2:00 PM",
    "2:00 PM - 3:00 PM",
    "3:00 PM - 4:00 PM",
];


// ============================================================
// APP STATE
// ============================================================

const state = {

    currentUser: null,
    currentStudent: null,

    calendarMonth:
        new Date().getMonth(),

    calendarYear:
        new Date().getFullYear(),

    selectedDate: null,
    selectedSlot: null,

    bookedSlotsForDate: [],

    appointments: [],

    notifications: [],

    rescheduleTargetId: null,

};


// ============================================================
// ELEMENT HELPER
// ============================================================

const $ = (id) =>
    document.getElementById(id);


// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",

    async () => {

        const isLoggedIn =
            await loadCurrentUser();


        if (!isLoggedIn) {
            return;
        }


        // ---------------------------------------------
        // Load profile information
        // ---------------------------------------------

        renderStudentProfile();


        // ---------------------------------------------
        // Calendar
        // ---------------------------------------------

        renderCalendar();


        // ---------------------------------------------
        // Load appointments
        // ---------------------------------------------

        await loadAppointments();


        // ---------------------------------------------
        // Notifications
        // ---------------------------------------------

        await loadNotifications();


        // ---------------------------------------------
        // Additional interface events
        // ---------------------------------------------

        bindEvents();

    }
);


// ============================================================
// AUTH / STUDENT PROFILE
// ============================================================

async function loadCurrentUser() {

    try {

        if (
            sessionStorage.getItem(
                "loggedIn"
            ) !== "true" ||

            sessionStorage.getItem(
                "role"
            ) !== "student"
        ) {

            window.location.href =
                "login.html";

            return false;
        }


        const {
            data,
            error
        } =
            await supabase.auth.getSession();


        if (
            error ||
            !data?.session?.user
        ) {

            console.error(
                "No authenticated student session:",
                error
            );


            sessionStorage.clear();


            window.location.href =
                "login.html";


            return false;
        }


        state.currentUser =
            data.session.user;


        // ---------------------------------------------
        // Load student database profile
        // ---------------------------------------------

        const {
            data: student,
            error: studentError
        } =
            await supabase
                .from("students")
                .select(`
                    id,
                    first_name,
                    last_name,
                    student_number,
                    email
                `)
                .eq(
                    "email",
                    state.currentUser.email
                )
                .maybeSingle();


        if (studentError) {

            console.error(
                "Student profile query error:",
                studentError
            );


            alert(
                "Unable to load your student profile."
            );


            return false;
        }


        if (!student) {

            alert(
                "Your login account is not connected to a student profile."
            );


            return false;
        }


        state.currentStudent =
            student;


        sessionStorage.setItem(
            "studentId",
            student.id
        );


        // ---------------------------------------------
        // Greeting
        // ---------------------------------------------

        const greeting =
            $("studentGreeting");


        if (greeting) {

            const fullName =
                `${student.first_name || ""} ${student.last_name || ""}`
                    .trim();


            greeting.textContent =
                "Welcome, " +
                (
                    fullName ||
                    state.currentUser.email
                );
        }


        // ---------------------------------------------
        // Remove loader
        // ---------------------------------------------

        const loader =
            $("authLoadingScreen");


        if (loader) {
            loader.remove();
        }


        document.body.classList.add(
            "loaded"
        );


        return true;


    } catch (error) {

        console.error(
            "Auth check failed:",
            error
        );


        sessionStorage.clear();


        window.location.href =
            "login.html";


        return false;
    }
}


// ============================================================
// STUDENT PROFILE MODULE
// ============================================================

function renderStudentProfile() {

    if (
        !state.currentStudent
    ) {
        return;
    }


    const student =
        state.currentStudent;


    const fullName =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim();


    const profileName =
        $("profileFullName");


    const profileStudentNumber =
        $("profileStudentNumber");


    const profileEmail =
        $("profileEmail");


    const profileAccountStatus =
        $("profileAccountStatus");


    if (profileName) {

        profileName.textContent =
            fullName ||
            "Student";
    }


    if (profileStudentNumber) {

        profileStudentNumber.textContent =
            student.student_number ||
            "Not available";
    }


    if (profileEmail) {

        profileEmail.textContent =
            student.email ||
            state.currentUser?.email ||
            "Not available";
    }


    if (profileAccountStatus) {

        profileAccountStatus.innerHTML = `
            <span
                class="w-1.5 h-1.5 bg-green-500 rounded-full"
            ></span>

            Active
        `;
    }
}


// ============================================================
// LOGOUT
// ============================================================

$("logoutBtn")
    ?.addEventListener(

        "click",

        async () => {

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
    );


// ============================================================
// CALENDAR
// ============================================================

function renderCalendar() {

    const {
        calendarMonth,
        calendarYear
    } = state;


    const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ];


    const monthLabel =
        $("calMonthLabel");


    if (monthLabel) {

        monthLabel.textContent =
            `${monthNames[calendarMonth]} ${calendarYear}`;
    }


    const grid =
        $("calGrid");


    if (!grid) {
        return;
    }


    grid.innerHTML = "";


    const firstDay =
        new Date(
            calendarYear,
            calendarMonth,
            1
        ).getDay();


    const daysInMonth =
        new Date(
            calendarYear,
            calendarMonth + 1,
            0
        ).getDate();


    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    // ---------------------------------------------
    // Empty cells before first day
    // ---------------------------------------------

    for (
        let i = 0;
        i < firstDay;
        i++
    ) {

        grid.appendChild(
            document.createElement(
                "div"
            )
        );
    }


    // ---------------------------------------------
    // Calendar dates
    // ---------------------------------------------

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const cellDate =
            new Date(
                calendarYear,
                calendarMonth,
                day
            );


        const iso =
            toISODate(
                cellDate
            );


        const cell =
            document.createElement(
                "div"
            );


        cell.textContent =
            day;


        cell.className =
            "cal-day";


        const isPast =
            cellDate < today;


        const isWeekend =
            cellDate.getDay() === 0 ||
            cellDate.getDay() === 6;


        if (
            isPast ||
            isWeekend
        ) {

            cell.classList.add(
                "cal-disabled"
            );

        } else {

            cell.addEventListener(

                "click",

                () =>
                    selectDate(
                        iso,
                        cell
                    )
            );
        }


        if (
            toISODate(today) ===
            iso
        ) {

            cell.classList.add(
                "cal-today"
            );
        }


        if (
            state.selectedDate ===
            iso
        ) {

            cell.classList.add(
                "cal-selected"
            );
        }


        grid.appendChild(
            cell
        );
    }
}


// ============================================================
// PREVIOUS MONTH
// ============================================================

$("prevMonth")
    ?.addEventListener(

        "click",

        () => {

            state.calendarMonth--;


            if (
                state.calendarMonth < 0
            ) {

                state.calendarMonth =
                    11;


                state.calendarYear--;
            }


            renderCalendar();

        }
    );


// ============================================================
// NEXT MONTH
// ============================================================

$("nextMonth")
    ?.addEventListener(

        "click",

        () => {

            state.calendarMonth++;


            if (
                state.calendarMonth > 11
            ) {

                state.calendarMonth =
                    0;


                state.calendarYear++;
            }


            renderCalendar();

        }
    );


// ============================================================
// SELECT DATE
// ============================================================

async function selectDate(
    iso,
    cellEl
) {

    state.selectedDate =
        iso;


    state.selectedSlot =
        null;


    renderCalendar();


    if (
        $("selectedDateDisplay")
    ) {

        $("selectedDateDisplay").value =
            formatDisplayDate(
                iso
            );
    }


    if (
        $("selectedSlotDisplay")
    ) {

        $("selectedSlotDisplay").value =
            "";
    }


    await loadBookedSlots(
        iso
    );


    renderSlotGrid();
}


// ============================================================
// LOAD BOOKED SLOTS
// ============================================================

async function loadBookedSlots(
    dateISO
) {

    try {

        const {
            data,
            error
        } =
            await supabase
                .from("appointments")
                .select(
                    "appointment_time, status"
                )
                .eq(
                    "appointment_date",
                    dateISO
                )
                .neq(
                    "status",
                    "cancelled"
                )
                .neq(
                    "status",
                    "rejected"
                );


        if (error) {

            console.error(
                "Failed to load booked slots:",
                error
            );


            state.bookedSlotsForDate =
                [];


            return;
        }


        state.bookedSlotsForDate =
            (data || [])
                .map(
                    row =>
                        row.appointment_time
                );


    } catch (error) {

        console.error(
            "Unexpected booked slot error:",
            error
        );


        state.bookedSlotsForDate =
            [];
    }
}


// ============================================================
// RENDER TIME SLOTS
// ============================================================

function renderSlotGrid() {

    const container =
        $("slotGrid");


    if (!container) {
        return;
    }


    container.innerHTML =
        "";


    $("slotHint")
        ?.classList
        .add(
            "hidden"
        );


    TIME_SLOTS.forEach(
        slot => {

            const taken =
                state.bookedSlotsForDate
                    .includes(
                        slot
                    );


            const btn =
                document.createElement(
                    "div"
                );


            btn.textContent =
                slot;


            btn.className =
                "slot-btn" +
                (
                    taken
                        ? " slot-taken"
                        : ""
                );


            if (!taken) {

                btn.addEventListener(

                    "click",

                    () => {

                        state.selectedSlot =
                            slot;


                        if (
                            $("selectedSlotDisplay")
                        ) {

                            $("selectedSlotDisplay")
                                .value =
                                slot;
                        }


                        document
                            .querySelectorAll(
                                "#slotGrid .slot-btn"
                            )
                            .forEach(
                                button =>
                                    button
                                        .classList
                                        .remove(
                                            "slot-selected"
                                        )
                            );


                        btn.classList.add(
                            "slot-selected"
                        );

                    }
                );
            }


            container.appendChild(
                btn
            );
        }
    );
}


// ============================================================
// BOOK APPOINTMENT
// ============================================================

$("bookingForm")
    ?.addEventListener(

        "submit",

        async (e) => {

            e.preventDefault();


            const msg =
                $("bookingMsg");


            if (msg) {
                msg.textContent =
                    "";
            }


            const purpose =
                $("purpose")
                    ?.value;


            if (
                !purpose ||
                !state.selectedDate ||
                !state.selectedSlot
            ) {

                if (msg) {

                    msg.textContent =
                        "Please select a purpose, date, and time slot.";


                    msg.className =
                        "text-sm mt-1 text-red-600";
                }


                return;
            }


            if (
                !state.currentStudent
            ) {
                return;
            }


            try {

                // ---------------------------------------------
                // Check whether selected slot is already booked
                // ---------------------------------------------

                const {
                    data: existing,
                    error: checkError
                } =
                    await supabase
                        .from(
                            "appointments"
                        )
                        .select(
                            "id"
                        )
                        .eq(
                            "appointment_date",
                            state.selectedDate
                        )
                        .eq(
                            "appointment_time",
                            state.selectedSlot
                        )
                        .neq(
                            "status",
                            "cancelled"
                        )
                        .neq(
                            "status",
                            "rejected"
                        );


                if (checkError) {

                    console.error(
                        "Appointment slot check error:",
                        checkError
                    );
                }


                if (
                    existing &&
                    existing.length > 0
                ) {

                    if (msg) {

                        msg.textContent =
                            "This time slot has already been booked.";


                        msg.className =
                            "text-sm mt-1 text-red-600";
                    }


                    return;
                }


                // ---------------------------------------------
                // Insert appointment
                // ---------------------------------------------

                const {
                    error
                } =
                    await supabase
                        .from(
                            "appointments"
                        )
                        .insert({

                            student_id:
                                state.currentStudent.id,

                            purpose:
                                purpose,

                            appointment_date:
                                state.selectedDate,

                            appointment_time:
                                state.selectedSlot,

                            notes:
                                $("notes")
                                    ?.value ||
                                null,

                            status:
                                "pending"

                        });


                if (error) {

                    console.error(
                        "Appointment insert error:",
                        error
                    );


                    if (msg) {

                        msg.textContent =
                            "Unable to submit appointment request.";


                        msg.className =
                            "text-sm mt-1 text-red-600";
                    }


                    return;
                }


                if (msg) {

                    msg.textContent =
                        "Appointment request submitted!";


                    msg.className =
                        "text-sm mt-1 text-green-700";
                }


                $("bookingForm")
                    .reset();


                state.selectedDate =
                    null;


                state.selectedSlot =
                    null;


                if (
                    $("selectedDateDisplay")
                ) {

                    $("selectedDateDisplay").value =
                        "";
                }


                if (
                    $("selectedSlotDisplay")
                ) {

                    $("selectedSlotDisplay").value =
                        "";
                }


                if (
                    $("slotGrid")
                ) {

                    $("slotGrid").innerHTML =
                        "";
                }


                renderCalendar();


                await loadAppointments();


            } catch (error) {

                console.error(
                    "Unexpected booking error:",
                    error
                );
            }

        }
    );


// ============================================================
// LOAD STUDENT APPOINTMENTS
// ============================================================

async function loadAppointments() {

    const tbody =
        $("appointmentsBody");


    try {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "appointments"
                )
                .select("*")
                .eq(
                    "student_id",
                    state.currentStudent.id
                )
                .order(
                    "appointment_date",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "Error loading appointments:",
                error
            );


            if (tbody) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="5"
                            class="px-4 py-6 text-center text-red-500"
                        >
                            Unable to load appointments.
                        </td>
                    </tr>
                `;
            }


            return;
        }


        state.appointments =
            data || [];


        // ---------------------------------------------
        // Existing My Appointments table
        // ---------------------------------------------

        if (tbody) {

            if (
                state.appointments.length ===
                0
            ) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="5"
                            class="px-4 py-6 text-center text-gray-400"
                        >
                            No appointments yet — book one above.
                        </td>
                    </tr>
                `;

            } else {

                tbody.innerHTML =
                    state.appointments
                        .map(
                            rowHTML
                        )
                        .join("");


                attachAppointmentActionEvents();
            }
        }


        // ---------------------------------------------
        // New profile & record module
        // ---------------------------------------------

        renderRecordStatistics();

        renderAppointmentRecords();


    } catch (error) {

        console.error(
            "Unexpected appointment loading error:",
            error
        );
    }
}


// ============================================================
// ATTACH APPOINTMENT ACTION EVENTS
// ============================================================

function attachAppointmentActionEvents() {

    state.appointments
        .forEach(
            appt => {


                $(
                    `cancel-${appt.id}`
                )
                    ?.addEventListener(

                        "click",

                        () =>
                            cancelAppointment(
                                appt.id
                            )
                    );


                $(
                    `reschedule-${appt.id}`
                )
                    ?.addEventListener(

                        "click",

                        () =>
                            openRescheduleModal(
                                appt.id
                            )
                    );

            }
        );
}


// ============================================================
// APPOINTMENT ROW
// ============================================================

function rowHTML(
    appt
) {

    const status =
        (
            appt.status ||
            "pending"
        )
            .toLowerCase();


    const canModify =
        status ===
            "pending" ||

        status ===
            "approved";


    return `
        <tr
            class="border-t border-gray-100"
        >

            <td
                class="px-4 py-3"
            >
                ${formatDisplayDate(
                    appt.appointment_date
                )}
            </td>


            <td
                class="px-4 py-3"
            >
                ${escapeHTML(
                    appt.appointment_time
                )}
            </td>


            <td
                class="px-4 py-3"
            >
                ${escapeHTML(
                    appt.purpose
                )}
            </td>


            <td
                class="px-4 py-3"
            >

                <span
                    class="status-pill status-${status}"
                >
                    ${capitalize(
                        status
                    )}
                </span>

            </td>


            <td
                class="px-4 py-3 text-right space-x-2"
            >

                ${
                    canModify

                        ? `

                            <button
                                id="reschedule-${appt.id}"
                                class="text-xs font-medium text-[#0f4c2e] hover:underline"
                            >
                                Reschedule
                            </button>


                            <button
                                id="cancel-${appt.id}"
                                class="text-xs font-medium text-red-600 hover:underline"
                            >
                                Cancel
                            </button>

                        `

                        : `

                            <span
                                class="text-xs text-gray-300"
                            >
                                —
                            </span>

                        `
                }

            </td>

        </tr>
    `;
}


// ============================================================
// PROFILE / APPOINTMENT RECORD STATISTICS
// ============================================================

function renderRecordStatistics() {

    const appointments =
        state.appointments;


    const total =
        appointments.length;


    const pending =
        appointments.filter(
            appt =>
                normalizeStatus(
                    appt.status
                ) ===
                "pending"
        )
            .length;


    const approved =
        appointments.filter(
            appt =>
                normalizeStatus(
                    appt.status
                ) ===
                "approved"
        )
            .length;


    const rescheduled =
        appointments.filter(
            appt =>
                normalizeStatus(
                    appt.status
                ) ===
                "rescheduled"
        )
            .length;


    const closed =
        appointments.filter(
            appt => {

                const status =
                    normalizeStatus(
                        appt.status
                    );


                return (
                    status ===
                        "cancelled" ||

                    status ===
                        "rejected"
                );
            }
        )
            .length;


    if (
        $("recordTotal")
    ) {

        $("recordTotal").textContent =
            total;
    }


    if (
        $("recordPending")
    ) {

        $("recordPending").textContent =
            pending;
    }


    if (
        $("recordApproved")
    ) {

        $("recordApproved").textContent =
            approved;
    }


    if (
        $("recordRescheduled")
    ) {

        $("recordRescheduled").textContent =
            rescheduled;
    }


    if (
        $("recordClosed")
    ) {

        $("recordClosed").textContent =
            closed;
    }
}


// ============================================================
// APPOINTMENT RECORD SEARCH / FILTER
// ============================================================

function renderAppointmentRecords() {

    const tbody =
        $("recordsBody");


    if (!tbody) {
        return;
    }


    const searchValue =
        (
            $("recordsSearch")
                ?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    const statusFilter =
        (
            $("recordsStatusFilter")
                ?.value ||
            "all"
        )
            .toLowerCase();


    let records =
        [...state.appointments];


    // ---------------------------------------------
    // Most recent appointments first
    // ---------------------------------------------

    records.sort(
        (
            a,
            b
        ) => {

            const dateA =
                new Date(
                    `${a.appointment_date}T00:00:00`
                );


            const dateB =
                new Date(
                    `${b.appointment_date}T00:00:00`
                );


            return (
                dateB -
                dateA
            );
        }
    );


    // ---------------------------------------------
    // Search
    // ---------------------------------------------

    if (searchValue) {

        records =
            records.filter(
                appt => {

                    const purpose =
                        String(
                            appt.purpose ||
                            ""
                        )
                            .toLowerCase();


                    const notes =
                        String(
                            appt.notes ||
                            ""
                        )
                            .toLowerCase();


                    const time =
                        String(
                            appt.appointment_time ||
                            ""
                        )
                            .toLowerCase();


                    const date =
                        String(
                            appt.appointment_date ||
                            ""
                        )
                            .toLowerCase();


                    return (
                        purpose.includes(
                            searchValue
                        ) ||

                        notes.includes(
                            searchValue
                        ) ||

                        time.includes(
                            searchValue
                        ) ||

                        date.includes(
                            searchValue
                        )
                    );
                }
            );
    }


    // ---------------------------------------------
    // Status filter
    // ---------------------------------------------

    if (
        statusFilter !==
        "all"
    ) {

        records =
            records.filter(
                appt =>
                    normalizeStatus(
                        appt.status
                    ) ===
                    statusFilter
            );
    }


    // ---------------------------------------------
    // Empty state
    // ---------------------------------------------

    if (
        records.length ===
        0
    ) {

        tbody.innerHTML = `
            <tr>

                <td
                    colspan="5"
                    class="px-4 py-8 text-center text-gray-400"
                >
                    No appointment records found.
                </td>

            </tr>
        `;


        return;
    }


    // ---------------------------------------------
    // Render table rows
    // ---------------------------------------------

    tbody.innerHTML =
        records
            .map(
                appointmentRecordHTML
            )
            .join("");
}


// ============================================================
// APPOINTMENT RECORD ROW
// ============================================================

function appointmentRecordHTML(
    appt
) {

    const status =
        normalizeStatus(
            appt.status
        );


    const notes =
        appt.notes &&
        String(appt.notes)
            .trim() !== ""

            ? escapeHTML(
                appt.notes
            )

            : `<span
                   class="text-gray-300"
               >
                   No notes
               </span>`;


    return `
        <tr
            class="border-t border-gray-100 hover:bg-gray-50"
        >

            <td
                class="px-4 py-3 whitespace-nowrap"
            >
                ${formatDisplayDate(
                    appt.appointment_date
                )}
            </td>


            <td
                class="px-4 py-3 whitespace-nowrap"
            >
                ${escapeHTML(
                    appt.appointment_time ||
                    ""
                )}
            </td>


            <td
                class="px-4 py-3"
            >
                ${escapeHTML(
                    appt.purpose ||
                    ""
                )}
            </td>


            <td
                class="px-4 py-3 text-gray-600 max-w-xs"
            >
                ${notes}
            </td>


            <td
                class="px-4 py-3 whitespace-nowrap"
            >

                <span
                    class="status-pill status-${status}"
                >
                    ${capitalize(
                        status
                    )}
                </span>

            </td>

        </tr>
    `;
}


// ============================================================
// RECORD SEARCH EVENTS
// ============================================================

$("recordsSearch")
    ?.addEventListener(

        "input",

        () => {

            renderAppointmentRecords();

        }
    );


$("recordsStatusFilter")
    ?.addEventListener(

        "change",

        () => {

            renderAppointmentRecords();

        }
    );


// ============================================================
// CANCEL APPOINTMENT
// ============================================================

async function cancelAppointment(
    id
) {

    const confirmed =
        confirm(
            "Cancel this appointment?"
        );


    if (!confirmed) {
        return;
    }


    try {

        // ---------------------------------------------
        // Get current appointment
        // ---------------------------------------------

        const {
            data: appointment,
            error: fetchError
        } =
            await supabase
                .from(
                    "appointments"
                )
                .select("*")
                .eq(
                    "id",
                    id
                )
                .single();


        if (
            fetchError ||
            !appointment
        ) {

            console.error(
                "Could not fetch appointment:",
                fetchError
            );


            return;
        }


        const oldStatus =
            appointment.status ||
            "pending";


        // ---------------------------------------------
        // Update appointment
        // ---------------------------------------------

        const {
            error: updateError
        } =
            await supabase
                .from(
                    "appointments"
                )
                .update({

                    status:
                        "cancelled"

                })
                .eq(
                    "id",
                    id
                );


        if (updateError) {

            console.error(
                "Cancel appointment error:",
                updateError
            );


            alert(
                "Couldn't cancel — please try again."
            );


            return;
        }


        // ---------------------------------------------
        // Save status history
        // ---------------------------------------------

        const {
            error: historyError
        } =
            await supabase
                .from(
                    "appointment_status_history"
                )
                .insert({

                    appointment_id:
                        id,

                    old_status:
                        oldStatus,

                    new_status:
                        "cancelled",

                    changed_by:
                        state.currentUser.email

                });


        if (historyError) {

            console.error(
                "Cancel history error:",
                historyError
            );
        }


        await loadAppointments();


    } catch (error) {

        console.error(
            "Unexpected cancellation error:",
            error
        );
    }
}


// ============================================================
// OPEN RESCHEDULE MODAL
// ============================================================

function openRescheduleModal(
    id
) {

    state.rescheduleTargetId =
        id;


    if (
        $("rescheduleDate")
    ) {

        $("rescheduleDate").value =
            "";
    }


    if (
        $("rescheduleSlot")
    ) {

        $("rescheduleSlot").innerHTML =
            TIME_SLOTS
                .map(
                    slot =>
                        `
                            <option
                                value="${slot}"
                            >
                                ${slot}
                            </option>
                        `
                )
                .join("");
    }


    $("rescheduleModal")
        ?.classList
        .add(
            "open"
        );
}


// ============================================================
// CLOSE RESCHEDULE MODAL
// ============================================================

$("rescheduleCancelBtn")
    ?.addEventListener(

        "click",

        () => {

            $("rescheduleModal")
                ?.classList
                .remove(
                    "open"
                );


            state.rescheduleTargetId =
                null;

        }
    );


// ============================================================
// CONFIRM RESCHEDULE
// ============================================================

$("rescheduleConfirmBtn")
    ?.addEventListener(

        "click",

        async () => {

            const newDate =
                $("rescheduleDate")
                    ?.value;


            const newSlot =
                $("rescheduleSlot")
                    ?.value;


            if (!newDate) {

                alert(
                    "Please pick a new date."
                );


                return;
            }


            if (!newSlot) {

                alert(
                    "Please select a time slot."
                );


                return;
            }


            if (
                !state.rescheduleTargetId
            ) {
                return;
            }


            try {

                // ---------------------------------------------
                // Current appointment
                // ---------------------------------------------

                const {
                    data: appointment,
                    error: fetchError
                } =
                    await supabase
                        .from(
                            "appointments"
                        )
                        .select("*")
                        .eq(
                            "id",
                            state.rescheduleTargetId
                        )
                        .single();


                if (
                    fetchError ||
                    !appointment
                ) {

                    console.error(
                        "Could not fetch appointment:",
                        fetchError
                    );


                    return;
                }


                const oldStatus =
                    appointment.status ||
                    "pending";


                // ---------------------------------------------
                // Check selected slot
                // ---------------------------------------------

                const {
                    data: existing,
                    error: slotError
                } =
                    await supabase
                        .from(
                            "appointments"
                        )
                        .select(
                            "id"
                        )
                        .eq(
                            "appointment_date",
                            newDate
                        )
                        .eq(
                            "appointment_time",
                            newSlot
                        )
                        .neq(
                            "status",
                            "cancelled"
                        )
                        .neq(
                            "status",
                            "rejected"
                        )
                        .neq(
                            "id",
                            state.rescheduleTargetId
                        );


                if (slotError) {

                    console.error(
                        "Reschedule slot check error:",
                        slotError
                    );
                }


                if (
                    existing &&
                    existing.length > 0
                ) {

                    alert(
                        "That time slot is already booked."
                    );


                    return;
                }


                // ---------------------------------------------
                // Update appointment
                // ---------------------------------------------

                const {
                    error: updateError
                } =
                    await supabase
                        .from(
                            "appointments"
                        )
                        .update({

                            appointment_date:
                                newDate,

                            appointment_time:
                                newSlot,

                            status:
                                "pending"

                        })
                        .eq(
                            "id",
                            state.rescheduleTargetId
                        );


                if (updateError) {

                    console.error(
                        "Reschedule error:",
                        updateError
                    );


                    return;
                }


                // ---------------------------------------------
                // Status history
                // ---------------------------------------------

                const {
                    error: historyError
                } =
                    await supabase
                        .from(
                            "appointment_status_history"
                        )
                        .insert({

                            appointment_id:
                                state.rescheduleTargetId,

                            old_status:
                                oldStatus,

                            new_status:
                                "pending",

                            changed_by:
                                state.currentUser.email

                        });


                if (historyError) {

                    console.error(
                        "Reschedule history error:",
                        historyError
                    );
                }


                $("rescheduleModal")
                    ?.classList
                    .remove(
                        "open"
                    );


                state.rescheduleTargetId =
                    null;


                await loadAppointments();


                alert(
                    "Appointment rescheduled. It is now pending approval."
                );


            } catch (error) {

                console.error(
                    "Unexpected reschedule error:",
                    error
                );
            }

        }
    );


// ============================================================
// LOAD NOTIFICATIONS
// ============================================================

async function loadNotifications() {

    if (
        !state.currentStudent
    ) {
        return;
    }


    const {
        data,
        error
    } =
        await supabase
            .from(
                "notifications"
            )
            .select("*")
            .eq(
                "student_id",
                state.currentStudent.id
            )
            .order(
                "created_at",
                {
                    ascending:
                        false
                }
            );


    if (error) {

        console.error(
            "Notification loading error:",
            error
        );


        return;
    }


    state.notifications =
        data || [];


    renderNotifications();
}


// ============================================================
// RENDER NOTIFICATIONS
// ============================================================

function renderNotifications() {

    const list =
        $("notificationList");


    const badge =
        $("notificationBadge");


    if (
        !list ||
        !badge
    ) {
        return;
    }


    const unreadCount =
        state.notifications
            .filter(
                notification =>
                    notification.is_read ===
                    false
            )
            .length;


    if (
        unreadCount > 0
    ) {

        badge.textContent =
            unreadCount;


        badge.classList.remove(
            "hidden"
        );

    } else {

        badge.classList.add(
            "hidden"
        );
    }


    if (
        state.notifications.length ===
        0
    ) {

        list.innerHTML = `
            <div
                class="px-4 py-6 text-center text-xs text-gray-400"
            >
                No notifications yet.
            </div>
        `;


        return;
    }


    list.innerHTML =
        state.notifications
            .map(
                notificationHTML
            )
            .join("");


    state.notifications
        .forEach(
            notification => {

                $(
                    `notification-${notification.id}`
                )
                    ?.addEventListener(

                        "click",

                        () =>
                            markNotificationRead(
                                notification.id
                            )
                    );

            }
        );
}


// ============================================================
// NOTIFICATION HTML
// ============================================================

function notificationHTML(
    notification
) {

    const unreadClass =
        notification.is_read
            ? "bg-white"
            : "bg-green-50";


    let icon =
        "ℹ️";


    if (
        notification.type ===
        "approved"
    ) {

        icon =
            "✅";
    }


    if (
        notification.type ===
        "rejected"
    ) {

        icon =
            "❌";
    }


    if (
        notification.type ===
        "rescheduled"
    ) {

        icon =
            "📅";
    }


    return `
        <button
            id="notification-${notification.id}"
            type="button"
            class="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${unreadClass}"
        >

            <div
                class="flex gap-3"
            >

                <div
                    class="text-lg"
                >
                    ${icon}
                </div>


                <div
                    class="flex-1"
                >

                    <p
                        class="text-xs font-semibold text-gray-800"
                    >
                        ${escapeHTML(
                            notification.title
                        )}
                    </p>


                    <p
                        class="text-xs text-gray-600 mt-1"
                    >
                        ${escapeHTML(
                            notification.message
                        )}
                    </p>


                    <p
                        class="text-[10px] text-gray-400 mt-2"
                    >
                        ${formatNotificationDate(
                            notification.created_at
                        )}
                    </p>

                </div>

            </div>

        </button>
    `;
}


// ============================================================
// MARK NOTIFICATION READ
// ============================================================

async function markNotificationRead(
    id
) {

    const {
        error
    } =
        await supabase
            .from(
                "notifications"
            )
            .update({

                is_read:
                    true

            })
            .eq(
                "id",
                id
            );


    if (error) {

        console.error(
            "Unable to mark notification as read:",
            error
        );


        return;
    }


    const notification =
        state.notifications.find(
            item =>
                item.id ===
                id
        );


    if (notification) {

        notification.is_read =
            true;
    }


    renderNotifications();
}


// ============================================================
// MARK ALL READ
// ============================================================

$("markAllReadBtn")
    ?.addEventListener(

        "click",

        async () => {

            const {
                error
            } =
                await supabase
                    .from(
                        "notifications"
                    )
                    .update({

                        is_read:
                            true

                    })
                    .eq(
                        "student_id",
                        state.currentStudent.id
                    );


            if (error) {

                console.error(
                    "Mark all notifications read error:",
                    error
                );


                return;
            }


            state.notifications
                .forEach(
                    notification => {

                        notification.is_read =
                            true;

                    }
                );


            renderNotifications();

        }
    );


// ============================================================
// NOTIFICATION DROPDOWN
// ============================================================

$("notificationBtn")
    ?.addEventListener(

        "click",

        event => {

            event.stopPropagation();


            $("notificationDropdown")
                ?.classList
                .toggle(
                    "hidden"
                );

        }
    );


document.addEventListener(

    "click",

    event => {

        const dropdown =
            $("notificationDropdown");


        const button =
            $("notificationBtn");


        if (
            !dropdown ||
            !button
        ) {
            return;
        }


        if (
            !dropdown.contains(
                event.target
            ) &&

            !button.contains(
                event.target
            )
        ) {

            dropdown.classList.add(
                "hidden"
            );
        }

    }
);


// ============================================================
// HELPERS
// ============================================================

function normalizeStatus(
    status
) {

    return String(
        status ||
        "pending"
    )
        .trim()
        .toLowerCase();
}


// ============================================================
// DATE TO ISO
// ============================================================

function toISODate(
    date
) {

    const y =
        date.getFullYear();


    const m =
        String(
            date.getMonth() + 1
        )
            .padStart(
                2,
                "0"
            );


    const d =
        String(
            date.getDate()
        )
            .padStart(
                2,
                "0"
            );


    return (
        `${y}-${m}-${d}`
    );
}


// ============================================================
// DISPLAY DATE
// ============================================================

function formatDisplayDate(
    iso
) {

    if (!iso) {
        return "N/A";
    }


    const [
        y,
        m,
        d
    ] =
        iso
            .split("-")
            .map(
                Number
            );


    return new Date(
        y,
        m - 1,
        d
    )
        .toLocaleDateString(
            undefined,
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
// NOTIFICATION DATE
// ============================================================

function formatNotificationDate(
    value
) {

    if (!value) {
        return "";
    }


    return new Date(
        value
    )
        .toLocaleString();
}


// ============================================================
// CAPITALIZE
// ============================================================

function capitalize(
    value
) {

    if (!value) {
        return "";
    }


    return (
        value
            .charAt(0)
            .toUpperCase() +

        value
            .slice(1)
    );
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    return String(
        value
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


// ============================================================
// ADDITIONAL EVENT BINDING
// ============================================================

function bindEvents() {

    // ---------------------------------------------
    // Search appointment records
    // ---------------------------------------------

    $("recordsSearch")
        ?.addEventListener(

            "input",

            () => {

                renderAppointmentRecords();

            }
        );


    // ---------------------------------------------
    // Filter appointment records
    // ---------------------------------------------

    $("recordsStatusFilter")
        ?.addEventListener(

            "change",

            () => {

                renderAppointmentRecords();

            }
        );

}