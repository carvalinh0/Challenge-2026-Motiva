import { defineRailway, github, image, preserve, project, service, volume } from "railway/iac";

const REPO = "carvalinh0/Challenge-2026-Motiva";

export default defineRailway((ctx) => {
    const apiVolume = volume("api-volume", {
        sizeMB: 5000,
        region: "us-west2",
        allowOnlineResize: true,
        alerts: { usage: { "80": {}, "95": {}, "100": {} } },
    });

    const mosquitto = service("eclipse-mosquitto", {
        source: image("eclipse-mosquitto"),
        build: {
            builder: "RAILPACK",
            buildEnvironment: "V3",
        },
        deploy: {
            runtime: "V2",
            sleepApplication: false,
            multiRegionConfig: { "us-west2": { numReplicas: 1 } },
            ipv6EgressEnabled: false,
            useLegacyStacker: false,
        },
        networking: {
            serviceDomains: {
                "eclipse-mosquitto-production-2e7e.up.railway.app": { port: 1883 },
            },
        },
        tcp: [1883],
    });

    const api = service("API", {
        source: github(REPO, { branch: "main", rootDirectory: "/apps/api", checkSuites: false }),
        build: {
            builder: "RAILPACK",
            buildEnvironment: "V3",
            watchPatterns: ["/apps/api/**"],
        },
        start: "bun run start",
        healthcheck: "/api/status",
        healthcheckTimeout: 120,
        deploy: {
            runtime: "V2",
            restartPolicyMaxRetries: 3,
            multiRegionConfig: { "us-west2": { numReplicas: 1 } },
            limitOverride: { containers: { cpu: 1, memoryBytes: 1000000000 } },
            ipv6EgressEnabled: true,
            useLegacyStacker: false,
        },
        networking: {
            privateNetworkEndpoint: "challenge-2026-motiva",
            serviceDomains: {
                "api-production-5db8.up.railway.app": { port: 8080 },
            },
        },
        volumeMounts: {
            "/data": apiVolume,
        },
        env: {
            DATABASE_URL: preserve(),
            JWT_SECRET: preserve(),
            JWT_EXPIRES_IN: preserve(),
            ADMIN_USER: preserve(),
            ADMIN_PASSWORD: preserve(),
            TOKEN: preserve(),
            MQTT_URL: preserve(),
            LOG_LEVEL: preserve(),
            SENSOR_ACTIVE_WINDOW_MS: preserve(),
        },
    });

    const site = service("Site", {
        source: github(REPO, { branch: "main", rootDirectory: "/apps/site", checkSuites: false }),
        build: {
            builder: "RAILPACK",
            buildEnvironment: "V3",
            buildCommand: "bun run build",
            watchPatterns: ["/apps/site/**"],
        },
        start: "bun run start",
        healthcheck: "/",
        healthcheckTimeout: 60,
        deploy: {
            runtime: "V2",
            restartPolicyMaxRetries: 3,
            sleepApplication: true,
            multiRegionConfig: { "us-west2": { numReplicas: 1 } },
            limitOverride: { containers: { cpu: 1, memoryBytes: 1000000000 } },
            ipv6EgressEnabled: true,
            useLegacyStacker: false,
        },
        networking: {
            privateNetworkEndpoint: "site",
            serviceDomains: {
                "site-production-b6b0.up.railway.app": {},
            },
        },
        env: {
            VITE_API_URL: preserve(),
            VITE_API_TOKEN: preserve(),
        },
    });

    return project(ctx.projectName ?? "charming-unity", {
        resources: [mosquitto, api, site, apiVolume],
    });
});
