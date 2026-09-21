# Signing HiveAnnotate

## The problem signing solves

macOS stores the **Screen Recording** permission against the app's *signing identity*. An
unsigned (ad-hoc) build gets a different identity every time it is rebuilt, so macOS treats
each build as a new app and the permission is lost. Without signing, developing HiveAnnotate
means re-granting Screen Recording after every rebuild.

## Two paths — pick by who runs the app

| | Local certificate | Developer ID |
|---|---|---|
| Cost | Free | $99/year Apple Developer Program |
| Keeps Screen Recording across rebuilds | **Yes** | Yes |
| Runs on *your* Mac | Yes | Yes |
| Runs on *other people's* Macs without warnings | No | Yes (with notarization) |
| Needed for | Using HiveAnnotate yourself | Shipping it to anyone else |

The permission is tied to the **certificate**, not to Apple — so a certificate you make
yourself fixes the rebuild problem completely. Developer ID only matters once someone else
has to open the app.

## Path 1 — local certificate (recommended now)

```bash
./scripts/create-dev-signing-cert.sh
HIVE_SIGNING_IDENTITY="HiveAnnotate Local Signing" npm run pack
```

The script asks for your password once, to trust the certificate for code signing. Grant
Screen Recording to the packaged app once, and it survives every rebuild after that.

Undo: `security delete-certificate -c "HiveAnnotate Local Signing"`

## Path 2 — Developer ID + notarization (for distribution)

1. Join the Apple Developer Program and create a **Developer ID Application** certificate.
2. Create an app-specific password at appleid.apple.com.
3. Build:

```bash
HIVE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
APPLE_ID="you@example.com" \
APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx" \
APPLE_TEAM_ID="TEAMID" \
npm run pack
```

Notarization runs only when `APPLE_TEAM_ID` is set.

## Things that will quietly break the permission

- **Changing the bundle identifier** (`io.hiveop.hiveannotate`). It is pinned by a test for
  this reason.
- **Switching certificates** — local to Developer ID, or between two certificates. Expect to
  re-grant Screen Recording once after switching.
- **Going back to an unsigned build.** Same problem as never signing.

## What is configured

- **Hardened runtime** on (required for notarization), with the two entitlements V8 needs:
  `allow-jit` and `allow-unsigned-executable-memory`. See `packages/app/build/entitlements.mac.plist`.
- **Not sandboxed.** App Sandbox forbids global hotkeys over other apps and capturing their
  windows — what this app is made of. That also rules out the Mac App Store; see the PRD.
- The signing identity comes **only from the environment**, never from a committed file.
