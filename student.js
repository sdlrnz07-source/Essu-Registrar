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

    liveUpdatesChannel: null,
    liveRefreshTimer: null,

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
        // Profile picture + Account Settings
        // ---------------------------------------------

        await loadStudentProfilePicture();

        setupAccountSettings();


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
        // Live appointment / notification updates
        // ---------------------------------------------

        setupLiveStudentUpdates();


        // ---------------------------------------------
        // Additional interface events
        // ---------------------------------------------

        bindEvents();

    }
);


// ============================================================
// BACK / FORWARD CACHE SECURITY
// ============================================================

window.addEventListener(
    "pageshow",
    async () => {

        const loggedIn =
            sessionStorage.getItem(
                "loggedIn"
            );

        const role =
            sessionStorage.getItem(
                "role"
            );


        if (
            loggedIn !== "true" ||
            role !== "student"
        ) {

            window.location.replace(
                "login.html"
            );

            return;
        }


        try {

            const {
                data,
                error
            } =
                await supabase.auth.getSession();


            if (
                error ||
                !data?.session?.user
            ) {

                sessionStorage.clear();

                window.location.replace(
                    "login.html"
                );
            }


        } catch (error) {

            console.error(
                "Student session restore check failed:",
                error
            );

            sessionStorage.clear();

            window.location.replace(
                "login.html"
            );
        }
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

            window.location.replace(
                "login.html"
            );

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


            window.location.replace(
                "login.html"
            );


            return false;
        }


        state.currentUser =
            data.session.user;


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
                    email,
                    profile_image_url
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


        window.location.replace(
            "login.html"
        );


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
// ACCOUNT SETTINGS / PROFILE PICTURE
// ============================================================

const PROFILE_BUCKET =
    "student-profile-pictures";

const DEFAULT_PROFILE_IMAGE =
    "img/OIP.webp";


// ============================================================
// LOAD STUDENT PROFILE PICTURE
// ============================================================

async function loadStudentProfilePicture() {

    const profileAvatar =
        $("profileAvatar");

    const preview =
        $("accountProfilePreview");


    if (
        !state.currentStudent ||
        !state.currentStudent.profile_image_url
    ) {

        if (profileAvatar) {
            profileAvatar.src =
                DEFAULT_PROFILE_IMAGE;
        }

        if (preview) {
            preview.src =
                DEFAULT_PROFILE_IMAGE;
        }

        return;
    }


    try {

        const {
            data,
            error
        } =
            await supabase
                .storage
                .from(
                    PROFILE_BUCKET
                )
                .createSignedUrl(
                    state.currentStudent.profile_image_url,
                    60 * 60
                );


        if (
            error ||
            !data?.signedUrl
        ) {

            throw error ||
                new Error(
                    "Unable to create profile picture URL."
                );
        }


        if (profileAvatar) {

            profileAvatar.src =
                data.signedUrl;
        }


        if (preview) {

            preview.src =
                data.signedUrl;
        }


    } catch (error) {

        console.error(
            "Profile picture loading error:",
            error
        );


        if (profileAvatar) {

            profileAvatar.src =
                DEFAULT_PROFILE_IMAGE;
        }


        if (preview) {

            preview.src =
                DEFAULT_PROFILE_IMAGE;
        }
    }
}


// ============================================================
// ACCOUNT SETTINGS SETUP
// ============================================================

function setupAccountSettings() {

    // --------------------------------------------------------
    // Open Account Settings using the existing gear icon
    // --------------------------------------------------------

    $("accountSettingsBtn")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                openAccountSettings();
            }
        );


    // --------------------------------------------------------
    // Close only when the X button is clicked
    // --------------------------------------------------------

    $("closeAccountSettingsBtn")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                closeAccountSettings();
            }
        );


    // IMPORTANT:
    // There is intentionally NO backdrop-click listener here.
    // Clicking outside the Account Settings panel will NOT close it.
    //
    // There is also intentionally NO Escape-key listener.
    // The modal closes only through:
    // 1. the X button
    // 2. a successful password update


    // --------------------------------------------------------
    // Profile picture preview
    // --------------------------------------------------------

    $("profileImageInput")
        ?.addEventListener(
            "change",
            handleProfileImagePreview
        );


    // --------------------------------------------------------
    // Save profile picture
    // --------------------------------------------------------

    $("saveProfileImageBtn")
        ?.addEventListener(
            "click",
            saveProfilePicture
        );


    // --------------------------------------------------------
    // Remove profile picture
    // --------------------------------------------------------

    $("removeProfileImageBtn")
        ?.addEventListener(
            "click",
            removeProfilePicture
        );


    // --------------------------------------------------------
    // Change password
    // --------------------------------------------------------

    $("updatePasswordBtn")
        ?.addEventListener(
            "click",
            updateStudentPassword
        );


    // --------------------------------------------------------
    // Password visibility buttons
    // --------------------------------------------------------

    setupPasswordToggle(
        "toggleCurrentPassword",
        "currentPassword"
    );

    setupPasswordToggle(
        "toggleNewPassword",
        "newPassword"
    );

    setupPasswordToggle(
        "toggleConfirmNewPassword",
        "confirmNewPassword"
    );
}


