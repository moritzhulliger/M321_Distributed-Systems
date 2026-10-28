import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Main {

    record Rule(String name, String field, boolean below, double limit) {
    }

    static final String BROKER = System.getenv().getOrDefault("MQTT_URL", "tcp://localhost:1883");
    static final Path LOG_FILE = Path.of(System.getenv().getOrDefault("LOG_FILE", "logs/alerts.log"));
    static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    static final List<Rule> RULES = List.of(
            new Rule("FROST", "temperature", true, env("FROST_BELOW", 0)),
            new Rule("HITZE", "temperature", false, env("HEAT_ABOVE", 30)),
            new Rule("HOHE FEUCHTE", "humidity", false, env("HUMIDITY_ABOVE", 85))
    );

    static final Map<String, Boolean> active = new HashMap<>();
    static MqttAsyncClient client;

    public static void main(String[] args) throws Exception {
        Files.createDirectories(LOG_FILE.toAbsolutePath().getParent());
        for (Rule rule : RULES) {
            System.out.println("Grenzwert: " + rule.name() + " " + rule.field() + (rule.below() ? " < " : " > ") + rule.limit());
        }

        client = new MqttAsyncClient(BROKER, "alert-service", new MemoryPersistence());
        client.setCallback(new MqttCallbackExtended() {
            @Override
            public void connectComplete(boolean reconnect, String serverURI) {
                System.out.println("Verbunden mit " + serverURI);
                try {
                    client.subscribe("weather/validated", 1);
                } catch (MqttException e) {
                    System.out.println("Abonnieren fehlgeschlagen: " + e.getMessage());
                }
            }

            @Override
            public void connectionLost(Throwable cause) {
                System.out.println("Verbindung verloren - versuche neu zu verbinden ...");
            }

            @Override
            public void messageArrived(String topic, MqttMessage message) {
                try {
                    String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
                    check(JsonParser.parseString(payload).getAsJsonObject());
                } catch (Exception e) {
                    System.out.println("Nachricht uebersprungen: " + e.getMessage());
                }
            }

            @Override
            public void deliveryComplete(IMqttDeliveryToken token) {
            }
        });

        connect();
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
                System.out.println("Broker nicht erreichbar, neuer Versuch in 3 s");
                Thread.sleep(3000);
            }
        }
    }

    static void check(JsonObject data) {
        String station = data.get("stationId").getAsString();
        String timestamp = data.get("timestamp").getAsString();

        for (Rule rule : RULES) {
            double value = data.get(rule.field()).getAsDouble();
            boolean isBad = rule.below() ? value < rule.limit() : value > rule.limit();

            String key = station + "/" + rule.name();
            boolean wasBad = active.getOrDefault(key, false);
            if (isBad == wasBad) {
                continue;
            }
            active.put(key, isBad);

            if (isBad) {
                String operator = rule.below() ? "<" : ">";
                writeLog("WARNUNG " + rule.name() + " | " + station + " | " + rule.field() + "=" + value
                        + " (" + operator + " " + rule.limit() + ") | " + timestamp);
            } else {
                writeLog("NORMAL  " + rule.name() + " | " + station + " | " + rule.field() + "=" + value
                        + " | " + timestamp);
            }
        }
    }

    static void writeLog(String text) {
        String line = LocalDateTime.now().format(TIME_FORMAT) + " " + text;
        System.out.println(line);
        try {
            Files.writeString(LOG_FILE, line + "\n", StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException e) {
            System.out.println("Log-Datei nicht schreibbar: " + e.getMessage());
        }
    }

    static double env(String name, double defaultValue) {
        String value = System.getenv(name);
        return value == null ? defaultValue : Double.parseDouble(value);
    }
}