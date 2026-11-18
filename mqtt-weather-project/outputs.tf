output "dashboard_url" {
  value = "http://localhost:${var.dashboard_port}"
}

output "containers" {
  value = concat(
    [docker_container.mosquitto.name, docker_container.monitor.name, docker_container.alerts.name, docker_container.dashboard.name, docker_container.live_display.name],
    [for c in docker_container.station : c.name]
  )
}