// ============================================================
// OPEN / CLOSE ACCOUNT SETTINGS
// ============================================================

function openAccountSettings() {

    const modal =
        $("accountSettingsModal");


    if (!modal) {
        return;
    }


    clearAccountSettingsMessages();


    if (
        $("profileImageInput")
    ) {

        $("profileImageInput").value =
            "";
    }


    loadStudentProfilePicture();


    modal.classList.remove(
        "hidden"
    );

    modal.classList.add(
        "flex"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );
}


function closeAccountSettings() {

    const modal =
        $("accountSettingsModal");


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );

    modal.classList.remove(
        "flex"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    [
        "currentPassword",
        "newPassword",
        "confirmNewPassword"
    ]
        .forEach(
            id => {

                if ($(id)) {
                    $(id).value =
                        "";
                }
            }
        );


    clearAccountSettingsMessages();
}


// ============================================================
// ACCOUNT SETTINGS MESSAGES
// ============================================================

function clearAccountSettingsMessages() {

    [
        "profileImageMessage",
        "passwordSettingsMessage"
    ]
        .forEach(
            id => {

                const element =
                    $(id);


                if (!element) {
                    return;
                }


                element.textContent =
                    "";

                element.className =
                    "hidden mt-3 text-xs rounded-md px-3 py-2";
            }
        );
}


function showAccountSettingsMessage(
    elementId,
    message,
    type =
        "success"
) {

    const element =
        $(elementId);


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        "mt-3 text-xs rounded-md px-3 py-2 border";


    if (
        type ===
        "error"
    ) {

        element.classList.add(
            "bg-red-50",
            "text-red-700",
            "border-red-200"
        );


    } else {

        element.classList.add(
            "bg-green-50",
            "text-green-700",
            "border-green-200"
        );
    }
}


// ============================================================
// PASSWORD VISIBILITY
// ============================================================

function setupPasswordToggle(
    buttonId,
    inputId
) {

    const button =
        $(buttonId);

    const input =
        $(inputId);


    if (
        !button ||
        !input
    ) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            const showPassword =
                input.type ===
                "password";


            input.type =
                showPassword
                    ? "text"
                    : "password";


            button.innerHTML =
                showPassword
                    ? '<i class="fa-regular fa-eye-slash"></i>'
                    : '<i class="fa-regular fa-eye"></i>';


            const label =
                showPassword
                    ? "Hide password"
                    : "Show password";


            button.setAttribute(
                "aria-label",
                label
            );

            button.setAttribute(
                "title",
                label
            );
        }
    );
}


// ============================================================
// PROFILE IMAGE PREVIEW
// ============================================================

function handleProfileImagePreview(
    event
) {

    const file =
        event.target
            ?.files?.[0];


    if (!file) {
        return;
    }


    if (
        !validateProfileImage(
            file
        )
    ) {

        event.target.value =
            "";

        return;
    }


    const preview =
        $("accountProfilePreview");


    if (!preview) {
        return;
    }


    const reader =
        new FileReader();


    reader.onload =
        readerEvent => {

            preview.src =
                readerEvent.target.result;
        };


    reader.readAsDataURL(
        file
    );
}


function validateProfileImage(
    file
) {

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        showAccountSettingsMessage(
            "profileImageMessage",
            "Please select a JPG, PNG, or WEBP image.",
            "error"
        );

        return false;
    }


    if (
        file.size >
        5 * 1024 * 1024
    ) {

        showAccountSettingsMessage(
            "profileImageMessage",
            "Profile picture must be 5 MB or smaller.",
            "error"
        );

        return false;
    }


    return true;
}
// ============================================================
// SAVE PROFILE PICTURE
// ============================================================

