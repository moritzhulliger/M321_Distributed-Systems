import argparse

from database import open_database


def main():
    parser = argparse.ArgumentParser(description="Historische Wetterdaten aus SQLite anzeigen")
    parser.add_argument("--database", default="data/weather.db", help="Pfad zur SQLite-Datenbank")
    parser.add_argument("--station", help="Nach Stations-ID filtern")
    parser.add_argument("--limit", type=int, default=20, help="Anzahl der neuesten Datensätze")
    arguments = parser.parse_args()
    if arguments.limit < 1:
        parser.error("--limit muss mindestens 1 sein")

    connection = open_database(arguments.database)
    try:
        query = (
            "SELECT received_at, station_id, measurement_timestamp, temperature, "
            "humidity, is_valid, invalid_reason FROM measurements"
        )
        parameters = []
        if arguments.station:
            query += " WHERE station_id = ?"
            parameters.append(arguments.station)
        query += " ORDER BY received_at DESC LIMIT ?"
        parameters.append(arguments.limit)

        rows = connection.execute(query, parameters).fetchall()
        if not rows:
            print("Keine passenden Messwerte gefunden.")
            return
        print("Empfangen | Station | Messzeit | Temperatur | Feuchtigkeit | Gültig | Grund")
        for row in rows:
            print(" | ".join("-" if value is None else str(value) for value in row))
    finally:
        connection.close()


if __name__ == "__main__":
    main()