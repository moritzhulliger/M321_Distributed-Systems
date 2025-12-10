# Setup Keycloak

## 1. Realm erstellen

Name: security-lab

## 2. User anlegen

Username: testuser

Password: testpass

Email Verified: on

## 3. Client (unsicheres SPA) anlegen

Client ID: spa-unsafe

Client Type: Public

Redirect URIs: http://localhost:5173/*

Web Origins: * 

# Frontend und Backend einrichten

## Frontend

Verwendet https://authts.github.io/oidc-client-ts/ 