async function saveProfilePicture() {

    const file =
        $("profileImageInput")
            ?.files?.[0];


    if (!file) {

        showAccountSettingsMessage(
            "profileImageMessage",
            "Please choose an image first.",
            "error"
        );

        return;
    }


    if (
        !validateProfileImage(
            file
        )
    ) {
        return;
    }


    if (
        !state.currentUser ||
        !state.currentStudent
    ) {
        return;
    }


    const saveButton =
        $("saveProfileImageBtn");


    if (saveButton) {

        saveButton.disabled =
            true;

        saveButton.classList.add(
            "opacity-50",
            "pointer-events-none"
        );
    }


    try {

        const extensionMap = {
            "image/jpeg":
                "jpg",
            "image/png":
                "png",
            "image/webp":
                "webp"
        };


        const extension =
            extensionMap[
                file.type
            ] ||
            "jpg";


        const newPath =
            `${state.currentUser.id}/profile.${extension}`;


        const oldPath =
            state.currentStudent
                .profile_image_url ||
            null;


        const {
            error: uploadError
        } =
            await supabase
                .storage
                .from(
                    PROFILE_BUCKET
                )
                .upload(
                    newPath,
                    file,
                    {
                        cacheControl:
                            "3600",

                        upsert:
                            true,

                        contentType:
                            file.type
                    }
                );


        if (uploadError) {
            throw uploadError;
        }


        const {
            error: updateError
        } =
            await supabase
                .from(
                    "students"
                )
                .update({
                    profile_image_url:
                        newPath
                })
                .eq(
                    "id",
                    state.currentStudent.id
                );


        if (updateError) {

            await supabase
                .storage
                .from(
                    PROFILE_BUCKET
                )
                .remove([
                    newPath
                ]);


            throw updateError;
        }


        if (
            oldPath &&
            oldPath !==
                newPath
        ) {

            const {
                error: removeOldError
            } =
                await supabase
                    .storage
                    .from(
                        PROFILE_BUCKET
                    )
                    .remove([
                        oldPath
                    ]);


            if (removeOldError) {

                console.warn(
                    "Old profile picture could not be removed:",
                    removeOldError
                );
            }
        }


        state.currentStudent
            .profile_image_url =
            newPath;


        if (
            $("profileImageInput")
        ) {

            $("profileImageInput").value =
                "";
        }


        await loadStudentProfilePicture();


        showAccountSettingsMessage(
            "profileImageMessage",
            "Profile picture updated successfully."
        );


    } catch (error) {

        console.error(
            "Profile picture upload error:",
            error
        );


        showAccountSettingsMessage(
            "profileImageMessage",
            error.message ||
                "Unable to update profile picture.",
            "error"
        );


    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.classList.remove(
                "opacity-50",
                "pointer-events-none"
            );
        }
    }
}


// ============================================================
// REMOVE PROFILE PICTURE
// ============================================================

async function removeProfilePicture() {

    if (
        !state.currentStudent
    ) {
        return;
    }


    const currentPath =
        state.currentStudent
            .profile_image_url;


    if (!currentPath) {

        showAccountSettingsMessage(
            "profileImageMessage",
            "No custom profile picture is currently saved.",
            "error"
        );

        return;
    }


    const removeButton =
        $("removeProfileImageBtn");


    if (removeButton) {

        removeButton.disabled =
            true;

        removeButton.classList.add(
            "opacity-50",
            "pointer-events-none"
        );
    }


    try {

        const {
            error: storageError
        } =
            await supabase
                .storage
                .from(
                    PROFILE_BUCKET
                )
                .remove([
                    currentPath
                ]);


        if (storageError) {
            throw storageError;
        }


        const {
            error: updateError
        } =
            await supabase
                .from(
                    "students"
                )
                .update({
                    profile_image_url:
                        null
                })
                .eq(
                    "id",
                    state.currentStudent.id
                );


        if (updateError) {
            throw updateError;
        }


        state.currentStudent
            .profile_image_url =
            null;


        if (
            $("profileAvatar")
        ) {

            $("profileAvatar").src =
                DEFAULT_PROFILE_IMAGE;
        }


        if (
            $("accountProfilePreview")
        ) {

            $("accountProfilePreview").src =
                DEFAULT_PROFILE_IMAGE;
        }


        if (
            $("profileImageInput")
        ) {

            $("profileImageInput").value =
                "";
        }


        showAccountSettingsMessage(
            "profileImageMessage",
            "Profile picture removed successfully."
        );


    } catch (error) {

        console.error(
            "Remove profile picture error:",
            error
        );


        showAccountSettingsMessage(
            "profileImageMessage",
            error.message ||
                "Unable to remove profile picture.",
            "error"
        );


    } finally {

        if (removeButton) {

            removeButton.disabled =
                false;

            removeButton.classList.remove(
                "opacity-50",
                "pointer-events-none"
            );
        }
    }
}


// ============================================================
// CHANGE PASSWORD
// ============================================================

