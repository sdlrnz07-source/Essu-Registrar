import { supabase } from "./supabase.js";

const TIME_SLOTS = [
  "8:00 AM - 9:00 AM",
  "9:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "1:00 PM - 2:00 PM",
  "2:00 PM - 3:00 PM",
  "3:00 PM - 4:00 PM",
];

const state = {
  currentUser: null,
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  selectedDate: null,
  selectedSlot: null,
  bookedSlotsForDate: [],
  appointments: [],
  rescheduleTargetId: null,
};

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  const isLoggedIn = await loadCurrentUser();
  if (!isLoggedIn) return; 
  renderCalendar();
  await loadAppointments();
  bindEvents();
});

/* ---------------------------- AUTH / PROFILE ---------------------------- */

async function loadCurrentUser() {
  try {
    // Quick safety check against sessionStorage to avoid race conditions
    if (sessionStorage.getItem("loggedIn") !== "true" || sessionStorage.getItem("role") !== "student") {
      window.location.href = "login.html";
      return false;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.user) {
      window.location.href = "login.html";
      return false;
    }
    state.currentUser = data.session.user;

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", state.currentUser.id)
      .maybeSingle();

    $("studentGreeting").textContent =
      "Welcome, " + (profile?.first_name || sessionStorage.getItem("userEmail") || state.currentUser.email);

    // REMOVE LOADING SCREEN & FADE IN DASHBOARD SMOOTHLY
    const loader = document.getElementById("authLoadingScreen");
    if (loader) loader.remove();
    document.body.classList.add("loaded");

    return true;
  } catch (err) {
    console.error("Auth check failed:", err);
    window.location.href = "login.html";
    return false;
  }
}

$("logoutBtn")?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  sessionStorage.clear();
  window.location.href = "login.html";
});

/* ------------------------------- CALENDAR -------------------------------- */

function renderCalendar() {
  const { calendarMonth, calendarYear } = state;
  const monthNames = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];
  $("calMonthLabel").textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

  const grid = $("calGrid");
  grid.innerHTML = "";

  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(calendarYear, calendarMonth, day);
    const iso = toISODate(cellDate);
    const cell = document.createElement("div");
    cell.textContent = day;
    cell.className = "cal-day";

    const isPast = cellDate < today;
    const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;

    if (isPast || isWeekend) {
      cell.classList.add("cal-disabled");
    } else {
      cell.addEventListener("click", () => selectDate(iso, cell));
    }

    if (toISODate(today) === iso) cell.classList.add("cal-today");
    if (state.selectedDate === iso) cell.classList.add("cal-selected");

    grid.appendChild(cell);
  }
}

$("prevMonth")?.addEventListener("click", () => {
  state.calendarMonth--;
  if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
  renderCalendar();
});

$("nextMonth")?.addEventListener("click", () => {
  state.calendarMonth++;
  if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
  renderCalendar();
});

async function selectDate(iso, cellEl) {
  state.selectedDate = iso;
  state.selectedSlot = null;
  renderCalendar();
  $("selectedDateDisplay").value = formatDisplayDate(iso);
  $("selectedSlotDisplay").value = "";
  await loadBookedSlots(iso);
  renderSlotGrid();
}

/* ------------------------------ TIME SLOTS ------------------------------- */

async function loadBookedSlots(dateISO) {
  const { data, error } = await supabase
    .from("appointments")
    .select("appointment_time, status")
    .eq("appointment_date", dateISO)
    .neq("status", "cancelled")
    .neq("status", "rejected");

  if (error) {
    console.error("Failed to load booked slots:", error);
    state.bookedSlotsForDate = [];
    return;
  }
  state.bookedSlotsForDate = (data || []).map((row) => row.appointment_time);
}

function renderSlotGrid() {
  const container = $("slotGrid");
  container.innerHTML = "";
  $("slotHint").classList.add("hidden");

  TIME_SLOTS.forEach((slot) => {
    const taken = state.bookedSlotsForDate.includes(slot);
    const btn = document.createElement("div");
    btn.textContent = slot;
    btn.className = "slot-btn" + (taken ? " slot-taken" : "");
    if (!taken) {
      btn.addEventListener("click", () => {
        state.selectedSlot = slot;
        $("selectedSlotDisplay").value = slot;
        document.querySelectorAll("#slotGrid .slot-btn").forEach((b) => b.classList.remove("slot-selected"));
        btn.classList.add("slot-selected");
      });
    }
    container.appendChild(btn);
  });
}

