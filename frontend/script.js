
const API_URL = "/api/reminders";

const form = document.getElementById("reminderForm");
const titleInput = document.getElementById("title");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("reminderDate");
const timeInput = document.getElementById("reminderTime");
const notesInput = document.getElementById("notes");
const list = document.getElementById("reminderList");
const message = document.getElementById("formMessage");
const loading = document.getElementById("loadingMessage");
const filterStatus = document.getElementById("filterStatus");
const submitButton = document.getElementById("submitButton");

let reminders = [];

function localDateString() {
    const now = new Date();

    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");
}

const today = localDateString();
dateInput.min = today;
dateInput.value = today;

function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.error || data.message || "Something went wrong."
        );
    }

    return data;
}

async function loadReminders() {
    loading.textContent = "Loading reminders...";
    loading.classList.remove("error");
    list.replaceChildren();

    try {
        reminders = await apiRequest(API_URL);
        renderReminders();
        loading.textContent = "";
    } catch (error) {
        loading.textContent =
            "Unable to load reminders. Please start the Flask server.";
        loading.classList.add("error");
    }
}

function addText(parent, tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text;

    if (className) {
        element.className = className;
    }

    parent.appendChild(element);
    return element;
}

function renderReminders() {
    list.replaceChildren();

    const filtered = reminders.filter((reminder) => {
        if (filterStatus.value === "pending") {
            return !reminder.completed;
        }

        if (filterStatus.value === "completed") {
            return Boolean(reminder.completed);
        }

        return true;
    });

    if (filtered.length === 0) {
        addText(
            list,
            "p",
            "No reminders found. Add your first reminder!",
            "empty"
        );
        return;
    }

    filtered.forEach((reminder) => {
        const card = document.createElement("article");
        card.className = "reminder-card";

        if (reminder.completed) {
            card.classList.add("completed");
        }

        addText(card, "h3", reminder.title);

        addText(card, "span", reminder.category, "status");

        const formattedDate = new Date(
            `${reminder.reminder_date}T00:00:00`
        ).toLocaleDateString();

        addText(
            card,
            "p",
            `Date: ${formattedDate} | Time: ${reminder.reminder_time}`
        );

        if (reminder.notes) {
            addText(card, "p", `Notes: ${reminder.notes}`);
        }

        addText(
            card,
            "p",
            reminder.completed ? "Status: Completed" : "Status: Pending"
        );

        const actions = document.createElement("div");
        actions.className = "card-actions";

        const statusButton = document.createElement("button");
        statusButton.textContent = reminder.completed
            ? "Mark Pending"
            : "Mark Completed";

        statusButton.addEventListener("click", async () => {
            statusButton.disabled = true;

            try {
                await apiRequest(`${API_URL}/${reminder.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        completed: !Boolean(reminder.completed)
                    })
                });

                await loadReminders();
            } catch (error) {
                alert(error.message);
                statusButton.disabled = false;
            }
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-btn";

        deleteButton.addEventListener("click", async () => {
            if (!confirm(`Delete "${reminder.title}"?`)) {
                return;
            }

            deleteButton.disabled = true;

            try {
                await apiRequest(`${API_URL}/${reminder.id}`, {
                    method: "DELETE"
                });

                await loadReminders();
            } catch (error) {
                alert(error.message);
                deleteButton.disabled = false;
            }
        });

        actions.append(statusButton, deleteButton);
        card.appendChild(actions);
        list.appendChild(card);
    });
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");

    if (dateInput.value < localDateString()) {
        showMessage("Please choose today or a future date.", true);
        return;
    }

    submitButton.disabled = true;

    try {
        await apiRequest(API_URL, {
            method: "POST",
            body: JSON.stringify({
                title: titleInput.value.trim(),
                category: categoryInput.value,
                reminder_date: dateInput.value,
                reminder_time: timeInput.value,
                notes: notesInput.value.trim()
            })
        });

        form.reset();
        dateInput.min = localDateString();
        dateInput.value = localDateString();

        showMessage("Reminder saved successfully!");
        await loadReminders();
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        submitButton.disabled = false;
    }
});

filterStatus.addEventListener("change", renderReminders);

document.getElementById("refreshBtn").addEventListener(
    "click",
    loadReminders
);

loadReminders();
