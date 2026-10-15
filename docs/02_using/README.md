# Using pulsed

## Install the dashboard as an app

Open either the classic dashboard or Pages in a browser that supports web app
installation. In Chrome or Edge, use the address bar's install action or the
browser menu's **Install Pulsed** option. On iPhone or iPad, use Safari's
**Share → Add to Home Screen** action. Installation is optional; the website
continues to work in a normal browser tab.

Installation requires HTTPS, or localhost for local use. For a remote node on
plain HTTP, put Pulsed behind an HTTPS reverse proxy first. The app launches the
view you installed, retaining its proxy prefix, peer-routing query and display
options. Classic and Pages share an app identity for the same routed peer.

The installed app still needs a connection to the Pulsed server for live
monitoring. After the first online visit, a failed navigation shows an offline
message and a retry button. Dashboards and telemetry are never cached by the
app's service worker. No app store or separate client download is required.
