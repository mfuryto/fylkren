# Windows Server installation with Hyper-V

This guide describes the Windows Server deployment topology for Fylkren:

```text
Windows Server 2022 or 2025
└── Hyper-V
    └── dedicated Ubuntu Server LTS virtual machine
        └── Fylkren Linux-container stack
            ├── web gateway
            ├── API
            └── PostgreSQL
```

Fylkren is administered from Windows Server, but the application remains in the
same Linux containers used by the normal deployment. This avoids a separate
Windows build, keeps migrations and recovery procedures identical and does not
require Docker Desktop. Docker Desktop is not supported on Windows Server.

This is not a native Windows-container or IIS deployment. WSL and an
interactively logged-on desktop session are not part of this server topology.

## Before installation

Prepare:

- Windows Server 2022 or 2025 Standard or Datacenter with current security updates;
- hardware virtualization enabled in firmware;
- the Hyper-V role and enough unallocated CPU, memory and SSD capacity;
- a supported 64-bit Ubuntu Server LTS installation image whose checksum has
  been verified through the organization's software-supply procedure;
- an external Hyper-V virtual switch, a reserved or static VM address, DNS and
  the final public Fylkren name;
- a separate backup destination outside the VM and its VHDX;
- repository or approved offline-package access.

Size the Linux VM using [System requirements](SYSTEM_REQUIREMENTS.md). Reserve
capacity for Windows Server itself and other host workloads; the table describes
resources available to Fylkren inside the VM, not the total physical host.

Do not install Docker Desktop. Docker documents that server editions of Windows
are unsupported. The Windows container runtime also cannot run the Linux images
in this repository directly because containers share the host kernel.

Official platform references:

- [Install Hyper-V on Windows Server](https://learn.microsoft.com/windows-server/virtualization/hyper-v/get-started/install-hyper-v)
- [Create a Hyper-V virtual machine](https://learn.microsoft.com/windows-server/virtualization/hyper-v/get-started/create-a-virtual-machine-in-hyper-v)
- [Supported Linux guests on Hyper-V](https://learn.microsoft.com/windows-server/virtualization/hyper-v/supported-linux-and-freebsd-virtual-machines-for-hyper-v-on-windows)
- [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)

## 1. Install Hyper-V

Run Windows PowerShell as Administrator:

```powershell
Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart
```

The server restarts. Verify the role afterwards:

```powershell
Get-WindowsFeature Hyper-V
```

The result must show Hyper-V as installed. On Server Core, manage Hyper-V with
PowerShell or Hyper-V Manager from an authorized management computer.

## 2. Prepare the virtual network

Use Hyper-V Manager's **Virtual Switch Manager** to create or select an
**External** switch connected to the intended physical network adapter. Keep
**Allow management operating system to share this network adapter** selected
when the Windows host must retain connectivity through that adapter.

Changing a switch on a remotely managed server can interrupt the management
connection. Perform this step through the organization's normal host-change
procedure and confirm the exact adapter before applying it. Inspect existing
switches with:

```powershell
Get-VMSwitch | Format-Table Name, SwitchType, NetAdapterInterfaceDescription
```

The VM should receive its own address. Do not use the Windows host address as
the canonical Fylkren address.

## 3. Create the Linux VM

In Hyper-V Manager, select **New → Virtual Machine** and use these values as a
starting point:

| Setting | Value |
| --- | --- |
| Name | `Fylkren` |
| Generation | Generation 2 |
| Startup memory | 4 GB for the normal profile |
| Processors | 2 virtual processors for the normal profile |
| Virtual disk | At least 40 GB SSD-backed VHDX, increased for expected retention |
| Network | The external switch prepared above |
| Installation media | The verified Ubuntu Server LTS ISO |

Enable Secure Boot for the Generation 2 VM and select the Microsoft UEFI
Certificate Authority template supported by Ubuntu. Dynamic memory may be used
only when its configured minimum still satisfies the chosen Fylkren profile.

Equivalent PowerShell creation is possible after replacing every example path
and switch name with verified local values:

```powershell
$vmName = "Fylkren"
$vmRoot = "D:\Hyper-V\Fylkren"
$switchName = "Fylkren-External"
$isoPath = "D:\InstallationMedia\ubuntu-server-lts-amd64.iso"

New-Item -ItemType Directory -Path $vmRoot -Force
New-VM -Name $vmName -Generation 2 -Path $vmRoot `
  -MemoryStartupBytes 4GB `
  -NewVHDPath "$vmRoot\fylkren.vhdx" -NewVHDSizeBytes 80GB `
  -SwitchName $switchName
Set-VMProcessor -VMName $vmName -Count 2
Set-VMFirmware -VMName $vmName -EnableSecureBoot On `
  -SecureBootTemplate MicrosoftUEFICertificateAuthority
Add-VMDvdDrive -VMName $vmName -Path $isoPath
$dvd = Get-VMDvdDrive -VMName $vmName
Set-VMFirmware -VMName $vmName -FirstBootDevice $dvd
Set-VM -Name $vmName -AutomaticStartAction StartIfRunning `
  -AutomaticStartDelay 30 -AutomaticStopAction ShutDown
Start-VM -Name $vmName
VMConnect.exe localhost $vmName
```

Do not run the example unchanged. In particular, creating or selecting the wrong
virtual switch or storage path can interrupt the host or place data on an
unprotected disk.

## 4. Install and prepare Ubuntu Server

Install a minimal 64-bit Ubuntu Server LTS guest:

1. Use a unique hostname, for example `fylkren-vm`.
2. Enable OpenSSH only when it is allowed by the management policy.
3. Use a reserved DHCP lease or static address and register the intended DNS record.
4. Install all security updates and confirm time synchronization.
5. Limit SSH and the Fylkren service port with the network firewall. Do not
   expose SSH, PostgreSQL or the API container directly to untrusted networks.

When installation has completed, eject the ISO and place the virtual hard disk
first in the VM firmware boot order. In Hyper-V Manager, use the VM's **Settings
→ Firmware** page. The equivalent host commands, while the VM is stopped, are:

```powershell
Stop-VM -Name "Fylkren"
Set-VMDvdDrive -VMName "Fylkren" -Path $null
$systemDisk = Get-VMHardDiskDrive -VMName "Fylkren" | Select-Object -First 1
Set-VMFirmware -VMName "Fylkren" -FirstBootDevice $systemDisk
Start-VM -Name "Fylkren"
```

After signing in to Ubuntu:

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git openssl
sudo reboot
```

Install Docker Engine and the Compose plugin from Docker's maintained Ubuntu
repository. Follow the current [official Ubuntu procedure](https://docs.docker.com/engine/install/ubuntu/)
rather than a third-party convenience script:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

Verify the result:

```bash
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

The examples below use `sudo docker`. An organization may instead authorize a
dedicated operator through the `docker` group, but membership effectively grants
root-level control of the VM and must be managed accordingly.

## 5. Install Fylkren inside the VM

Use the same maintained installation as a Linux server:

```bash
sudo mkdir -p /data/docker
sudo chown "$USER":"$USER" /data/docker
cd /data/docker
git clone <authorized-repository-url> fylkren
cd /data/docker/fylkren
./deploy/compose/install.sh
nano .env
```

Review `.env` before startup. At minimum, set the final public origin and the
approved HTTP/TLS proxy mode. The file contains secrets and must remain readable
only by the installation operator.

Start and inspect the stack:

```bash
cd /data/docker/fylkren
sudo docker compose build
sudo docker compose up -d
sudo ./deploy/host-status/install.sh
sudo docker compose ps
sudo docker compose logs --tail=100 api
curl --fail --silent --show-error http://localhost:8080/health
```

Open Fylkren through the VM's approved address and complete the one-time
Platform Manager setup. Follow [Server setup](SERVER_SETUP.md) for public URL,
TLS, identity, notifications and federation configuration.

The collector reports VM disk capacity, container status, restart count and
recorded backup time to Platform Manager. Windows Server's physical storage and
Hyper-V state remain in the Windows monitoring boundary; see
[Host status integration](HOST_STATUS.md).

## 6. Network and TLS boundary

Only the web gateway's host port is published by the Compose profile. The API
and PostgreSQL remain on internal container networks.

For production, use the organization's approved HTTPS reverse proxy either in
front of the VM or on the Linux VM. The proxy must preserve the original host
and forwarded scheme exactly as described in [Server setup](SERVER_SETUP.md).
Do not publish port `8080` directly to the Internet.

If Windows Server or another managed gateway terminates TLS, permit its traffic
to the VM on the configured gateway port and block direct client access to that
port. The public certificate and DNS name must match `FYLKREN_PUBLIC_URL`.

## 7. Persistence and backup

Hyper-V checkpoints and copies of a running VHDX are not Fylkren backups. A
recoverable backup consists of the PostgreSQL dump, `.env`, matching Data
Protection key volume and the deployed application version as one recorded
restore point. Store it outside the VM and preferably outside the Windows host.

Use the canonical [backup and restore procedure](INSTALLATION_AND_UPGRADES.md#before-every-upgrade)
inside the Linux VM. Rehearse restoration on an isolated replacement VM. Never
start the original and a restored clone together, because they contain the same
installation and federation identity.

Include the VM configuration and network design in the Windows host backup, but
do not treat that host-level copy as a substitute for the application-consistent
backup and restore rehearsal.

## 8. Upgrades and maintenance

Application upgrades are run inside Ubuntu using
[Installation and upgrades](INSTALLATION_AND_UPGRADES.md). Preserve Docker
volumes and `.env`; never delete volumes as an upgrade shortcut.

For planned Windows Server maintenance:

1. Confirm a current, tested Fylkren restore point.
2. Stop application traffic and allow active requests to finish.
3. Shut down the Linux guest cleanly; do not power it off abruptly.
4. Patch and restart Windows Server through the normal maintenance process.
5. Start the VM and verify Docker, all three services, `/health`, sign-in and the
   public HTTPS route.

Docker restart policies start the Fylkren services when Docker starts. Hyper-V's
automatic start action starts the VM after a host restart; verify both rather
than assuming that application availability follows from Windows being online.

## 9. Acceptance checklist

Before operational data is entered, record evidence that:

- Hyper-V and the Fylkren VM restart cleanly after a Windows Server restart;
- the VM has the expected CPU, memory, VHDX location, network and time source;
- only the approved HTTPS route is externally reachable;
- PostgreSQL and API ports are not exposed;
- the Platform Manager can sign in and sees the expected version;
- configured identity and SMTP connections work from inside the VM;
- a complete backup has been restored successfully to an isolated VM;
- monitoring covers Windows Server, Hyper-V, VM disk growth, Ubuntu, Docker,
  PostgreSQL and the public route;
- Windows, Ubuntu, Docker and Fylkren patch responsibilities have named owners.

Until the maintained Windows Server acceptance run has been completed for a
release, record this topology as locally accepted rather than claiming that the
release was independently verified on every Windows Server configuration.
