
from flask import Flask, request, jsonify, send_from_directory
import sqlite3
from pathlib import Path
from datetime import datetime, date

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
DB_PATH = Path(__file__).resolve().parent / "reminders.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_database():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                reminder_date TEXT NOT NULL,
                reminder_time TEXT NOT NULL,
                notes TEXT DEFAULT '',
                completed INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.commit()


@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@app.route("/api/reminders", methods=["GET"])
def get_reminders():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT * FROM reminders
            ORDER BY reminder_date, reminder_time
        """).fetchall()

    return jsonify([dict(row) for row in rows])


@app.route("/api/reminders", methods=["POST"])
def add_reminder():
    data = request.get_json(silent=True) or {}

    title = str(data.get("title", "")).strip()
    category = str(data.get("category", "")).strip()
    reminder_date = str(data.get("reminder_date", "")).strip()
    reminder_time = str(data.get("reminder_time", "")).strip()
    notes = str(data.get("notes", "")).strip()

    if not all([title, category, reminder_date, reminder_time]):
        return jsonify({"error": "Please fill all required fields."}), 400

    try:
        selected_date = datetime.strptime(
            reminder_date, "%Y-%m-%d"
        ).date()
        datetime.strptime(reminder_time, "%H:%M")
    except ValueError:
        return jsonify({"error": "Invalid date or time."}), 400

    if selected_date < date.today():
        return jsonify({"error": "Please select today or a future date."}), 400

    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO reminders
            (title, category, reminder_date, reminder_time, notes)
            VALUES (?, ?, ?, ?, ?)
        """, (title, category, reminder_date, reminder_time, notes))

        conn.commit()

        row = conn.execute(
            "SELECT * FROM reminders WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()

    return jsonify(dict(row)), 201


@app.route("/api/reminders/<int:reminder_id>", methods=["PATCH"])
def update_reminder(reminder_id):
    data = request.get_json(silent=True) or {}
    completed = data.get("completed")

    if type(completed) is not bool:
        return jsonify({"error": "Invalid completion status."}), 400

    with get_db() as conn:
        cursor = conn.execute("""
            UPDATE reminders
            SET completed = ?
            WHERE id = ?
        """, (int(completed), reminder_id))

        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "Reminder not found."}), 404

        row = conn.execute(
            "SELECT * FROM reminders WHERE id = ?",
            (reminder_id,)
        ).fetchone()

    return jsonify(dict(row))


@app.route("/api/reminders/<int:reminder_id>", methods=["DELETE"])
def delete_reminder(reminder_id):
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM reminders WHERE id = ?",
            (reminder_id,)
        )
        conn.commit()

    if cursor.rowcount == 0:
        return jsonify({"error": "Reminder not found."}), 404

    return jsonify({"message": "Reminder deleted successfully."})


if __name__ == "__main__":
    import os

    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)