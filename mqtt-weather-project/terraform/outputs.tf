output "mqtt_broker_url" {
  description = "Adresse des MQTT-Brokers auf dem Host"
  value       = "mqtt://localhost:${var.mqtt_host_port}"
}

output "station_containers" {
  description = "Namen der Stations-Container"
  value       = [for c in docker_container.station : c.name]
}

output "service_containers" {
  description = "Namen der Service-Container"
  value = [
    docker_container.live_display.name,
    docker_container.monitor.name,
    docker_container.weather_alerts.name,
    docker_container.statistics.name,
  ]
}