async function updateStudentPassword() {

    const currentPassword =
        $("currentPassword")
            ?.value ||
        "";

    const newPassword =
        $("newPassword")
            ?.value ||
        "";

    const confirmPassword =
        $("confirmNewPassword")
            ?.value ||
        "";


    // ========================================================
    // REQUIRED FIELDS
    // ========================================================

    if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
    ) {

        showAccountSettingsMessage(
            "passwordSettingsMessage",
            "Please complete all password fields.",
            "error"
        );

        return;
    }


    // ========================================================
    // STRONG PASSWORD VALIDATION
    // ========================================================
    //
    // Requirements:
    // 1. Must start with an uppercase letter
    // 2. Must contain at least one lowercase letter
    // 3. Must contain at least one number
    // 4. Must contain at least one special character
    // 5. Must be at least 8 characters long
    // ========================================================

    const passwordPattern =
        /^[A-Z](?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{7,}$/;


    if (
        !passwordPattern.test(
            newPassword
        )
    ) {

        showAccountSettingsMessage(
            "passwordSettingsMessage",
            "Password must start with an uppercase letter, contain at least one lowercase letter, one number, one special character, and be at least 8 characters long.",
            "error"
        );

        return;
    }


    // ========================================================
    // CONFIRM PASSWORD
    // ========================================================

    if (
        newPassword !==
        confirmPassword
    ) {

        showAccountSettingsMessage(
            "passwordSettingsMessage",
            "New password and confirmation do not match.",
            "error"
        );

        return;
    }


    // ========================================================
    // NEW PASSWORD MUST BE DIFFERENT
    // ========================================================

    if (
        currentPassword ===
        newPassword
    ) {

        showAccountSettingsMessage(
            "passwordSettingsMessage",
            "Your new password must be different from your current password.",
            "error"
        );

        return;
    }


    const updateButton =
        $("updatePasswordBtn");


    if (updateButton) {

        updateButton.disabled =
            true;

        updateButton.classList.add(
            "opacity-50",
            "pointer-events-none"
        );
    }


    try {

        const email =
            state.currentUser
                ?.email ||
            state.currentStudent
                ?.email;


        // ====================================================
        // AUTHENTICATE CURRENT PASSWORD
        // ====================================================

        const {
            error: verifyError
        } =
            await supabase
                .auth
                .signInWithPassword({
                    email,
                    password:
                        currentPassword
                });


        if (verifyError) {

            showAccountSettingsMessage(
                "passwordSettingsMessage",
                "Current password is incorrect.",
                "error"
            );

            return;
        }


        // ====================================================
        // UPDATE PASSWORD THROUGH SUPABASE AUTH
        // ====================================================

        const {
            error: updateError
        } =
            await supabase
                .auth
                .updateUser({
                    password:
                        newPassword
                });


        if (updateError) {

            throw updateError;
        }


        // ====================================================
        // CLEAR PASSWORD FIELDS
        // ====================================================

        [
            "currentPassword",
            "newPassword",
            "confirmNewPassword"
        ]
            .forEach(
                id => {

                    if ($(id)) {

                        $(id).value =
                            "";
                    }
                }
            );


        showAccountSettingsMessage(
            "passwordSettingsMessage",
            "Password updated successfully."
        );


        // Close Account Settings only after a successful
        // password update. The short delay lets the student
        // see the confirmation message first.
        setTimeout(
            () => {

                closeAccountSettings();

            },
            900
        );


    } catch (error) {

        console.error(
            "Password update error:",
            error
        );


        showAccountSettingsMessage(
            "passwordSettingsMessage",
            error.message ||
                "Unable to update password.",
            "error"
        );


    } finally {

        if (updateButton) {

            updateButton.disabled =
                false;

            updateButton.classList.remove(
                "opacity-50",
                "pointer-events-none"
            );
        }
    }
}

// ============================================================
// LOGOUT
// ============================================================

