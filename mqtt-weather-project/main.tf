terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {
  host = var.docker_host
}

locals {
  mqtt_url = "tcp://mosquitto:1883"
}

resource "docker_network" "weather" {
  name = "weather-net"
}

resource "docker_volume" "alerts_logs" {
  name = "weather-alerts-logs"
}

resource "docker_image" "mosquitto" {
  name         = "eclipse-mosquitto:2"
  keep_locally = true
}

resource "docker_image" "station" {
  name = "weather-station:latest"

  build {
    context = "${path.module}/stations"
  }

  triggers = {
    source = sha1(join("", [for f in sort(fileset("${path.module}/stations", "**")) : filesha1("${path.module}/stations/${f}")]))
  }
}

resource "docker_image" "monitor" {
  name = "weather-monitor:latest"

  build {
    context = "${path.module}/monitor"
  }

  triggers = {
    source = sha1(join("", [for f in sort(setunion(fileset("${path.module}/monitor", "pom.xml"), fileset("${path.module}/monitor", "Dockerfile"), fileset("${path.module}/monitor", "src/**"))) : filesha1("${path.module}/monitor/${f}")]))
  }
}

resource "docker_image" "alerts" {
  name = "weather-alerts:latest"

  build {
    context = "${path.module}/alerts"
  }

  triggers = {
    source = sha1(join("", [for f in sort(setunion(fileset("${path.module}/alerts", "pom.xml"), fileset("${path.module}/alerts", "Dockerfile"), fileset("${path.module}/alerts", "src/**"))) : filesha1("${path.module}/alerts/${f}")]))
  }
}

locals {
  dashboard_source = sha1(join("", [for f in sort(setunion(fileset("${path.module}/dashboard", "*.json"), fileset("${path.module}/dashboard", "Dockerfile"), fileset("${path.module}/dashboard", "src/**"))) : filesha1("${path.module}/dashboard/${f}")]))
}

resource "terraform_data" "dashboard_build" {
  triggers_replace = [local.dashboard_source]

  provisioner "local-exec" {
    working_dir = path.module
    command     = "docker build -t weather-dashboard:latest ./dashboard"
  }
}

resource "docker_image" "dashboard" {
  name         = "weather-dashboard:latest"
  keep_locally = true

  triggers = {
    source = local.dashboard_source
  }

  depends_on = [terraform_data.dashboard_build]
}

resource "docker_image" "live_display" {
  name = "weather-live-display:latest"

  build {
    context = "${path.module}/live-display"
  }

  triggers = {
    source = sha1(join("", [for f in sort(fileset("${path.module}/live-display", "**")) : filesha1("${path.module}/live-display/${f}")]))
  }
}

resource "docker_container" "mosquitto" {
  name    = "mosquitto"
  image   = docker_image.mosquitto.image_id
  restart = "unless-stopped"

  networks_advanced {
    name    = docker_network.weather.name
    aliases = ["mosquitto"]
  }

  ports {
    internal = 1883
    external = var.mqtt_port
  }

  ports {
    internal = 9001
    external = 9001
  }

  upload {
    file    = "/mosquitto/config/mosquitto.conf"
    content = file("${path.module}/mosquitto/mosquitto.conf")
  }

  healthcheck {
    test         = ["CMD-SHELL", "mosquitto_pub -t healthcheck -m ok || exit 1"]
    interval     = "5s"
    timeout      = "5s"
    retries      = 5
    start_period = "3s"
  }

  wait         = true
  wait_timeout = 60
}

resource "docker_container" "station" {
  for_each = var.stations

  name    = each.key
  image   = docker_image.station.image_id
  restart = "on-failure"

  env = [
    "STATION_ID=${each.value.id}",
    "INTERVAL=${each.value.interval}",
    "PYTHONUNBUFFERED=1",
  ]

  networks_advanced {
    name = docker_network.weather.name
  }

  depends_on = [docker_container.mosquitto]
}

resource "docker_container" "live_display" {
  name    = "live-display"
  image   = docker_image.live_display.image_id
  restart = "unless-stopped"

  env = [
    "PYTHONUNBUFFERED=1",
  ]

  networks_advanced {
    name = docker_network.weather.name
  }

  depends_on = [docker_container.mosquitto]
}

resource "docker_container" "monitor" {
  name    = "monitor"
  image   = docker_image.monitor.image_id
  restart = "unless-stopped"

  env = [
    "MQTT_URL=${local.mqtt_url}",
    "TIMEOUT_SECONDS=${var.monitor_timeout_seconds}",
  ]

  networks_advanced {
    name = docker_network.weather.name
  }

  depends_on = [docker_container.mosquitto]
}

resource "docker_container" "alerts" {
  name    = "alerts"
  image   = docker_image.alerts.image_id
  restart = "unless-stopped"

  env = [
    "MQTT_URL=${local.mqtt_url}",
    "FROST_BELOW=${var.frost_below}",
    "HEAT_ABOVE=${var.heat_above}",
    "HUMIDITY_ABOVE=${var.humidity_above}",
  ]

  volumes {
    volume_name    = docker_volume.alerts_logs.name
    container_path = "/app/logs"
  }

  networks_advanced {
    name = docker_network.weather.name
  }

  depends_on = [docker_container.mosquitto]
}

resource "docker_container" "dashboard" {
  name    = "dashboard"
  image   = docker_image.dashboard.image_id
  restart = "unless-stopped"

  ports {
    internal = 80
    external = var.dashboard_port
  }

  networks_advanced {
    name = docker_network.weather.name
  }

  depends_on = [docker_container.mosquitto]
}
