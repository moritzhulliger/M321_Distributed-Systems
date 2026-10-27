import os
import sqlite3
from pathlib import Path


def database_path():
    return os.getenv("DATABASE_PATH", "data/weather.db")


def open_database(path=None):
    selected_path = path or database_path()
    Path(selected_path).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(selected_path, timeout=10)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        """CREATE TABLE IF NOT EXISTS measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            received_at TEXT NOT NULL,
            station_id TEXT,
            measurement_timestamp TEXT,
            temperature REAL,
            humidity REAL,
            is_valid INTEGER NOT NULL,
            invalid_reason TEXT,
            payload TEXT NOT NULL
        )"""
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_measurements_station_received "
        "ON measurements(station_id, received_at)"
    )
    connection.commit()
    return connection


def save_measurement(connection, payload, received_at, measurement, invalid_reason):
    connection.execute(
        """INSERT INTO measurements (
            received_at, station_id, measurement_timestamp, temperature,
            humidity, is_valid, invalid_reason, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            received_at,
            measurement.get("stationId") if measurement else None,
            measurement.get("timestamp") if measurement else None,
            measurement.get("temperature") if measurement else None,
            measurement.get("humidity") if measurement else None,
            int(measurement is not None),
            invalid_reason,
            payload.decode("utf-8", errors="replace"),
        ),
    )
    connection.commit()