$("logoutBtn")
    ?.addEventListener(

        "click",

        async () => {

            stopLiveStudentUpdates();


            try {

                await supabase.auth.signOut();

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );
            }


            sessionStorage.clear();


            window.location.replace(
                "login.html"
            );

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
                            colspan="6"
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
        // My Appointments
        // Show only active/current appointments.
        // ---------------------------------------------

        const activeAppointments =
            state.appointments.filter(
                isCurrentAppointment
            );


        if (tbody) {

            if (
                activeAppointments.length ===
                0
            ) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="6"
                            class="px-4 py-6 text-center text-gray-400"
                        >
                            No current appointments.
                        </td>
                    </tr>
                `;

            } else {

                tbody.innerHTML =
                    activeAppointments
                        .map(
                            rowHTML
                        )
                        .join("");


                attachAppointmentActionEvents(
                    activeAppointments
                );
            }
        }


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

function attachAppointmentActionEvents(
    appointments =
        state.appointments
) {

    appointments
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
// CHECK IF APPOINTMENT IS CURRENT
// ============================================================

function isCurrentAppointment(
    appt
) {

    const status =
        normalizeStatus(
            appt.status
        );


    const activeStatuses = [
        "pending",
        "approved",
        "rescheduled"
    ];


    if (
        !activeStatuses.includes(
            status
        )
    ) {

        return false;
    }


    if (
        !appt.appointment_date
    ) {

        return false;
    }


    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    const appointmentDate =
        new Date(
            `${appt.appointment_date}T00:00:00`
        );


    if (
        Number.isNaN(
            appointmentDate.getTime()
        )
    ) {

        return false;
    }


    return (
        appointmentDate >=
        today
    );
}


// ============================================================
// MY APPOINTMENTS ROW
// ============================================================

function rowHTML(
    appt
) {

    const status =
        normalizeStatus(
            appt.status
        );


    let actionsHTML = `
        <span class="text-xs text-gray-300">
            —
        </span>
    `;


    if (
        status ===
        "pending"
    ) {

        actionsHTML = `
            <button
                id="reschedule-${appt.id}"
                type="button"
                class="text-xs font-medium text-[#0f4c2e] hover:underline"
            >
                Reschedule
            </button>

            <button
                id="cancel-${appt.id}"
                type="button"
                class="text-xs font-medium text-red-600 hover:underline"
            >
                Cancel
            </button>
        `;
    }


    if (
        status ===
        "approved"
    ) {

        actionsHTML = `
            <button
                id="reschedule-${appt.id}"
                type="button"
                class="text-xs font-medium text-[#0f4c2e] hover:underline"
            >
                Reschedule
            </button>
        `;
    }


    if (
        status ===
        "rescheduled"
    ) {

        actionsHTML = `
            <span class="text-xs text-gray-400">
                Awaiting review
            </span>
        `;
    }


    return `
        <tr
            class="border-t border-gray-100 hover:bg-gray-50 transition"
        >

            <td class="px-3 py-3 align-middle">
                ${formatCreatedAt(
                    appt.created_at
                )}
            </td>

            <td class="px-3 py-3 whitespace-nowrap">
                ${formatDisplayDate(
                    appt.appointment_date
                )}
            </td>

            <td class="px-3 py-3 whitespace-nowrap">
                ${escapeHTML(
                    appt.appointment_time ||
                    ""
                )}
            </td>

            <td class="px-3 py-3">
                ${escapeHTML(
                    appt.purpose ||
                    ""
                )}
            </td>

            <td class="px-3 py-3 whitespace-nowrap">
                <span
                    class="status-pill status-${status}"
                >
                    ${capitalize(
                        status
                    )}
                </span>
            </td>

            <td
                class="px-3 py-3 text-right space-x-2 whitespace-nowrap"
            >
                ${actionsHTML}
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


    records.sort(
        (
            a,
            b
        ) => {

            const timeA =
                new Date(
                    a.created_at ||
                    0
                )
                    .getTime();

            const timeB =
                new Date(
                    b.created_at ||
                    0
                )
                    .getTime();


            return (
                timeB -
                timeA
            );
        }
    );


    if (searchValue) {

        records =
            records.filter(
                appt => {

                    const values = [
                        appt.purpose,
                        appt.notes,
                        appt.appointment_time,
                        appt.appointment_date,
                        normalizeStatus(
                            appt.status
                        ),
                        appt.created_at
                            ? new Date(
                                appt.created_at
                            )
                                .toLocaleString(
                                    "en-PH"
                                )
                            : ""
                    ];


                    return values
                        .some(
                            value =>
                                String(
                                    value ||
                                    ""
                                )
                                    .toLowerCase()
                                    .includes(
                                        searchValue
                                    )
                        );
                }
            );
    }


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


    if (
        records.length ===
        0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="px-4 py-8 text-center text-gray-400"
                >
                    No appointment records found.
                </td>
            </tr>
        `;


        return;
    }


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
        String(
            appt.notes
        )
            .trim() !==
            ""

            ? escapeHTML(
                appt.notes
            )

            : `
                <span class="text-gray-300">
                    No notes
                </span>
            `;


    return `
        <tr
            class="border-t border-gray-100 hover:bg-gray-50 transition"
        >

            <td class="px-4 py-3 align-middle">
                ${formatCreatedAt(
                    appt.created_at
                )}
            </td>

            <td class="px-4 py-3 whitespace-nowrap">
                ${formatDisplayDate(
                    appt.appointment_date
                )}
            </td>

            <td class="px-4 py-3 whitespace-nowrap">
                ${escapeHTML(
                    appt.appointment_time ||
                    ""
                )}
            </td>

            <td class="px-4 py-3">
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

            <td class="px-4 py-3 whitespace-nowrap">
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


        await sendStudentAppointmentEmail(
            appointment,
            "cancelled"
        );


        await loadAppointments();


    } catch (error) {

        console.error(
            "Unexpected cancellation error:",
            error
        );
    }
}


// ============================================================
// STUDENT EMAIL NOTIFICATION
// ============================================================

async function sendStudentAppointmentEmail(
    appointment,
    status
) {

    try {

        if (
            !appointment ||
            !state.currentStudent?.email
        ) {
            return false;
        }


        const studentName =
            `${state.currentStudent.first_name || ""} ${state.currentStudent.last_name || ""}`
                .trim() ||
            "Student";


        const {
            data,
            error
        } =
            await supabase
                .functions
                .invoke(
                    "send-appointment-email",
                    {
                        body: {

                            email:
                                state.currentStudent.email,

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
                "Student email notification error:",
                error
            );


            return false;
        }


        console.log(
            "Student email result:",
            data
        );


        return true;


    } catch (error) {

        console.error(
            "Student email notification failed:",
            error
        );


        return false;
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
        data ||
        [];


    renderNotifications();


    renderMessages();
}


// ============================================================
// FONT AWESOME NOTIFICATION ICON
// ============================================================

function getNotificationIcon(
    type
) {

    const normalized =
        String(
            type ||
            ""
        )
            .trim()
            .toLowerCase();


    const icons = {

        approved:
            '<i class="fa-solid fa-circle-check text-green-600"></i>',

        rejected:
            '<i class="fa-solid fa-circle-xmark text-red-600"></i>',

        rescheduled:
            '<i class="fa-solid fa-calendar-days text-purple-600"></i>',

        cancelled:
            '<i class="fa-solid fa-circle-minus text-red-500"></i>',

        completed:
            '<i class="fa-solid fa-check text-green-700"></i>',

        expired:
            '<i class="fa-regular fa-clock text-slate-500"></i>',

        pending:
            '<i class="fa-regular fa-clock text-amber-600"></i>'

    };


    return (
        icons[
            normalized
        ] ||
        '<i class="fa-solid fa-circle-info text-slate-500"></i>'
    );
}


// ============================================================
// RENDER UNREAD NOTIFICATIONS
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


    const unreadNotifications =
        state.notifications
            .filter(
                notification =>
                    notification.is_read ===
                    false
            );


    if (
        unreadNotifications.length >
        0
    ) {

        badge.textContent =
            unreadNotifications.length;


        badge.classList.remove(
            "hidden"
        );


    } else {

        badge.textContent =
            "0";


        badge.classList.add(
            "hidden"
        );
    }


    if (
        unreadNotifications.length ===
        0
    ) {

        list.innerHTML = `
            <div class="px-4 py-7 text-center">

                <i
                    class="fa-solid fa-circle-check text-[#0f4c2e] text-xl"
                ></i>

                <p
                    class="text-xs font-semibold text-gray-500 mt-2"
                >
                    You're all caught up.
                </p>

                <p
                    class="text-[10px] text-gray-400 mt-1"
                >
                    Read messages remain available in Mail.
                </p>

            </div>
        `;


        return;
    }


    list.innerHTML =
        unreadNotifications
            .map(
                notification =>
                    notificationHTML(
                        notification
                    )
            )
            .join("");
}


// ============================================================
// UNREAD NOTIFICATION HTML
// ============================================================

function notificationHTML(
    notification
) {

    return `
        <div
            id="notification-${notification.id}"
            class="px-4 py-3 border-b border-gray-100 bg-green-50 hover:bg-green-100 transition"
        >

            <div class="flex gap-3">

                <div
                    class="text-lg flex-shrink-0 pt-0.5"
                >
                    ${getNotificationIcon(
                        notification.type
                    )}
                </div>


                <div
                    class="flex-1 min-w-0"
                >

                    <p
                        class="text-xs font-semibold text-gray-800"
                    >
                        ${escapeHTML(
                            notification.title ||
                            "Appointment Update"
                        )}
                    </p>


                    <p
                        class="text-xs text-gray-600 mt-1 leading-relaxed"
                    >
                        ${escapeHTML(
                            notification.message ||
                            ""
                        )}
                    </p>


                    <div
                        class="flex items-center justify-between gap-3 mt-2"
                    >

                        <p
                            class="text-[10px] text-gray-400"
                        >
                            ${formatNotificationDate(
                                notification.created_at
                            )}
                        </p>


                        <button
                            type="button"
                            class="markNotificationReadBtn text-[10px] font-semibold text-[#0f4c2e] hover:underline whitespace-nowrap"
                            data-id="${notification.id}"
                        >
                            Mark as read
                        </button>

                    </div>

                </div>

            </div>

        </div>
    `;
}


// ============================================================
// RENDER MESSAGE HISTORY
// ============================================================

function renderMessages() {

    const list =
        $("messageList");


    if (!list) {
        return;
    }


    if (
        state.notifications.length ===
        0
    ) {

        list.innerHTML = `
            <div class="px-4 py-7 text-center">

                <i
                    class="fa-regular fa-envelope text-[#0f4c2e] text-xl"
                ></i>

                <p
                    class="text-xs font-semibold text-gray-500 mt-2"
                >
                    No messages yet.
                </p>

                <p
                    class="text-[10px] text-gray-400 mt-1"
                >
                    Appointment updates will appear here.
                </p>

            </div>
        `;


        return;
    }


    list.innerHTML =
        state.notifications
            .map(
                messageHistoryHTML
            )
            .join("");
}


// ============================================================
// MESSAGE HISTORY HTML
// ============================================================

function messageHistoryHTML(
    notification
) {

    const readLabel =
        notification.is_read
            ? "Read"
            : "Unread";


    const readClass =
        notification.is_read
            ? "text-gray-400"
            : "text-[#0f4c2e]";


    return `
        <div
            class="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition"
        >

            <div class="flex gap-3">

                <div
                    class="text-lg flex-shrink-0 pt-0.5"
                >
                    ${getNotificationIcon(
                        notification.type
                    )}
                </div>


                <div
                    class="flex-1 min-w-0"
                >

                    <div
                        class="flex items-start justify-between gap-3"
                    >

                        <p
                            class="text-xs font-semibold text-gray-800"
                        >
                            ${escapeHTML(
                                notification.title ||
                                "Appointment Update"
                            )}
                        </p>


                        <span
                            class="text-[9px] font-semibold ${readClass} whitespace-nowrap"
                        >
                            ${readLabel}
                        </span>

                    </div>


                    <p
                        class="text-xs text-gray-600 mt-1 leading-relaxed"
                    >
                        ${escapeHTML(
                            notification.message ||
                            ""
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

        </div>
    `;
}


// ============================================================
// MARK ONE NOTIFICATION READ
// ============================================================

async function markNotificationRead(
    id
) {

    if (
        !id ||
        !state.currentStudent
    ) {
        return;
    }


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
            )
            .eq(
                "student_id",
                state.currentStudent.id
            );


    if (error) {

        console.error(
            "Unable to mark notification as read:",
            error
        );


        return;
    }


    const notification =
        state.notifications
            .find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        id
                    )
            );


    if (notification) {

        notification.is_read =
            true;
    }


    renderNotifications();


    renderMessages();
}


