locals {
  project_root = abspath("${path.module}/..")
  broker_host  = "mosquitto"
  station_ids  = join(",", [for s in var.stations : s.station_id])

  # Änderungen an Quelldateien erzwingen einen Rebuild des Images
  services_src_hash = sha1(join("", [for f in fileset("${local.project_root}/services", "**") : filesha1("${local.project_root}/services/${f}")]))
  stations_src_hash = sha1(join("", [for f in fileset("${local.project_root}/stations", "**") : filesha1("${local.project_root}/stations/${f}")]))
}

# ---------------------------------------------------------------------------
# Netzwerk und Volume
# ---------------------------------------------------------------------------

resource "docker_network" "weather" {
  name = "mqtt-weather-net"
}

# Entspricht dem Compose-Volume weather-data. Bestehende Daten werden NICHT übernommen.
resource "docker_volume" "weather_data" {
  name = "mqtt-weather-data"
}

# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------

resource "docker_image" "mosquitto" {
  name         = "eclipse-mosquitto:latest"
  keep_locally = true
}

resource "docker_image" "station" {
  name = "mqtt-weather-station:latest"

  build {
    context    = "${local.project_root}/stations"
    dockerfile = "Dockerfile"
    tag        = ["mqtt-weather-station:latest"]
  }

  triggers = {
    src_hash = local.stations_src_hash
  }
}

resource "docker_image" "services" {
  name = "mqtt-weather-services:latest"

  build {
    context    = "${local.project_root}/services"
    dockerfile = "Dockerfile"
    tag        = ["mqtt-weather-services:latest"]
  }

  triggers = {
    src_hash = local.services_src_hash
  }
}

# ---------------------------------------------------------------------------
# MQTT-Broker
# ---------------------------------------------------------------------------

resource "docker_container" "mosquitto" {
  name    = "mqtt-weather-mosquitto"
  image   = docker_image.mosquitto.image_id
  restart = "unless-stopped"

  # wait = true: Terraform wartet, bis der Healthcheck "healthy" meldet,
  # bevor abhängige Container gestartet werden (Entspricht service_healthy).
  wait         = true
  wait_timeout = 120

  ports {
    internal = 1883
    external = var.mqtt_host_port
  }

  volumes {
    host_path      = "${local.project_root}/mosquitto/mosquitto.conf"
    container_path = "/mosquitto/config/mosquitto.conf"
    read_only      = true
  }

  healthcheck {
    test     = ["CMD", "mosquitto_sub", "-h", "localhost", "-t", "$SYS/broker/version", "-C", "1", "-W", "5"]
    interval = "5s"
    timeout  = "6s"
    retries  = 10
  }

  networks_advanced {
    name    = docker_network.weather.name
    aliases = [local.broker_host]
  }
}

# ---------------------------------------------------------------------------
# Wetterstationen (Publisher)
# ---------------------------------------------------------------------------

resource "docker_container" "station" {
  for_each = var.stations

  name    = "mqtt-weather-${each.key}"
  image   = docker_image.station.image_id
  restart = "unless-stopped"

  env = [
    "STATION_ID=${each.value.station_id}",
    "INTERVAL=${each.value.interval}",
  ]

  networks_advanced {
    name = docker_network.weather.name
  }

  depends_on = [docker_container.mosquitto]
}

# ---------------------------------------------------------------------------
# Services (Subscriber)
# ---------------------------------------------------------------------------

resource "docker_container" "live_display" {
  name    = "mqtt-weather-live-display"
  image   = docker_image.services.image_id
  restart = "unless-stopped"
  command = ["python", "live_display.py"]

  env = [
    "BROKER_HOST=${local.broker_host}",
  ]

  networks_advanced {
    name = docker_network.weather.name
  }

  depends_on = [docker_container.mosquitto]
}

resource "docker_container" "monitor" {
  name    = "mqtt-weather-monitor"
  image   = docker_image.services.image_id
  restart = "unless-stopped"
  command = ["python", "monitor.py"]

  env = [
    "BROKER_HOST=${local.broker_host}",
    "STATION_IDS=${local.station_ids}",
    "DATABASE_PATH=/data/weather.db",
  ]

  volumes {
    volume_name    = docker_volume.weather_data.name
    container_path = "/data"
  }

  networks_advanced {
    name = docker_network.weather.name
  }

  depends_on = [docker_container.mosquitto]
}

resource "docker_container" "weather_alerts" {
  name    = "mqtt-weather-alerts"
  image   = docker_image.services.image_id
  restart = "unless-stopped"
  command = ["python", "alerts.py"]

  env = [
    "BROKER_HOST=${local.broker_host}",
    "ALERT_LOG_PATH=/data/alerts.jsonl",
    "FROST_THRESHOLD=${var.frost_threshold}",
    "HEAT_THRESHOLD=${var.heat_threshold}",
    "HUMIDITY_THRESHOLD=${var.humidity_threshold}",
  ]

  volumes {
    volume_name    = docker_volume.weather_data.name
    container_path = "/data"
  }

  networks_advanced {
    name = docker_network.weather.name
  }

  # Entspricht depends_on: monitor condition service_started
  depends_on = [docker_container.mosquitto, docker_container.monitor]
}

resource "docker_container" "statistics" {
  name    = "mqtt-weather-statistics"
  image   = docker_image.services.image_id
  restart = "unless-stopped"
  command = ["python", "statistics.py"]

  env = [
    "BROKER_HOST=${local.broker_host}",
  ]

  networks_advanced {
    name = docker_network.weather.name
  }

  # Entspricht depends_on: monitor condition service_started
  depends_on = [docker_container.mosquitto, docker_container.monitor]
}
