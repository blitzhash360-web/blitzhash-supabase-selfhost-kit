# Health dashboard (on by default)

The kit overlay starts two proven open-source tools:

| Tool | License | Role | Default URL |
|---|---|---|---|
| [Glances](https://github.com/nicolargo/glances) | LGPL-3.0-only | Host CPU, RAM, disk, network + Docker container stats | http://127.0.0.1:61208 |
| [Dozzle](https://github.com/amir20/dozzle) | MIT | Live container logs | http://127.0.0.1:8080 |

Notices: `overlays/THIRD_PARTY_NOTICES`.

## Auth & binding

- Ports bind to **127.0.0.1** by default (`GLANCES_BIND`, `DOZZLE_BIND`).
- Dozzle uses Studio `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`.
- Glances can take a web password in `volumes/kit/glances.conf` (`[outputs] password=`).

## Docker socket risk

Both mount `/var/run/docker.sock` **read-only**. Read-only protects the socket
*file mode*, not the Docker API: a process with the socket can still inspect
(and depending on daemon config, influence) containers. Keep these UIs off the
public internet; use SSH tunnels or a VPN when remote.

## Disable

Remove `docker-compose.kit.yml` from `COMPOSE_FILE` in `.env`, or delete the
`glances` / `dozzle` services from the overlay copy inside `supabase-project/`.