// ============================================================
// MARK AS READ BUTTON
// ============================================================

document.addEventListener(

    "click",

    async event => {

        const button =
            event.target
                .closest(
                    ".markNotificationReadBtn"
                );


        if (!button) {
            return;
        }


        event.preventDefault();


        event.stopPropagation();


        await markNotificationRead(
            button.dataset.id
        );

    }
);


// ============================================================
// MARK ALL READ
// ============================================================

$("markAllReadBtn")
    ?.addEventListener(

        "click",

        async event => {

            event.stopPropagation();


            if (
                !state.currentStudent
            ) {
                return;
            }


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
                    )
                    .eq(
                        "is_read",
                        false
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


            renderMessages();

        }
    );


// ============================================================
// BELL DROPDOWN
// ============================================================

$("notificationBtn")
    ?.addEventListener(

        "click",

        event => {

            event.stopPropagation();


            $("messageDropdown")
                ?.classList
                .add(
                    "hidden"
                );


            $("notificationDropdown")
                ?.classList
                .toggle(
                    "hidden"
                );

        }
    );


// ============================================================
// MAIL DROPDOWN
// ============================================================

$("messageBtn")
    ?.addEventListener(

        "click",

        event => {

            event.stopPropagation();


            $("notificationDropdown")
                ?.classList
                .add(
                    "hidden"
                );


            $("messageDropdown")
                ?.classList
                .toggle(
                    "hidden"
                );


            renderMessages();

        }
    );


