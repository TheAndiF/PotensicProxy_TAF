package com.potensic.proxy.api

import com.potensic.proxy.TelemetryParser
import com.potensic.proxy.control.ControlCoordinator
import com.potensic.proxy.core.DroneStateStore
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

/** Read-only application state API consumed by the cockpit UI. */
fun Route.installApplicationStateRoutes(droneState: DroneStateStore, controlCoordinator: ControlCoordinator) {
    get("/api/telemetry") {
        call.respondText(TelemetryParser.latest.toJson().toString(), ContentType.Application.Json)
    }
    get("/api/state") {
        call.respondText(droneState.toJson().toString(), ContentType.Application.Json)
    }
    get("/api/control/state") {
        call.respondText(controlCoordinator.toJson().toString(), ContentType.Application.Json)
    }
}
