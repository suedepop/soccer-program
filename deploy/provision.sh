#!/usr/bin/env bash
#
# Creates the Azure VM this app runs on. Run it once, from a machine with the
# Azure CLI signed in (`az login`) — or paste it into Azure Cloud Shell, which
# has the CLI already.
#
#   ./deploy/provision.sh
#
# It is safe to re-run: every step either already exists or is recreated. The
# one thing it will not touch on a second run is /srv/soccer/.env, because that
# holds SESSION_SECRET and rewriting it would sign every parent out.
#
# When it finishes it prints the three GitHub secrets the deploy workflow needs.
#
set -euo pipefail

# --------------------------------------------------------------- settings --

RESOURCE_GROUP="${RESOURCE_GROUP:-soccer-program}"
# North Central US rather than East US, which is nearer: the B-series sizes a
# site this small wants are capacity-restricted in the eastern regions for new
# subscriptions, and this is the closest region that will actually take one.
LOCATION="${LOCATION:-northcentralus}"
VM_NAME="${VM_NAME:-soccer-program}"
ADMIN_USER="azureuser" # must match deploy/cloud-init.yaml
# Must be unique within the region — it becomes
# <label>.<region>.cloudapp.azure.com, the address parents will use.
DNS_LABEL="${DNS_LABEL:-weir-soccer-program}"
# B2ats_v2: 2 vCPU / 1 GiB, the cheapest size a new subscription can actually
# get. B1s is the one the free tier covers, but it is NotAvailableForSubscription
# in every US region for subscriptions created recently — check before assuming
# otherwise:
#   az vm list-skus --location $LOCATION --size Standard_B1s --all
#
# 1 GiB is the same memory B1s has, so the swapfile from cloud-init is what
# carries headless Chrome through a render. If the whole-program PDF ever dies
# mid-render, that is the ceiling — the next step up is 4 GiB:
#   az vm resize -g $RESOURCE_GROUP -n $VM_NAME --size Standard_B2als_v2
#
# The v2 burstable families ship with a quota of zero on a new subscription, so
# this needs a quota request first (free, usually granted in minutes):
#   az rest --method put --url "https://management.azure.com/subscriptions/<sub>\
#   /providers/Microsoft.Compute/locations/$LOCATION/providers/Microsoft.Quota\
#   /quotas/standardBasv2Family?api-version=2023-02-01" \
#   --headers "Content-Type=application/json" \
#   --body '{"properties":{"limit":{"limitObjectType":"LimitValue","value":4},\
#   "name":{"value":"standardBasv2Family"}}}'
VM_SIZE="${VM_SIZE:-Standard_B2ats_v2}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY_PATH="${KEY_PATH:-$HERE/../deploy_key}"

# Where the deploy workflow pulls the image from. Derived from the git remote
# so it matches whatever GitHub repo this is.
REPO_SLUG="${REPO_SLUG:-$(git -C "$HERE/.." remote get-url origin 2>/dev/null |
  sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')}"
if [ -z "$REPO_SLUG" ]; then
  echo "Could not work out the GitHub repo from the git remote." >&2
  echo "Set REPO_SLUG=owner/repo and run again." >&2
  exit 1
fi
IMAGE="ghcr.io/$(echo "$REPO_SLUG" | tr '[:upper:]' '[:lower:]'):latest"

if ! az account show >/dev/null 2>&1; then
  echo "Not signed in to Azure. Run 'az login' first." >&2
  exit 1
fi
SUB_NAME="$(az account show --query name --output tsv)"
SUB_ID="$(az account show --query id --output tsv)"

echo "Subscription   : $SUB_NAME"
echo "                 $SUB_ID"
echo "Resource group : $RESOURCE_GROUP ($LOCATION)"
echo "VM             : $VM_NAME ($VM_SIZE)"
echo "Address        : $DNS_LABEL.$LOCATION.cloudapp.azure.com"
echo "Image          : $IMAGE"
echo

# This step costs money, and 'az login' remembers whichever subscription you
# last used — which is not always the one you meant to bill.
if [ "${ASSUME_YES:-}" != "1" ]; then
  read -r -p "Create these resources in \"$SUB_NAME\"? [y/N] " reply
  case "$reply" in
    y | Y | yes | Yes) ;;
    *)
      echo "Nothing created."
      exit 1
      ;;
  esac
  echo
fi

# ------------------------------------------------------------- preflight --

# The DNS label is globally unique within a region, so check before spending
# five minutes creating a VM that cannot have the address you asked for.
echo "==> Checking $DNS_LABEL is free in $LOCATION"
AVAILABLE="$(az rest --method get --url \
  "https://management.azure.com/subscriptions/$SUB_ID/providers/Microsoft.Network/locations/$LOCATION/CheckDnsNameAvailability?domainNameLabel=$DNS_LABEL&api-version=2023-09-01" \
  --query available --output tsv 2>/dev/null || echo unknown)"
if [ "$AVAILABLE" = "false" ]; then
  echo "\"$DNS_LABEL\" is taken in $LOCATION. Pick another:" >&2
  echo "  DNS_LABEL=something-else $0" >&2
  exit 1
fi