// ============================================================
// CLOSE NOTIFICATION / MAIL DROPDOWNS
// ============================================================

document.addEventListener(

    "click",

    event => {

        const notificationDropdown =
            $("notificationDropdown");


        const notificationButton =
            $("notificationBtn");


        const messageDropdown =
            $("messageDropdown");


        const messageButton =
            $("messageBtn");


        const clickedNotificationArea =
            (
                notificationDropdown &&
                notificationDropdown.contains(
                    event.target
                )
            ) ||
            (
                notificationButton &&
                notificationButton.contains(
                    event.target
                )
            );


        const clickedMessageArea =
            (
                messageDropdown &&
                messageDropdown.contains(
                    event.target
                )
            ) ||
            (
                messageButton &&
                messageButton.contains(
                    event.target
                )
            );


        if (
            !clickedNotificationArea
        ) {

            notificationDropdown
                ?.classList
                .add(
                    "hidden"
                );
        }


        if (
            !clickedMessageArea
        ) {

            messageDropdown
                ?.classList
                .add(
                    "hidden"
                );
        }

    }
);
// ============================================================
// LIVE STUDENT UPDATES
// ============================================================

function setupLiveStudentUpdates() {

    if (
        !state.currentStudent
    ) {
        return;
    }


    stopLiveStudentUpdates();


    const studentId =
        state.currentStudent.id;


    state.liveUpdatesChannel =
        supabase
            .channel(
                `student-dashboard-${studentId}`
            )
            .on(
                "postgres_changes",
                {
                    event:
                        "*",

                    schema:
                        "public",

                    table:
                        "appointments",

                    filter:
                        `student_id=eq.${studentId}`
                },

                async () => {

                    await loadAppointments();
                }
            )
            .on(
                "postgres_changes",
                {
                    event:
                        "*",

                    schema:
                        "public",

                    table:
                        "notifications",

                    filter:
                        `student_id=eq.${studentId}`
                },

                async () => {

                    await loadNotifications();
                }
            )
            .subscribe(
                status => {

                    console.log(
                        "Student realtime status:",
                        status
                    );
                }
            );


    // ---------------------------------------------
    // Polling fallback
    // ---------------------------------------------

    state.liveRefreshTimer =
        setInterval(

            async () => {

                if (
                    document.visibilityState !==
                    "visible"
                ) {
                    return;
                }


                try {

                    await Promise.all([
                        loadAppointments(),
                        loadNotifications()
                    ]);


                } catch (error) {

                    console.warn(
                        "Student fallback refresh failed:",
                        error
                    );
                }

            },

            3000
        );
}


