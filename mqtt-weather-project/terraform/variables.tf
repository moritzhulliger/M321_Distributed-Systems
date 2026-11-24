variable "docker_host" {
  description = "Adresse des Docker-Daemons (Windows: Docker Desktop, Linux/macOS: unix:///var/run/docker.sock)"
  type        = string
  default     = "npipe:////./pipe/docker_engine"
}

variable "mqtt_host_port" {
  description = "Auf dem Host veröffentlichter Port des Mosquitto-Brokers"
  type        = number
  default     = 1883
}

variable "stations" {
  description = "Wetterstationen: Schlüssel = Containername-Suffix, station_id = STATION_ID, interval = Sendeintervall in Sekunden"
  type = map(object({
    station_id = string
    interval   = number
  }))
  default = {
    station1 = { station_id = "WS-01", interval = 10 }
    station2 = { station_id = "WS-02", interval = 7 }
    station3 = { station_id = "WS-03", interval = 3 }
  }
}

variable "frost_threshold" {
  description = "Frostgrenze in °C für weather-alerts"
  type        = number
  default     = 0
}

variable "heat_threshold" {
  description = "Hitzegrenze in °C für weather-alerts"
  type        = number
  default     = 30
}

variable "humidity_threshold" {
  description = "Luftfeuchtigkeitsgrenze in % für weather-alerts"
  type        = number
  default     = 85
}
