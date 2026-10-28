import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class Main {

    static final String BROKER = System.getenv().getOrDefault("MQTT_URL", "tcp://localhost:1883");
    static final int TIMEOUT_SECONDS = Integer.parseInt(System.getenv().getOrDefault("TIMEOUT_SECONDS", "30"));

    static final String TOPIC_RAW = "weather";
    static final String TOPIC_VALID = "weather/validated";
    static final String TOPIC_INVALID = "weather/invalid";
    static final String TOPIC_STATUS = "weather/status/";

    static final Map<String, Long> lastSeen = new ConcurrentHashMap<>();
    static final Set<String> offline = ConcurrentHashMap.newKeySet();
    static MqttAsyncClient client;

    public static void main(String[] args) throws Exception {
        client = new MqttAsyncClient(BROKER, "monitor-service", new MemoryPersistence());
        client.setCallback(new MqttCallbackExtended() {
            @Override
            public void connectComplete(boolean reconnect, String serverURI) {
                log("Verbunden mit " + serverURI);
                subscribe(TOPIC_RAW);
            }

            @Override
            public void connectionLost(Throwable cause) {
                log("Verbindung verloren - versuche neu zu verbinden ...");
            }

            @Override
            public void messageArrived(String topic, MqttMessage message) {
                try {
                    handleMessage(new String(message.getPayload(), StandardCharsets.UTF_8));
                } catch (Exception e) {
                    log("Fehler bei Nachricht: " + e.getMessage());
                }
            }

            @Override
            public void deliveryComplete(IMqttDeliveryToken token) {
            }
        });

        connect();

        ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor();
        timer.scheduleAtFixedRate(() -> {
            try {
                checkTimeouts();
            } catch (Exception e) {
                log("Fehler bei Timeout-Pruefung: " + e.getMessage());
            }
        }, 5, 5, TimeUnit.SECONDS);

        log("Monitor gestartet (Timeout " + TIMEOUT_SECONDS + " s)");
    }

    static void connect() throws InterruptedException {
        MqttConnectOptions options = new MqttConnectOptions();
        options.setAutomaticReconnect(true);
        options.setMaxReconnectDelay(30000);
        options.setCleanSession(true);
        options.setKeepAliveInterval(30);

        while (true) {
            try {
                client.connect(options).waitForCompletion();
                return;
            } catch (MqttException e) {
                log("Broker nicht erreichbar, neuer Versuch in 3 s");
                Thread.sleep(3000);
            }
        }
    }

    static void handleMessage(String payload) {
        JsonObject data;
        try {
            data = JsonParser.parseString(payload).getAsJsonObject();
        } catch (Exception e) {
            log("UNGUELTIG (kein JSON): " + payload);
            JsonObject invalid = new JsonObject();
            invalid.addProperty("raw", payload);
            invalid.addProperty("error", "kein gueltiges JSON");
            publish(TOPIC_INVALID, invalid.toString(), false);
            return;
        }

        String station = getString(data, "stationId");
        if (station != null) {
            boolean isNew = !lastSeen.containsKey(station);
            lastSeen.put(station, System.currentTimeMillis());
            if (isNew || offline.remove(station)) {
                publishStatus(station, "online");
            }
        }

        List<String> errors = validate(data);
        if (errors.isEmpty()) {
            publish(TOPIC_VALID, data.toString(), false);
        } else {
            log("UNGUELTIG " + station + ": " + String.join(", ", errors));
            JsonObject invalid = new JsonObject();
            invalid.add("data", data);
            JsonArray errorList = new JsonArray();
            errors.forEach(errorList::add);
            invalid.add("errors", errorList);
            publish(TOPIC_INVALID, invalid.toString(), false);
        }
    }

    static List<String> validate(JsonObject data) {
        List<String> errors = new ArrayList<>();
        if (getString(data, "stationId") == null) {
            errors.add("stationId fehlt");
        }
        Double temperature = getNumber(data, "temperature");
        if (temperature == null || temperature < -50 || temperature > 60) {
            errors.add("Temperatur ungueltig: " + data.get("temperature"));
        }
        Double humidity = getNumber(data, "humidity");
        if (humidity == null || humidity < 0 || humidity > 100) {
            errors.add("Luftfeuchtigkeit ungueltig: " + data.get("humidity"));
        }
        if (!data.has("timestamp")) {
            errors.add("timestamp fehlt");
        }
        return errors;
    }

    static void checkTimeouts() {
        long now = System.currentTimeMillis();
        for (Map.Entry<String, Long> entry : lastSeen.entrySet()) {
            String station = entry.getKey();
            boolean tooOld = now - entry.getValue() > TIMEOUT_SECONDS * 1000L;
            if (tooOld && offline.add(station)) {
                publishStatus(station, "offline");
            }
        }
    }

    static void publishStatus(String station, String status) {
        JsonObject message = new JsonObject();
        message.addProperty("stationId", station);
        message.addProperty("status", status);
        message.addProperty("lastSeen", Instant.ofEpochMilli(lastSeen.get(station)).toString());
        publish(TOPIC_STATUS + station, message.toString(), true);
        log("STATUS " + station + ": " + status);
    }

    static void subscribe(String topic) {
        try {
            client.subscribe(topic, 1);
        } catch (MqttException e) {
            log("Abonnieren fehlgeschlagen: " + e.getMessage());
        }
    }

    static void publish(String topic, String payload, boolean retained) {
        try {
            client.publish(topic, payload.getBytes(StandardCharsets.UTF_8), 1, retained);
        } catch (MqttException e) {
            log("Senden fehlgeschlagen: " + e.getMessage());
        }
    }

    static String getString(JsonObject data, String key) {
        JsonElement value = data.get(key);
        if (value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()) {
            return value.getAsString();
        }
        return null;
    }

    static Double getNumber(JsonObject data, String key) {
        JsonElement value = data.get(key);
        if (value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()) {
            return value.getAsDouble();
        }
        return null;
    }

    static void log(String text) {
        System.out.println("[" + LocalTime.now().withNano(0) + "] " + text);
    }
}