/* -------------------------------- BOOKING -------------------------------- */

$("bookingForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("bookingMsg");
  msg.textContent = "";

  const purpose = $("purpose").value;
  if (!purpose || !state.selectedDate || !state.selectedSlot) {
    msg.textContent = "Please select a purpose, date, and time slot.";
    msg.className = "text-sm mt-1 text-red-600";
    return;
  }

  const { error } = await supabase.from("appointments").insert({
    student_id: state.currentUser.id,
    purpose,
    appointment_date: state.selectedDate,
    appointment_time: state.selectedSlot,
    notes: $("notes").value || null,
    status: "pending",
  });

  if (error) {
    console.error(error);
    msg.textContent = "Something went wrong. Please try again.";
    msg.className = "text-sm mt-1 text-red-600";
    return;
  }

  msg.textContent = "Appointment request submitted!";
  msg.className = "text-sm mt-1 text-green-700";
  $("bookingForm").reset();
  state.selectedDate = null;
  state.selectedSlot = null;
  $("selectedDateDisplay").value = "";
  $("selectedSlotDisplay").value = "";
  $("slotGrid").innerHTML = "";
  renderCalendar();
  await loadAppointments();
});

/* ---------------------------- APPOINTMENT LIST ---------------------------- */

async function loadAppointments() {
  const tbody = $("appointmentsBody");
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("student_id", state.currentUser.id)
    .order("appointment_date", { ascending: true });

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-red-500">Couldn't load appointments.</td></tr>`;
    return;
  }

  state.appointments = data || [];

  if (state.appointments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400">No appointments yet — book one above.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.appointments.map(rowHTML).join("");

  state.appointments.forEach((appt) => {
    $(`cancel-${appt.id}`)?.addEventListener("click", () => cancelAppointment(appt.id));
    $(`reschedule-${appt.id}`)?.addEventListener("click", () => openRescheduleModal(appt.id));
  });
}

function rowHTML(appt) {
  const canModify = appt.status === "pending" || appt.status === "approved";
  return `
    <tr class="border-t border-gray-100">
      <td class="px-4 py-3">${formatDisplayDate(appt.appointment_date)}</td>
      <td class="px-4 py-3">${appt.appointment_time}</td>
      <td class="px-4 py-3">${appt.purpose}</td>
      <td class="px-4 py-3"><span class="status-pill status-${appt.status}">${capitalize(appt.status)}</span></td>
      <td class="px-4 py-3 text-right space-x-2">
        ${canModify ? `
          <button id="reschedule-${appt.id}" class="text-xs font-medium text-[#0f4c2e] hover:underline">Reschedule</button>
          <button id="cancel-${appt.id}" class="text-xs font-medium text-red-600 hover:underline">Cancel</button>
        ` : `<span class="text-xs text-gray-300">—</span>`}
      </td>
    </tr>`;
}

async function cancelAppointment(id) {
  if (!confirm("Cancel this appointment?")) return;
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) { console.error(error); alert("Couldn't cancel — please try again."); return; }
  await loadAppointments();
}

/* ------------------------------ RESCHEDULE -------------------------------- */

function openRescheduleModal(id) {
  state.rescheduleTargetId = id;
  $("rescheduleDate").value = "";
  $("rescheduleSlot").innerHTML = TIME_SLOTS.map((s) => `<option value="${s}">${s}</option>`).join("");
  $("rescheduleModal").classList.add("open");
}

$("rescheduleCancelBtn")?.addEventListener("click", () => {
  $("rescheduleModal").classList.remove("open");
});

$("rescheduleConfirmBtn")?.addEventListener("click", async () => {
  const newDate = $("rescheduleDate").value;
  const newSlot = $("rescheduleSlot").value;
  if (!newDate) { alert("Please pick a new date."); return; }

  const { error } = await supabase
    .from("appointments")
    .update({
      appointment_date: newDate,
      appointment_time: newSlot,
      status: "pending", 
    })
    .eq("id", state.rescheduleTargetId);

  if (error) { console.error(error); alert("Couldn't reschedule — please try again."); return; }

  $("rescheduleModal").classList.remove("open");
  await loadAppointments();
});


function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function bindEvents() {}