# B-series comes in several families and a subscription can have quota for one
# and none of the others. This is the family B1s belongs to.
QUOTA="$(az vm list-usage --location "$LOCATION" \
  --query "[?localName=='Standard BS Family vCPUs'].limit | [0]" --output tsv 2>/dev/null || echo '')"
if [ "$QUOTA" = "0" ]; then
  echo "This subscription has no Standard BS Family vCPU quota in $LOCATION." >&2
  echo "Request an increase, or set LOCATION to a region that has some." >&2
  exit 1
fi

# ------------------------------------------------------------------- keys --

if [ ! -f "$KEY_PATH" ]; then
  echo "==> Generating a deploy key at $KEY_PATH"
  ssh-keygen -t ed25519 -N '' -C 'soccer-program-deploy' -f "$KEY_PATH"
fi

# --------------------------------------------------------------------- vm --

echo "==> Resource group"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

if az vm show --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --output none 2>/dev/null; then
  echo "==> VM already exists, leaving it alone"
else
  echo "==> Creating the VM (a few minutes)"
  az vm create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$VM_NAME" \
    --image Ubuntu2404 \
    --size "$VM_SIZE" \
    --admin-username "$ADMIN_USER" \
    --ssh-key-values "$KEY_PATH.pub" \
    --public-ip-sku Standard \
    `# Azure defaults the OS disk to Premium SSD, which is $5.28/month for a` \
    `# site that writes a few photos a week. Standard SSD is $2.40 and no one` \
    `# will ever notice the difference.` \
    --storage-sku StandardSSD_LRS \
    --public-ip-address-dns-name "$DNS_LABEL" \
    --custom-data "$HERE/cloud-init.yaml" \
    --output none

  echo "==> Opening 80 and 443"
  az vm open-port --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --port 80 --priority 1010 --output none
  az vm open-port --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --port 443 --priority 1020 --output none
fi

FQDN="$(az vm show --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" \
  --show-details --query fqdns --output tsv | cut -d, -f1)"
echo "==> $FQDN"

# ------------------------------------------------------------- first boot --

SSH="ssh -i $KEY_PATH -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 $ADMIN_USER@$FQDN"

echo "==> Waiting for cloud-init to finish installing Docker"
for _ in $(seq 1 60); do
  if $SSH 'test -f /var/lib/cloud/instance/soccer-ready && command -v docker >/dev/null' 2>/dev/null; then
    ready=1
    break
  fi
  sleep 10
done
if [ "${ready:-}" != "1" ]; then
  echo "cloud-init has not finished. Check: $SSH 'cloud-init status --long'" >&2
  exit 1
fi

echo "==> Server-side configuration"
# SESSION_SECRET is generated once and never regenerated: it signs the login
# cookies, so a new value signs everyone out.
$SSH "IMAGE='$IMAGE' SITE='$FQDN' bash -s" <<'REMOTE'
set -euo pipefail
mkdir -p /srv/soccer
cd /srv/soccer
if [ ! -f .env ]; then
  umask 077
  {
    echo "SESSION_SECRET=$(openssl rand -hex 48)"
    echo "SITE_ADDRESS=$SITE"
    echo "APP_IMAGE=$IMAGE"
  } > .env
  echo "wrote /srv/soccer/.env"
else
  echo "/srv/soccer/.env exists — left as is"
fi
REMOTE

scp -i "$KEY_PATH" -o StrictHostKeyChecking=accept-new \
  "$HERE/docker-compose.yml" "$HERE/Caddyfile" "$ADMIN_USER@$FQDN:/srv/soccer/"

# ---------------------------------------------------------- github setup --

# The three secrets the deploy workflow needs. Set here rather than by hand,
# because typing an SSH private key into a web form is how deploys break.
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "==> Setting the repository secrets on $REPO_SLUG"
  gh secret set AZURE_VM_HOST --repo "$REPO_SLUG" --body "$FQDN"
  gh secret set AZURE_VM_USER --repo "$REPO_SLUG" --body "$ADMIN_USER"
  gh secret set AZURE_VM_SSH_KEY --repo "$REPO_SLUG" < "$KEY_PATH"
  SECRETS_DONE=1
else
  SECRETS_DONE=0
fi

# ------------------------------------------------------------------- done --

if [ "$SECRETS_DONE" = "0" ]; then
  cat <<EOF

The GitHub CLI is not signed in, so add these three repository secrets by hand
(Settings → Secrets and variables → Actions → New repository secret):

  AZURE_VM_HOST     $FQDN
  AZURE_VM_USER     $ADMIN_USER
  AZURE_VM_SSH_KEY  the contents of $KEY_PATH
                    (the private one, no .pub — including the BEGIN/END lines)
EOF
fi

cat <<EOF

Done. The VM is up; nothing is deployed to it yet.

The Deploy workflow runs on a push to main, so the deployment files have to be
on main before anything happens. Once they are, the site will be at

  https://$FQDN

The very first account created on the fresh database becomes the admin, so
sign up before you send the link to anyone. To move that later:

  ssh -i $KEY_PATH $ADMIN_USER@$FQDN
  cd /srv/soccer && docker compose exec app node scripts/make-admin.mjs <email>

EOF
