variable "docker_host" {
  type    = string
  default = "npipe:////.//pipe//docker_engine"
}

variable "mqtt_port" {
  type    = number
  default = 1883
}

variable "dashboard_port" {
  type    = number
  default = 8080
}

variable "stations" {
  type = map(object({
    id       = string
    interval = number
  }))
  default = {
    station1 = { id = "WS-01", interval = 5 }
    station2 = { id = "WS-02", interval = 10 }
    station3 = { id = "WS-03", interval = 3 }
  }
}

variable "monitor_timeout_seconds" {
  type    = number
  default = 30
}

variable "frost_below" {
  type    = number
  default = 0
}

variable "heat_above" {
  type    = number
  default = 28
}

variable "humidity_above" {
  type    = number
  default = 55
}
