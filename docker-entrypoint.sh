#!/bin/sh
set -e

# The bind-mounted ./data volume is owned by whatever created it on the host
# (often root). Fix ownership here, as root, before dropping to the
# unprivileged `node` user to actually run the app.
chown -R node:node /app/data

exec gosu node "$@"