// ============================================================
// STOP LIVE STUDENT UPDATES
// ============================================================

function stopLiveStudentUpdates() {

    if (
        state.liveRefreshTimer
    ) {

        clearInterval(
            state.liveRefreshTimer
        );


        state.liveRefreshTimer =
            null;
    }


    if (
        state.liveUpdatesChannel
    ) {

        try {

            supabase.removeChannel(
                state.liveUpdatesChannel
            );


        } catch (error) {

            console.warn(
                "Unable to remove student realtime channel:",
                error
            );
        }


        state.liveUpdatesChannel =
            null;
    }
}


// ============================================================
// REFRESH WHEN TAB BECOMES VISIBLE
// ============================================================

document.addEventListener(

    "visibilitychange",

    async () => {

        if (
            document.visibilityState !==
                "visible" ||

            !state.currentStudent
        ) {

            return;
        }


        try {

            await Promise.all([
                loadAppointments(),
                loadNotifications()
            ]);


        } catch (error) {

            console.warn(
                "Student visibility refresh failed:",
                error
            );
        }

    }
);


// ============================================================
// CLEAN UP REALTIME ON PAGE EXIT
// ============================================================

window.addEventListener(

    "beforeunload",

    stopLiveStudentUpdates
);


// ============================================================
// HELPERS
// ============================================================


// ============================================================
// NORMALIZE STATUS
// ============================================================

function normalizeStatus(
    status
) {

    return String(
        status ||
        ""
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
// CREATED AT
// ============================================================

function formatCreatedAt(
    value
) {

    if (!value) {

        return `
            <div class="text-gray-400">
                Unknown
            </div>
        `;
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

        return `
            <div class="text-gray-400">
                Unknown
            </div>
        `;
    }


    const dateText =
        date.toLocaleDateString(
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


    const timeText =
        date.toLocaleTimeString(
            "en-PH",
            {
                hour:
                    "numeric",

                minute:
                    "2-digit"
            }
        );


    return `
        <div class="whitespace-nowrap">
            ${escapeHTML(
                dateText
            )}
        </div>

        <div
            class="text-[11px] text-gray-400 mt-0.5 whitespace-nowrap"
        >
            ${escapeHTML(
                timeText
            )}
        </div>
    `;
}


// ============================================================
// DISPLAY DATE
// ============================================================

function formatDisplayDate(
    iso
) {

    if (!iso) {
        return "";
    }


    const parts =
        String(
            iso
        )
            .split("-");


    if (
        parts.length !==
        3
    ) {

        return iso;
    }


    const year =
        Number(
            parts[0]
        );


    const month =
        Number(
            parts[1]
        );


    const day =
        Number(
            parts[2]
        );


    const date =
        new Date(
            year,
            month - 1,
            day
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return iso;
    }


    return date
        .toLocaleDateString(
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
// NOTIFICATION DATE
// ============================================================

function formatNotificationDate(
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


    return date
        .toLocaleString(
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
        text.charAt(0)
            .toUpperCase() +
        text.slice(1)
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
// ADDITIONAL INTERFACE EVENTS
// ============================================================

function bindEvents() {

    // Most event listeners are already attached
    // directly to their related controls above.
    // This function remains here for startup compatibility.

}